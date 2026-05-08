const axios = require('axios');

async function getTopHeadlines(apiKey, category = 'technology', country = 'fr') {
  if (!apiKey) return { error: 'no_key' };

  try {
    const res = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: { apiKey, category, country, pageSize: 8 },
      timeout: 8000,
    });

    if (res.data.status !== 'ok') return { error: res.data.message || 'API error' };

    return {
      articles: res.data.articles
        .filter(a => a.title && a.title !== '[Removed]')
        .map(a => ({
          title: a.title,
          description: a.description || '',
          source: a.source.name,
          url: a.url,
          publishedAt: a.publishedAt,
          urlToImage: a.urlToImage || null,
        })),
    };
  } catch (err) {
    console.error('[News]', err.message);
    return { error: err.response?.data?.message || err.message };
  }
}

module.exports = { getTopHeadlines };
