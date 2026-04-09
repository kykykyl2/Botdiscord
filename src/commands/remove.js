const { SlashCommandBuilder } = require('discord.js');
const { searchAnime } = require('../api/anilist');
const { remove, exists } = require('../db/watchlist');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Retirer un animé de ta watchlist')
        .addStringOption(opt =>
            opt.setName('titre')
                .setDescription('Titre de l\'animé à retirer')
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

            if (!exists(anime.id)) {
                return interaction.editReply({ content: `⚠️ **${title}** n'est pas dans ta watchlist.` });
            }

            remove(anime.id);
            await interaction.editReply({ content: `🗑️ **${title}** retiré de ta watchlist.` });
        } catch (err) {
            console.error('[remove] Erreur:', err.message);
            await interaction.editReply({ content: '❌ Erreur lors de la suppression.' });
        }
    },
};
