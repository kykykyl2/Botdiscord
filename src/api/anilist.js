const axios = require('axios');

const ANILIST_API = 'https://graphql.anilist.co';

/**
 * Rechercher des animés par titre
 */
async function searchAnime(title, page = 1, perPage = 5) {
    const query = `
    query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          id
          title {
            romaji
            english
            native
          }
          status
          episodes
          coverImage {
            large
            color
          }
          bannerImage
          description(asHtml: false)
          genres
          averageScore
          nextAiringEpisode {
            episode
            airingAt
            timeUntilAiring
          }
          siteUrl
        }
      }
    }
  `;

    const response = await axios.post(ANILIST_API, {
        query,
        variables: { search: title, page, perPage },
    }, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });

    return response.data.data.Page.media;
}

/**
 * Récupérer les détails + prochain épisode d'un animé par ID
 */
async function getAnimeById(id) {
    const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title {
          romaji
          english
        }
        status
        episodes
        coverImage {
          large
          color
        }
        nextAiringEpisode {
          episode
          airingAt
          timeUntilAiring
        }
        siteUrl
        averageScore
        genres
      }
    }
  `;

    const response = await axios.post(ANILIST_API, {
        query,
        variables: { id },
    }, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });

    return response.data.data.Media;
}

/**
 * Récupérer les animés qui airient dans la prochaine heure ou qui ont airé dans la dernière heure
 */
async function getAiringToday(mediaIds) {
    if (!mediaIds || mediaIds.length === 0) return [];

    const now = Math.floor(Date.now() / 1000);
    // Fenêtre : Les épisodes sortis dans la dernière heure (-60min) jusqu'à ceux qui sortent dans 5 minutes
    // Avant, c'était +90min, ce qui annonçait les épisodes bien trop tôt !
    const from = now - 3600; 
    const to = now + 300;

    const query = `
    query ($mediaId_in: [Int], $airingAt_greater: Int, $airingAt_lesser: Int) {
      Page(perPage: 50) {
        airingSchedules(
          mediaId_in: $mediaId_in,
          airingAt_greater: $airingAt_greater,
          airingAt_lesser: $airingAt_lesser
        ) {
          id
          episode
          airingAt
          timeUntilAiring
          media {
            id
            title {
              romaji
              english
            }
            coverImage {
              large
              color
            }
            siteUrl
          }
        }
      }
    }
  `;

    const response = await axios.post(ANILIST_API, {
        query,
        variables: { mediaId_in: mediaIds, airingAt_greater: from, airingAt_lesser: to },
    }, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });

    return response.data.data.Page.airingSchedules;
}

module.exports = { searchAnime, getAnimeById, getAiringToday };
