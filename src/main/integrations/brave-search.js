const axios = require('axios');

async function webSearch(query, apiKey, count = 5) {
  // process.env prioritaire sur electron-store (évite les vieilles clés périmées)
  const key = process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY || apiKey || '';
  if (!key) return { error: 'no_key', results: [] };

  // count doit être un entier entre 1 et 20
  const safeCount = Math.min(20, Math.max(1, parseInt(String(count), 10) || 5));

  try {
    const res = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      headers: {
        'Accept'              : 'application/json',
        'Accept-Encoding'     : 'gzip',
        'X-Subscription-Token': key,
      },
      params: {
        q     : query,
        count : safeCount,
      },
      timeout   : 12000,
      decompress: true,       // axios v1.x — décompression explicite
    });

    const results = res.data.web?.results || [];
    return {
      query,
      results: results.map(r => ({
        title      : r.title,
        description: r.description || '',
        url        : r.url,
      })),
    };

  } catch (err) {
    // Log complet pour diagnostiquer — montre le corps de la réponse Brave
    const status = err.response?.status;
    const body   = JSON.stringify(err.response?.data ?? '');
    console.error(`[BraveSearch] ${status ?? 'network'} — ${err.message} — ${body}`);

    if (status === 401) return { error: 'Clé Brave Search invalide ou expirée (401). Reconfigurer dans Paramètres.', results: [] };
    if (status === 429) return { error: 'Quota Brave Search dépassé (429). Réessayer demain.', results: [] };
    if (status === 422) return { error: `Paramètre invalide Brave (422) : ${body}`, results: [] };

    return { error: err.response?.data?.message || err.message, results: [] };
  }
}

module.exports = { webSearch };
