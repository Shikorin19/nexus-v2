/**
 * NEXUS — weather
 *
 * OpenWeatherMap API + IP geolocation automatique.
 */

const axios = require('axios');

// ── IP geolocation (ip-api.com — gratuit, sans clé) ─────────────────────────

async function detectCityFromIP() {
  try {
    const res = await axios.get('http://ip-api.com/json/?fields=status,city,regionName,country', {
      timeout: 4000,
    });
    if (res.data?.status === 'success' && res.data?.city) {
      console.log('[Weather] Ville détectée par IP:', res.data.city);
      return res.data.city;
    }
  } catch (e) {
    console.warn('[Weather] IP geolocation échoué:', e.message);
  }
  return null;
}

// ── Météo OpenWeatherMap ─────────────────────────────────────────────────────

async function getWeather(city, apiKey) {
  if (!apiKey) return { error: 'no_key' };

  // Auto-detect si pas de ville fournie
  let resolvedCity = city;
  if (!resolvedCity) {
    resolvedCity = await detectCityFromIP();
  }
  if (!resolvedCity) resolvedCity = 'Paris';

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather`
      + `?q=${encodeURIComponent(resolvedCity)}`
      + `&appid=${apiKey}`
      + `&units=metric`
      + `&lang=fr`;

    const res = await axios.get(url, { timeout: 6000 });
    const d = res.data;

    return {
      city      : d.name,
      country   : d.sys?.country ?? '',
      temp      : Math.round(d.main.temp),
      feels_like: Math.round(d.main.feels_like),
      temp_min  : Math.round(d.main.temp_min),
      temp_max  : Math.round(d.main.temp_max),
      description: d.weather[0].description,
      icon      : d.weather[0].icon,
      humidity  : d.main.humidity,
      wind      : Math.round((d.wind.speed || 0) * 3.6),  // m/s → km/h
      code      : d.weather[0].id,
      fetchedAt : Date.now(),
    };
  } catch (err) {
    const status = err.response?.status;
    if (status === 401) return { error: 'invalid_key' };
    if (status === 404) return { error: 'city_not_found', city: resolvedCity };
    return { error: 'network', message: err.message };
  }
}

// ── Emoji selon code OWM ─────────────────────────────────────────────────────

function weatherEmoji(code) {
  if (!code) return '🌡️';
  if (code >= 200 && code < 300) return '⛈️';
  if (code >= 300 && code < 400) return '🌦️';
  if (code >= 500 && code < 600) return '🌧️';
  if (code >= 600 && code < 700) return '❄️';
  if (code >= 700 && code < 800) return '🌫️';
  if (code === 800)               return '☀️';
  if (code > 800)                 return '⛅';
  return '🌡️';
}

module.exports = { getWeather, weatherEmoji, detectCityFromIP };
