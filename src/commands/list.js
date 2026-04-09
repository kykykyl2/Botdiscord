const { SlashCommandBuilder } = require('discord.js');
const { getAll } = require('../db/watchlist');
const { getAnimeById } = require('../api/anilist');
const { buildWatchlistEmbed } = require('../embeds/animeEmbed');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('Voir tous les animés dans ta watchlist'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const watchlist = getAll();

            // Rafraîchir les infos de prochain épisode depuis AniList
            const enriched = await Promise.all(
                watchlist.map(async (a) => {
                    try {
                        const fresh = await getAnimeById(a.id);
                        return { ...a, nextAiringEpisode: fresh.nextAiringEpisode };
                    } catch {
                        return a;
                    }
                })
            );

            const embed = buildWatchlistEmbed(enriched);
            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[list] Erreur:', err.message);
            await interaction.editReply({ content: '❌ Erreur lors du chargement de la watchlist.' });
        }
    },
};
