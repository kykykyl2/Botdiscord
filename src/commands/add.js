const { SlashCommandBuilder } = require('discord.js');
const { searchAnime } = require('../api/anilist');
const { add, exists } = require('../db/watchlist');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Ajouter un animé à ta watchlist')
        .addStringOption(opt =>
            opt.setName('titre')
                .setDescription('Titre de l\'animé')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const titre = interaction.options.getString('titre');

        try {
            const results = await searchAnime(titre, 1, 1);

            if (!results || results.length === 0) {
                return interaction.editReply({ content: `❌ Aucun animé trouvé pour **${titre}**.` });
            }

            const anime = results[0];
            const title = anime.title.english || anime.title.romaji;

            if (exists(anime.id)) {
                return interaction.editReply({ content: `⚠️ **${title}** est déjà dans ta watchlist !` });
            }

            const entry = {
                id: anime.id,
                title,
                titleRomaji: anime.title.romaji,
                siteUrl: anime.siteUrl,
                addedAt: new Date().toISOString(),
                nextAiringEpisode: anime.nextAiringEpisode || null,
            };

            add(entry);
            await interaction.editReply({
                content: `✅ **${title}** ajouté à ta watchlist !\n🔔 Tu seras notifié des nouveaux épisodes.`,
            });
        } catch (err) {
            console.error('[add] Erreur:', err.message);
            await interaction.editReply({ content: '❌ Erreur lors de l\'ajout. Réessaie.' });
        }
    },
};
