const axios = require('axios');

async function webSearch(query, apiKey, count = 5) {
  if (!apiKey) return { error: 'no_key', results: [] };

  try {
    const res = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      params: { q: query, count },
      timeout: 10000,
    });

    const results = res.data.web?.results || [];
    return {
      query,
      results: results.map(r => ({
        title: r.title,
        description: r.description || '',
        url: r.url,
      })),
    };
  } catch (err) {
    console.error('[BraveSearch]', err.message);
    return { error: err.response?.data?.message || err.message, results: [] };
  }
}

module.exports = { webSearch };
