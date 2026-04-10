const RSSParser = require('rss-parser');

const UAs = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];
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
    
    // Sélectionner un User-Agent aléatoire à chaque vérification
    const randomUA = UAs[Math.floor(Math.random() * UAs.length)];
    const parser = new RSSParser({ 
        timeout: 10000,
        requestOptions: {
            headers: { 'User-Agent': randomUA }
        }
    });

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
