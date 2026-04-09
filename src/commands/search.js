const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { searchAnime } = require('../api/anilist');
const { buildSearchEmbed } = require('../embeds/animeEmbed');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Rechercher un animé sur AniList')
        .addStringOption(opt =>
            opt.setName('titre')
                .setDescription('Titre de l\'animé (en anglais, romaji ou français)')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const titre = interaction.options.getString('titre');

        try {
            const results = await searchAnime(titre);

            if (!results || results.length === 0) {
                return interaction.editReply({ content: `❌ Aucun résultat pour **${titre}**.` });
            }

            const embed = buildSearchEmbed(results);
            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[search] Erreur:', err.message);
            await interaction.editReply({ content: '❌ Erreur lors de la recherche. Réessaie dans un instant.' });
        }
    },
};
