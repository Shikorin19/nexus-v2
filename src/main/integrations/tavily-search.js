const axios = require('axios');

async function webSearch(query, apiKey, maxResults = 5) {
  const key = apiKey
    || process.env.TAVILY_API_KEY
    || '';

  if (!key) return { error: 'no_key', results: [] };

  try {
    const res = await axios.post('https://api.tavily.com/search', {
      api_key     : key,
      query,
      search_depth: 'basic',
      max_results : Math.min(10, Math.max(1, parseInt(maxResults) || 5)),
      include_answer: false,
    }, {
      timeout: 12000,
    });

    const results = res.data.results || [];
    return {
      query,
      results: results.map(r => ({
        title      : r.title,
        description: r.content || '',
        url        : r.url,
      })),
    };

  } catch (err) {
    const status = err.response?.status;
    const body   = JSON.stringify(err.response?.data ?? '');
    console.error(`[Tavily] ${status ?? 'network'} — ${err.message} — ${body}`);

    if (status === 401) return { error: 'Clé Tavily invalide (401)', results: [] };
    if (status === 429) return { error: 'Quota Tavily dépassé (429)', results: [] };
    return { error: err.response?.data?.message || err.message, results: [] };
  }
}

module.exports = { webSearch };
