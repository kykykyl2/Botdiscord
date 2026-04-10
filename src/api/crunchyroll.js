const RSSParser = require('rss-parser');

const parser = new RSSParser({ timeout: 10000 });

// Flux RSS Crunchyroll (épisodes récents toutes langues)
const CR_FEEDS = [
    'https://www.crunchyroll.com/rss/anime',           // général
    'https://www.crunchyroll.com/rss/anime?lang=frFR', // France
];

let crunchyrollCooldown = 0;

/**
 * Récupère les épisodes récents depuis Crunchyroll RSS
 * Retourne un tableau d'objets { title, link, pubDate, seriesTitle, episodeTitle }
 */
async function getLatestCrunchyroll() {
    // Si on est en cooldown (suite à une erreur 429), on ignore les requêtes
    if (Date.now() < crunchyrollCooldown) {
        return [];
    }

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
            // Si on se fait bloquer par la protection ou le rate limit, on met en pause
            if (err.message.includes('429') || err.message.includes('403')) {
                console.warn('[Crunchyroll RSS] Blocage Cloudflare / Limite atteinte (429/403). Pause des requêtes pendant 2 heures pour éviter de spammer.');
                crunchyrollCooldown = Date.now() + 2 * 60 * 60 * 1000; // 2 heures
                break; // Arrêter la boucle pour ne pas essayer l'URL suivante
            }
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
