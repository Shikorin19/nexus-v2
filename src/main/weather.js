const axios = require('axios');

async function getWeather(city, apiKey) {
  if (!apiKey) return { error: 'no_key' };
  if (!city) city = 'Paris';

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=fr`;
    const res = await axios.get(url, { timeout: 6000 });
    const d = res.data;
    return {
      city: d.name,
      temp: Math.round(d.main.temp),
      feels_like: Math.round(d.main.feels_like),
      description: d.weather[0].description,
      icon: d.weather[0].icon,
      humidity: d.main.humidity,
      wind: Math.round((d.wind.speed || 0) * 3.6),
      code: d.weather[0].id,
    };
  } catch (err) {
    const status = err.response?.status;
    if (status === 401) return { error: 'invalid_key' };
    if (status === 404) return { error: 'city_not_found' };
    return { error: 'network', message: err.message };
  }
}

function weatherEmoji(code) {
  if (!code) return '🌡️';
  if (code >= 200 && code < 300) return '⛈️';
  if (code >= 300 && code < 400) return '🌦️';
  if (code >= 500 && code < 600) return '🌧️';
  if (code >= 600 && code < 700) return '❄️';
  if (code >= 700 && code < 800) return '🌫️';
  if (code === 800) return '☀️';
  if (code > 800) return '⛅';
  return '🌡️';
}

module.exports = { getWeather, weatherEmoji };
