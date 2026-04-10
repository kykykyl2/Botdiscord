const { EmbedBuilder } = require('discord.js');
const { getIds } = require('./db/watchlist');
const { getAiringToday } = require('./api/anilist');
const { getLatestCrunchyroll } = require('./api/crunchyroll');
const { buildNotifEmbed } = require('./embeds/animeEmbed');
const config = require('./config');

// ─── Variables globales ────────────────────────────────────────────────────────
const globalNotified = new Set();    // clé unifiée: "normtitre-epX" pour l'anti-spam croisé

function getNormalizedKey(title, episode) {
    if (!title) return null;
    let norm = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    norm = norm.replace(/(english|french|dub|vf|vostfr|season\d*|s\d+)/g, '');
    return `${norm}-ep${episode}`;
}

// ─── Utilitaire : récupérer le rôle Anime News ────────────────────────────────
async function getAnimeNewsRole(client) {
    try {
        const guild = await client.guilds.fetch(config.guildId);
        const roles = await guild.roles.fetch();
        return roles.find(r => r.name === config.animeNewsRoleName) || null;
    } catch (err) {
        console.warn('[Scheduler] Impossible de récupérer le rôle:', err.message);
        return null;
    }
}

// ─── Embed RSS (Crunchyroll / ADN) ────────────────────────────────────────────
function buildRSSEmbed(item) {
    const embed = new EmbedBuilder()
        .setColor(0xF47521)
        .setAuthor({
            name: '🟠 Crunchyroll — Nouvel épisode !',
        })
        .setTitle(item.title)
        .setURL(item.link)
        .addFields(
            { name: '🕐 Disponible depuis', value: `<t:${Math.floor(item.pubDate.getTime() / 1000)}:R>`, inline: true },
            { name: '🇫🇷 Format', value: 'VOSTFR', inline: true },
        )
        .setTimestamp(item.pubDate);

    if (item.image) embed.setImage(item.image);
    return embed;
}

// ─── Vérification AniList (watchlist) ────────────────────────────────────────
async function checkAniList(channel, roleMention) {
    try {
        console.log(`[AniList] 🔎 Recherche de nouveaux épisodes en cours...`);
        const ids = getIds();

        const schedules = await getAiringToday(ids);
        console.log(`[AniList] ℹ️ ${schedules.length} épisode(s) dans la fenêtre de tir trouvés sur l'API.`);
        
        let newCount = 0;
        for (const schedule of schedules) {
            const key = `${schedule.media.id}-ep${schedule.episode}`;
            const { getNotified, addNotified } = require('./db/watchlist');
            const alreadyNotified = getNotified();
            if (alreadyNotified.includes(key)) continue;
            
            newCount++;
            addNotified(key);

            // Ajout au filtre anti-spam global
            const romajiKey = getNormalizedKey(schedule.media.title.romaji, schedule.episode);
            if (romajiKey) globalNotified.add(romajiKey);
            const enKey = getNormalizedKey(schedule.media.title.english, schedule.episode);
            if (enKey) globalNotified.add(enKey);

            const embed = buildNotifEmbed(schedule, schedule.media);
            const content = roleMention ? `${roleMention} 📢 Nouvel épisode en approche !` : null;
            await channel.send({ content, embeds: [embed] });
            console.log(`[AniList] ✅ Notification envoyée : ${schedule.media.title.romaji} Ep ${schedule.episode}`);
        }
        
        if (newCount === 0 && schedules.length > 0) {
            console.log(`[AniList] 💤 Aucun nouveau message envoyé (les ${schedules.length} épisodes ont déjà été notifiés).`);
        } else if (schedules.length === 0) {
            console.log(`[AniList] 💤 Aucun épisode à notifier pour le moment.`);
        }
    } catch (err) {
        console.error('[AniList] Erreur lors de la recherche:', err.message);
    }
}

// ─── Vérification Crunchyroll RSS ────────────────────────────────────────────
async function checkCrunchyroll(channel, roleMention) {
    try {
        console.log(`[Crunchyroll] 🔎 Recherche de nouveaux épisodes sur le flux RSS...`);
        const items = await getLatestCrunchyroll();
        
        if (items.length > 0) {
            console.log(`[Crunchyroll] ℹ️ ${items.length} épisode(s) remonté(s) par le flux RSS.`);
        } else {
            console.log(`[Crunchyroll] 💤 Flux RSS retourné vide ou mis en pause (Cooldown 429).`);
        }

        // On va chercher jusqu'à 24h en arrière pour ratisser large
        const cutoff = Date.now() - 24 * 60 * 60 * 1000; 
        let newCount = 0;

        for (const item of items) {
            const { getNotified, addNotified } = require('./db/watchlist');
            const alreadyNotified = getNotified();

            // Si déjà dans le fichier permanent, on ignore
            if (alreadyNotified.includes(item.link)) continue;
            if (item.pubDate.getTime() < cutoff) continue;

            newCount++;
            addNotified(item.link);
            const embed = buildRSSEmbed(item);
            const content = roleMention ? `${roleMention} 🟠 Crunchyroll — Disponible maintenant !` : null;
            await channel.send({ content, embeds: [embed] });
            console.log(`[Crunchyroll] ✅ Notification envoyée : ${item.title}`);
        }

        if (newCount === 0 && items.length > 0) {
            console.log(`[Crunchyroll] 💤 Aucun nouvel épisode détecté dans les 20 dernières minutes (ou déjà notifiés).`);
        }
    } catch (err) {
        console.error('[Crunchyroll] Erreur lors de la recherche:', err.message);
    }
}


// ─── Boucle principale ────────────────────────────────────────────────────────
async function checkAll(client) {
    try {
        const channel = await client.channels.fetch(config.notifChannelId);
        if (!channel) return;

        // Récupérer le rôle @Anime News
        const role = await getAnimeNewsRole(client);
        const roleMention = role ? `<@&${role.id}>` : null;

        if (role) {
            console.log(`[Scheduler] Rôle trouvé : @${role.name} (${role.id})`);
        } else {
            console.warn(`[Scheduler] Rôle "${config.animeNewsRoleName}" introuvable — notifications sans mention.`);
        }

        // Vérifications en parallèle
        await Promise.all([
            checkAniList(channel, roleMention),
            checkCrunchyroll(channel, roleMention),
        ]);
    } catch (err) {
        console.error('[Scheduler] Erreur globale:', err.message);
    }
}

function scheduleNext(client) {
    // Délai aléatoire entre 10 et 17 minutes (en millisecondes)
    const minMs = 10 * 60 * 1000;
    const maxMs = 17 * 60 * 1000;
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

    const nextTime = new Date(Date.now() + delay).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    console.log(`[Scheduler] 🕒 Prochaine vérification programmée à ${nextTime} (dans ${(delay/60000).toFixed(1)} min)`);

    setTimeout(async () => {
        console.log('[Scheduler] 🔄 Vérification en cours (Crunchyroll + AniList)...');
        await checkAll(client);
        scheduleNext(client);
    }, delay);
}

// ─── Démarrage du scheduler ───────────────────────────────────────────────────
function startScheduler(client, channelId) {
    console.log('[Scheduler] ✅ Démarré — vérification avec intervalles aléatoires (Anti-Bot).');

    // Première vérification après 8s (laisser le bot se connecter)
    setTimeout(async () => {
        await checkAll(client);
        scheduleNext(client);
    }, 8000);
}

module.exports = { startScheduler };
