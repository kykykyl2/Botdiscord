require('dotenv').config();

module.exports = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    notifChannelId: process.env.NOTIF_CHANNEL_ID,
    animeNewsRoleName: process.env.ANIME_NEWS_ROLE_NAME || 'Anime News',
    prefix: '!',
};
