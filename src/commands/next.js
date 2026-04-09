const { SlashCommandBuilder } = require('discord.js');
const { searchAnime, getAnimeById } = require('../api/anilist');
const { buildNextEmbed } = require('../embeds/animeEmbed');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('next')
        .setDescription('Voir le prochain épisode d\'un animé')
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

            const anime = await getAnimeById(results[0].id);
            const embed = buildNextEmbed(anime, anime.nextAiringEpisode);
            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[next] Erreur:', err.message);
            await interaction.editReply({ content: '❌ Erreur lors de la récupération.' });
        }
    },
};
