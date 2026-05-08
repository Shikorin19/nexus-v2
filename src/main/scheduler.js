const cron = require('node-cron');

let schedulerJob = null;
let lastActivatedMode = null;

function setupScheduler(mainWindow) {
  // Check every minute if a mode should auto-activate
  schedulerJob = cron.schedule('* * * * *', () => {
    checkModeSchedules(mainWindow);
  }, { timezone: 'Europe/Paris' });
}

function stopScheduler() {
  if (schedulerJob) {
    schedulerJob.stop();
    schedulerJob = null;
  }
}

function checkModeSchedules(mainWindow) {
  try {
    const { getModeSchedules } = require('./db/db');
    const { activateMode } = require('./modes/mode-engine');
    const schedules = getModeSchedules();
    if (!schedules.length) return;

    const now = new Date();
    // getDay(): 0=Sun, 1=Mon ... 6=Sat → convert to 1=Mon ... 7=Sun
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    const currentHour = now.getHours();

    let targetMode = null;

    for (const schedule of schedules) {
      if (!schedule.enabled) continue;
      const days = schedule.days.split(',').map(Number);
      if (!days.includes(dayOfWeek)) continue;

      const { start_hour, end_hour } = schedule;

      // Handle overnight schedules (e.g., 22–6)
      let active;
      if (start_hour < end_hour) {
        active = currentHour >= start_hour && currentHour < end_hour;
      } else {
        active = currentHour >= start_hour || currentHour < end_hour;
      }

      if (active) {
        targetMode = schedule.mode_id;
        break;
      }
    }

    if (targetMode && targetMode !== lastActivatedMode) {
      lastActivatedMode = targetMode;
      activateMode(targetMode).catch(() => {});
      mainWindow?.webContents.send('activate-mode', { modeId: targetMode });
      mainWindow?.webContents.send('notification', {
        title: 'Mode automatique',
        message: `Mode "${targetMode}" activé selon le planning`,
        type: 'info',
      });
    } else if (!targetMode && lastActivatedMode) {
      lastActivatedMode = null;
    }
  } catch (err) {
    console.error('[Scheduler]', err.message);
  }
}

module.exports = { setupScheduler, stopScheduler };
