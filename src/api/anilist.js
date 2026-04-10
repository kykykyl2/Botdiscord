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
 * Récupérer les animés qui airient dans la prochaine heure
 * Si mediaIds est vide, on récupère TOUS les animes TV japonais du moment.
 */
async function getAiringToday(mediaIds = []) {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 3600;
  const to = now + 900;

  const query = `
    query ($mediaId_in: [Int], $airingAt_greater: Int, $airingAt_lesser: Int) {
      Page(perPage: 50) {
        airingSchedules(
          mediaId_in: $mediaId_in,
          airingAt_greater: $airingAt_greater,
          airingAt_lesser: $airingAt_lesser,
          sort: TIME
        ) {
          id
          episode
          airingAt
          timeUntilAiring
          media {
            id
            format
            countryOfOrigin
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

  const variables = { airingAt_greater: from, airingAt_lesser: to };
  if (mediaIds && mediaIds.length > 0) {
    variables.mediaId_in = mediaIds;
  }

  const response = await axios.post(ANILIST_API, {
    query,
    variables,
  }, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });

  let schedules = response.data.data.Page.airingSchedules;

  // Si on cherche globalement (sans watchlist), filtrer pour ne garder que les animes TV japonais
  // afin d'éviter le spam de donghua (chinois) ou d'OVA/Spéciaux obscurs.
  if (!mediaIds || mediaIds.length === 0) {
    schedules = schedules.filter(s => s.media.format === 'TV' && s.media.countryOfOrigin === 'JP');
  }

  return schedules;
}

module.exports = { searchAnime, getAnimeById, getAiringToday };
