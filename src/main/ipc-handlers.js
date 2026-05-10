const { ipcMain, dialog, shell, app } = require('electron');
const path = require('path');
const os = require('os');

let mainWindow = null;

function setupIpcHandlers(win) {
  mainWindow = win;

  // === Window controls ===
  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window-close', () => mainWindow?.hide());

  // === AI Chat ===
  ipcMain.handle('ai-chat', async (event, { messages, useCloud }) => {
    const { routeMessage } = require('./ai/router');
    return await routeMessage(messages, useCloud);
  });

  ipcMain.handle('ai-chat-stream', async (event, { messages }) => {
    const { routeMessageStream } = require('./ai/router');
    const stream = routeMessageStream(messages);
    for await (const chunk of stream) {
      mainWindow?.webContents.send('ai-stream-chunk', chunk);
    }
    mainWindow?.webContents.send('ai-stream-done');
  });

  // === Debug renderer → terminal ===
  ipcMain.on('renderer-log', (event, msg) => console.log('[R]', msg));

  // === TTS ===
  ipcMain.handle('tts-speak', async (event, { text, rate, volume }) => {
    console.log('[TTS] tts-speak →', text?.substring(0, 60));
    const { speak } = require('./voice/tts');
    try {
      const result = await speak(text, { rate, volume });
      console.log('[TTS] audio généré, base64 length:', result?.audio?.length ?? 0);

      // Écriture en fichier temp → file:// URL pour le renderer
      // (blob:/data: URLs bloqués par Electron URL safety check même en file://)
      const fs   = require('fs');
      const os   = require('os');
      const tempPath = path.join(os.tmpdir(), 'nexus_tts.mp3');
      fs.writeFileSync(tempPath, Buffer.from(result.audio, 'base64'));
      const fileUrl = 'file:///' + tempPath.replace(/\\/g, '/');
      console.log('[TTS] temp file →', tempPath);

      return { ...result, fileUrl };
    } catch (err) {
      console.error('[TTS] erreur:', err.message);
      return null;
    }
  });

  ipcMain.on('tts-stop', () => {
    console.log('[TTS] stop');
    const { stopSpeaking } = require('./voice/tts');
    stopSpeaking();
  });

  // === STT (Groq Whisper) ===
  ipcMain.handle('stt-transcribe', async (event, audioBuffer) => {
    console.log('[STT] stt-transcribe, buffer size:', audioBuffer?.byteLength ?? 0);
    const Store = require('electron-store');
    const store = new Store();
    const apiKey = store.get('groqApiKey', '') || process.env.GROQ_API_KEY || '';
    const { transcribeAudio } = require('./voice/stt');
    const result = await transcribeAudio(audioBuffer, apiKey);
    console.log('[STT] résultat:', result?.text || result?.error);
    return result;
  });

  // === PC Control ===
  ipcMain.handle('pc-volume-set', async (event, { level }) => {
    const { setVolume } = require('./pc-control/system');
    return await setVolume(level);
  });

  ipcMain.handle('pc-volume-get', async () => {
    const { getVolume } = require('./pc-control/system');
    return await getVolume();
  });

  ipcMain.handle('pc-brightness-set', async (event, { level }) => {
    const { setBrightness } = require('./pc-control/system');
    return await setBrightness(level);
  });

  ipcMain.handle('pc-app-launch', async (event, { name }) => {
    const { launchApp } = require('./pc-control/apps');
    return await launchApp(name);
  });

  ipcMain.handle('pc-app-close', async (event, { name }) => {
    const { closeApp } = require('./pc-control/apps');
    return await closeApp(name);
  });

  ipcMain.handle('pc-app-list', async () => {
    const { listRunningApps } = require('./pc-control/apps');
    return await listRunningApps();
  });

  ipcMain.handle('pc-file-create', async (event, { filePath, content }) => {
    const { createFile } = require('./pc-control/files');
    return await createFile(filePath, content);
  });

  ipcMain.handle('pc-file-read', async (event, { filePath }) => {
    const { readFile } = require('./pc-control/files');
    return await readFile(filePath);
  });

  ipcMain.handle('pc-file-open', async (event, { filePath }) => {
    return shell.openPath(filePath);
  });

  ipcMain.handle('pc-screenshot', async () => {
    const { takeScreenshot } = require('./pc-control/system');
    return await takeScreenshot();
  });

  ipcMain.handle('pc-power', async (event, { action }) => {
    const { powerAction } = require('./pc-control/system');
    return await powerAction(action);
  });

  ipcMain.handle('pc-open-url', async (event, { url }) => {
    await shell.openExternal(url);
    return { success: true };
  });

  // === Database / Tasks ===
  ipcMain.handle('db-get-tasks', async () => {
    const { getTasks } = require('./db/db');
    return getTasks();
  });

  ipcMain.handle('db-create-task', async (event, task) => {
    const { createTask } = require('./db/db');
    return createTask(task);
  });

  ipcMain.handle('db-update-task', async (event, task) => {
    const { updateTask } = require('./db/db');
    return updateTask(task);
  });

  ipcMain.handle('db-delete-task', async (event, { id }) => {
    const { deleteTask } = require('./db/db');
    return deleteTask(id);
  });

  ipcMain.handle('db-get-habits', async () => {
    const { getHabits } = require('./db/db');
    return getHabits();
  });

  ipcMain.handle('db-create-habit', async (event, habit) => {
    const { createHabit } = require('./db/db');
    return createHabit(habit);
  });

  ipcMain.handle('db-toggle-habit', async (event, { habitId, date }) => {
    const { toggleHabitEntry } = require('./db/db');
    return toggleHabitEntry(habitId, date);
  });

  ipcMain.handle('db-get-chat-history', async (event, { limit }) => {
    const { getChatHistory } = require('./db/db');
    return getChatHistory(limit || 50);
  });

  ipcMain.handle('db-save-message', async (event, message) => {
    const { saveMessage } = require('./db/db');
    return saveMessage(message);
  });

  // === Settings ===
  ipcMain.handle('settings-get', async (event, { key }) => {
    const Store = require('electron-store');
    const store = new Store();
    return store.get(key);
  });

  ipcMain.handle('settings-set', async (event, { key, value }) => {
    const Store = require('electron-store');
    const store = new Store();
    store.set(key, value);
    return { success: true };
  });

  ipcMain.handle('settings-get-all', async () => {
    const Store = require('electron-store');
    const store = new Store();
    return store.store;
  });

  // === System Info ===
  ipcMain.handle('system-info', async () => {
    return {
      platform: process.platform,
      arch: process.arch,
      cpuCount: os.cpus().length,
      totalMemGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(1),
      freeMemGB: (os.freemem() / 1024 / 1024 / 1024).toFixed(1),
      hostname: os.hostname(),
      username: os.userInfo().username,
      uptime: os.uptime(),
    };
  });

  // === Stats ===
  ipcMain.handle('stats-get', async (event, { period }) => {
    const { getStats } = require('./db/db');
    return getStats(period || 'week');
  });

  ipcMain.handle('stats-log-focus', async (event, { minutes, taskId, mode }) => {
    const { logFocusSession } = require('./db/db');
    return logFocusSession(minutes, taskId, mode);
  });

  // === Modes ===
  ipcMain.handle('mode-activate', async (event, { modeId }) => {
    const { activateMode } = require('./modes/mode-engine');
    return await activateMode(modeId);
  });

  ipcMain.handle('mode-get-active', async () => {
    const { getActiveMode } = require('./modes/mode-engine');
    return getActiveMode();
  });

  // === Tool execution from AI ===
  ipcMain.handle('execute-tool', async (event, { tool, args }) => {
    const { executeTool } = require('./ai/tools');
    return await executeTool(tool, args);
  });

  // === Weather ===
  ipcMain.handle('weather-get', async (event, { city }) => {
    const Store = require('electron-store');
    const store = new Store();
    const apiKey = store.get('weatherApiKey', '');
    const { getWeather, weatherEmoji } = require('./weather');
    const data = await getWeather(city || store.get('weatherCity', 'Paris'), apiKey);
    if (!data.error) data.emoji = weatherEmoji(data.code);
    return data;
  });

  // === Habit heatmap ===
  ipcMain.handle('habits-heatmap', async (event, { habitId, year }) => {
    const { getHabitHeatmap } = require('./db/db');
    return getHabitHeatmap(habitId, year || new Date().getFullYear());
  });

  // === XP ===
  ipcMain.handle('xp-get', async () => {
    const { getXPTotal, getXPToday } = require('./db/db');
    return { ...getXPTotal(), today: getXPToday() };
  });

  ipcMain.handle('xp-add', async (event, { amount, reason }) => {
    const { addXP } = require('./db/db');
    return addXP(amount, reason || '');
  });

  // === Pomodoro (explicit session log) ===
  ipcMain.handle('pomodoro-done', async (event, { minutes, taskId }) => {
    const { logFocusSession, addXP } = require('./db/db');
    const session = logFocusSession(minutes, taskId, 'pomodoro');
    addXP(15, 'pomodoro_complete');
    return session;
  });

  // === Briefing (manual trigger) ===
  ipcMain.handle('briefing-trigger', async () => {
    const { triggerBriefing } = require('./briefing');
    await triggerBriefing(mainWindow);
    return { success: true };
  });

  // === GitHub ===
  ipcMain.handle('github-get', async () => {
    const Store = require('electron-store');
    const store = new Store();
    const token = store.get('githubToken', '');
    const { getGithubSummary } = require('./integrations/github');
    return await getGithubSummary(token);
  });

  // === News ===
  ipcMain.handle('news-get', async (event, { category, country }) => {
    const Store = require('electron-store');
    const store = new Store();
    const apiKey = store.get('newsApiKey', '');
    const { getTopHeadlines } = require('./integrations/news');
    return await getTopHeadlines(apiKey, category || 'technology', country || 'fr');
  });

  // === Brave Search ===
  ipcMain.handle('brave-search', async (event, { query, count }) => {
    const Store = require('electron-store');
    const store = new Store();
    // process.env en priorité — electron-store en fallback
    const apiKey = process.env.BRAVE_SEARCH_API_KEY
      || process.env.BRAVE_API_KEY
      || store.get('braveSearchKey', '');
    const { webSearch } = require('./integrations/brave-search');
    return await webSearch(query, apiKey, count || 5);
  });

  // === Notion ===
  ipcMain.handle('notion-search', async (event, { query }) => {
    const Store = require('electron-store');
    const store = new Store();
    const token = store.get('notionToken', '');
    const { searchPages } = require('./integrations/notion');
    return await searchPages(token, query || '');
  });

  ipcMain.handle('notion-create-page', async (event, { title, content }) => {
    const Store = require('electron-store');
    const store = new Store();
    const token = store.get('notionToken', '');
    const parentPageId = store.get('notionParentPageId', '');
    const { createPage } = require('./integrations/notion');
    return await createPage(token, parentPageId, title, content || '');
  });

  // === Badges ===
  ipcMain.handle('badges-get', async () => {
    const { getBadges } = require('./db/db');
    return getBadges();
  });

  ipcMain.handle('badges-check', async (event, { trigger }) => {
    const { checkAndAwardBadges } = require('./db/db');
    return checkAndAwardBadges(trigger);
  });

  ipcMain.handle('badge-award', async (event, { id }) => {
    const { awardBadge } = require('./db/db');
    return awardBadge(id);
  });

  // === Memory ===
  ipcMain.handle('memory-save', async (event, { key, value }) => {
    const { saveMemory } = require('./db/db');
    return saveMemory(key, value);
  });

  ipcMain.handle('memory-get', async (event, { key }) => {
    const { getMemory } = require('./db/db');
    return getMemory(key);
  });

  ipcMain.handle('memory-get-all', async () => {
    const { getAllMemories } = require('./db/db');
    return getAllMemories();
  });

  ipcMain.handle('memory-delete', async (event, { key }) => {
    const { deleteMemory } = require('./db/db');
    return deleteMemory(key);
  });

  ipcMain.handle('summary-save', async (event, { summary }) => {
    const { saveConversationSummary } = require('./db/db');
    return saveConversationSummary(summary);
  });

  ipcMain.handle('summary-get', async (event, { limit }) => {
    const { getRecentSummaries } = require('./db/db');
    return getRecentSummaries(limit || 5);
  });

  // === Mode Schedules ===
  ipcMain.handle('mode-schedule-get', async () => {
    const { getModeSchedules } = require('./db/db');
    return getModeSchedules();
  });

  ipcMain.handle('mode-schedule-save', async (event, { modeId, startHour, endHour, days, enabled }) => {
    const { saveModeSchedule } = require('./db/db');
    return saveModeSchedule(modeId, startHour, endHour, days, enabled);
  });

  ipcMain.handle('mode-schedule-delete', async (event, { modeId }) => {
    const { deleteModeSchedule } = require('./db/db');
    return deleteModeSchedule(modeId);
  });
}

module.exports = { setupIpcHandlers };
