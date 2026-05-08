const cron = require('node-cron');

let briefingJob = null;

function setupBriefing(mainWindow) {
  // Fire every day at 08:00 (Europe/Paris)
  briefingJob = cron.schedule('0 8 * * *', () => triggerBriefing(mainWindow), {
    timezone: 'Europe/Paris',
  });
  console.log('[Briefing] Cron scheduled at 08:00 Paris time');
}

async function triggerBriefing(mainWindow) {
  try {
    const Store = require('electron-store');
    const store = new Store();
    if (store.get('briefing.enabled', true) === false) return;

    const { getTasks, getHabits } = require('./db/db');
    const tasks = getTasks({ status: 'todo' }).slice(0, 3);
    const habits = getHabits();
    const userName = store.get('userName', '');

    // Try to get weather
    let weather = null;
    const weatherKey = store.get('weatherApiKey', '');
    const weatherCity = store.get('weatherCity', 'Paris');
    if (weatherKey) {
      const { getWeather } = require('./weather');
      weather = await getWeather(weatherCity, weatherKey).catch(() => null);
    }

    const today = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });

    let ttsText = `Bonjour ${userName} ! Nous sommes ${today}. `;
    if (weather && !weather.error) {
      ttsText += `Il fait ${weather.temp} degrés à ${weather.city}, ${weather.description}. `;
    }
    if (tasks.length > 0) {
      ttsText += `Vous avez ${tasks.length} tâche${tasks.length > 1 ? 's' : ''} prioritaire${tasks.length > 1 ? 's' : ''} aujourd'hui. `;
      ttsText += `La première : ${tasks[0].title}. `;
    } else {
      ttsText += 'Aucune tâche urgente pour aujourd\'hui. ';
    }
    const habitsDone = habits.filter(h => h.todayDone).length;
    ttsText += `${habitsDone} habitude${habitsDone !== 1 ? 's' : ''} complétée${habitsDone !== 1 ? 's' : ''} sur ${habits.length}. Bonne journée !`;

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('morning-briefing', {
        ttsText,
        tasks,
        habits,
        weather,
        userName,
        date: today,
      });
      if (!mainWindow.isVisible()) mainWindow.show();
    }
  } catch (err) {
    console.error('[Briefing] Error:', err);
  }
}

function stopBriefing() {
  if (briefingJob) { briefingJob.stop(); briefingJob = null; }
}

module.exports = { setupBriefing, stopBriefing, triggerBriefing };
