const { EmbedBuilder } = require('discord.js');

/**
 * Formater une durée en secondes → "Xh Xmin Xs"
 */
function formatDuration(seconds) {
    if (seconds <= 0) return 'Maintenant !';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}min`);
    if (s > 0 && h === 0) parts.push(`${s}s`);
    return parts.join(' ');
}

/**
 * Embed de notification d'épisode (VOSTFR/VF)
 */
function buildNotifEmbed(schedule, animeData) {
    const media = schedule.media || animeData;
    const title = media.title.english || media.title.romaji;
    const color = media.coverImage?.color ? parseInt(media.coverImage.color.replace('#', ''), 16) : 0x5865F2;
    const airingDate = new Date(schedule.airingAt * 1000);

    return new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: '📺 Nouvel Épisode Disponible !' })
        .setTitle(`${title}`)
        .setURL(media.siteUrl)
        .setImage(media.coverImage?.large || null)
        .addFields(
            { name: '📅 Épisode', value: `**Épisode ${schedule.episode}**`, inline: true },
            { name: '🕐 Heure de diffusion', value: `<t:${schedule.airingAt}:F>`, inline: true },
            { name: '🇯🇵 VOSTFR / 🇫🇷 VF', value: 'Disponible sur **ADN**, **Crunchyroll** ou **Netflix**', inline: false },
        )
        .setFooter({ text: `AniID: ${media.id} • Vérifiez sur votre plateforme habituelle` })
        .setTimestamp(airingDate);
}

/**
 * Embed de résultats de recherche
 */
function buildSearchEmbed(animes) {
    const embed = new EmbedBuilder()
        .setColor(0x02A9FF)
        .setTitle('🔍 Résultats de recherche')
        .setDescription('Voici les animés trouvés. Utilise `/anime add` avec le bon titre pour en ajouter un.')
        .setTimestamp();

    if (animes[0] && animes[0].coverImage && animes[0].coverImage.large) {
        embed.setImage(animes[0].coverImage.large);
    }

    animes.slice(0, 5).forEach((a, i) => {
        const title = a.title.english || a.title.romaji;
        const status = a.status === 'RELEASING' ? '🟢 En cours' : a.status === 'FINISHED' ? '⚪ Terminé' : '🟡 À venir';
        const next = a.nextAiringEpisode
            ? `Ep ${a.nextAiringEpisode.episode} dans **${formatDuration(a.nextAiringEpisode.timeUntilAiring)}**`
            : a.episodes ? `${a.episodes} épisodes` : 'N/A';
        const score = a.averageScore ? `⭐ ${a.averageScore}/100` : '';

        embed.addFields({
            name: `${i + 1}. ${title} (ID: ${a.id})`,
            value: `${status} • ${score}\n🔢 ${next}\n🏷️ ${(a.genres || []).slice(0, 3).join(', ')}`,
        });
    });

    return embed;
}

/**
 * Embed de la watchlist
 */
function buildWatchlistEmbed(animes) {
    const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('📋 Ta liste d\'animés suivis')
        .setTimestamp();

    if (animes.length === 0) {
        embed.setDescription('Aucun animé suivi pour l\'instant.\nUtilise `/anime add <titre>` pour en ajouter !');
        return embed;
    }

    animes.forEach((a, i) => {
        const next = a.nextAiringEpisode
            ? `Ep ${a.nextAiringEpisode.episode} dans **${formatDuration(a.nextAiringEpisode.timeUntilAiring)}**`
            : '✅ Terminé / Inconnu';
        embed.addFields({
            name: `${i + 1}. ${a.title}`,
            value: `🔢 Prochain : ${next}\n🆔 ID: \`${a.id}\``,
        });
    });

    embed.setFooter({ text: `${animes.length} animé(s) suivi(s)` });
    return embed;
}

/**
 * Embed "prochain épisode"
 */
function buildNextEmbed(anime, nextEp) {
    const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle(`⏳ Prochain épisode : ${anime.title.english || anime.title.romaji}`)
        .setURL(anime.siteUrl)
        .setImage(anime.coverImage?.large || null)
        .setTimestamp();

    if (nextEp) {
        embed.addFields(
            { name: '📅 Épisode', value: `Épisode **${nextEp.episode}**`, inline: true },
            { name: '⏰ Dans', value: `**${formatDuration(nextEp.timeUntilAiring)}**`, inline: true },
            { name: '📡 Diffusion', value: `<t:${nextEp.airingAt}:F>`, inline: false },
        );
    } else {
        embed.setDescription('Aucun prochain épisode planifié (série terminée ou en pause).');
    }

    return embed;
}

module.exports = { buildNotifEmbed, buildSearchEmbed, buildWatchlistEmbed, buildNextEmbed, formatDuration };
