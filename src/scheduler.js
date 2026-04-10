const { EmbedBuilder } = require('discord.js');
const { getIds } = require('./db/watchlist');
const { getAiringToday } = require('./api/anilist');
const { getLatestCrunchyroll } = require('./api/crunchyroll');
const { buildNotifEmbed } = require('./embeds/animeEmbed');
const config = require('./config');

// ─── Mémoire anti-doublons (session courante) ─────────────────────────────────
const notifiedAniList = new Set();   // clé: "mediaId-epX"
const notifiedRSS = new Set();       // clé: URL de l'item
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
        const ids = getIds();

        const schedules = await getAiringToday(ids);
        for (const schedule of schedules) {
            const key = `${schedule.media.id}-ep${schedule.episode}`;
            const { getNotified, addNotified } = require('./db/watchlist');
            const alreadyNotified = getNotified();
            if (alreadyNotified.includes(key)) continue;
            addNotified(key);

            // Ajout au filtre anti-spam global
            const romajiKey = getNormalizedKey(schedule.media.title.romaji, schedule.episode);
            if (romajiKey) globalNotified.add(romajiKey);
            const enKey = getNormalizedKey(schedule.media.title.english, schedule.episode);
            if (enKey) globalNotified.add(enKey);

            const embed = buildNotifEmbed(schedule, schedule.media);
            const content = roleMention ? `${roleMention} 📢 Nouvel épisode en approche !` : null;
            await channel.send({ content, embeds: [embed] });
            console.log(`[AniList] Notification : ${schedule.media.title.romaji} Ep ${schedule.episode}`);
        }
    } catch (err) {
        console.error('[AniList] Erreur:', err.message);
    }
}

// ─── Vérification Crunchyroll RSS ────────────────────────────────────────────
async function checkCrunchyroll(channel, roleMention) {
    try {
        const items = await getLatestCrunchyroll();
        const cutoff = Date.now() - 20 * 60 * 1000; // épisodes des 20 dernières minutes

        for (const item of items) {
            if (notifiedRSS.has(item.link)) continue;
            if (item.pubDate.getTime() < cutoff) continue;

            // Filtre anti-spam croisé (AniList vs Crunchyroll)
            const match = item.title.match(/^(.*?)\s*-\s*(?:Épisode|Ep\.?|Episode)\s*(\d+)/i);
            if (match) {
                const seriesTitle = match[1];
                const epNum = match[2];
            }

            notifiedRSS.add(item.link);
            const embed = buildRSSEmbed(item);
            const content = roleMention ? `${roleMention} 🟠 Crunchyroll — Disponible maintenant !` : null;
            await channel.send({ content, embeds: [embed] });
            console.log(`[Crunchyroll] Notification : ${item.title}`);
        }
    } catch (err) {
        console.error('[Crunchyroll] Erreur:', err.message);
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
