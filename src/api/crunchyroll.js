const RSSParser = require('rss-parser');

const parser = new RSSParser({ timeout: 10000 });

// Flux RSS Crunchyroll (épisodes récents toutes langues)
const CR_FEEDS = [
    'https://www.crunchyroll.com/rss/anime',           // général
    'https://www.crunchyroll.com/rss/anime?lang=frFR', // France
];

/**
 * Récupère les épisodes récents depuis Crunchyroll RSS
 * Retourne un tableau d'objets { title, link, pubDate, seriesTitle, episodeTitle }
 */
async function getLatestCrunchyroll() {
    const items = [];

    for (const url of CR_FEEDS) {
        try {
            const feed = await parser.parseURL(url);
            for (const item of (feed.items || [])) {
                // pubDate → timestamp
                const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
                items.push({
                    source: 'Crunchyroll',
                    title: item.title || '',
                    link: item.link || '',
                    pubDate,
                    image: item.enclosure?.url || null,
                    // Le titre CR est généralement "Série - Épisode X - Titre ep"
                    raw: item,
                });
            }
        } catch (err) {
            console.warn(`[Crunchyroll RSS] Erreur sur ${url}:`, err.message);
        }
    }

    // Dédoublonner par lien
    const seen = new Set();
    return items.filter(i => {
        if (seen.has(i.link)) return false;
        seen.add(i.link);
        return true;
    });
}

module.exports = { getLatestCrunchyroll };
