const RSSParser = require('rss-parser');

// ADN = Anime Digital Network, plateforme française VOSTFR/VF
// NOTE: ADN a supprimé ses flux RSS publics et bloqué l'accès via Cloudflare (Erreurs 403/404).
// Cette fonction retourne désormais un tableau vide pour empêcher le crash ou spam des logs de l'application.
const ADN_FEEDS = [];

/**
 * Récupère les épisodes récents depuis ADN RSS (Désactivé)
 */
async function getLatestADN() {
    return [];
}

module.exports = { getLatestADN };
