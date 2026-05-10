const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to renderer via window.nexus
contextBridge.exposeInMainWorld('nexus', {
  // === Window controls ===
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
  },

  // === AI Chat ===
  ai: {
    chat: (messages, useCloud) => ipcRenderer.invoke('ai-chat', { messages, useCloud }),
    streamChat: (messages) => ipcRenderer.invoke('ai-chat-stream', { messages }),
    onStreamChunk: (callback) => ipcRenderer.on('ai-stream-chunk', (_, chunk) => callback(chunk)),
    onStreamDone: (callback) => ipcRenderer.on('ai-stream-done', () => callback()),
    offStream: () => {
      ipcRenderer.removeAllListeners('ai-stream-chunk');
      ipcRenderer.removeAllListeners('ai-stream-done');
    },
    executeTool: (tool, args) => ipcRenderer.invoke('execute-tool', { tool, args }),
  },

  // === TTS / Voice ===
  voice: {
    speak: (text, options) => ipcRenderer.invoke('tts-speak', { text, ...options }),
    stop: () => ipcRenderer.send('tts-stop'),
    transcribe: (audioBuffer) => ipcRenderer.invoke('stt-transcribe', audioBuffer),
  },

  // === Debug (logs renderer → terminal CMD) ===
  rlog: (msg) => ipcRenderer.send('renderer-log', msg),

  // === PC Control ===
  pc: {
    setVolume: (level) => ipcRenderer.invoke('pc-volume-set', { level }),
    getVolume: () => ipcRenderer.invoke('pc-volume-get'),
    setBrightness: (level) => ipcRenderer.invoke('pc-brightness-set', { level }),
    launchApp: (name) => ipcRenderer.invoke('pc-app-launch', { name }),
    closeApp: (name) => ipcRenderer.invoke('pc-app-close', { name }),
    listApps: () => ipcRenderer.invoke('pc-app-list'),
    createFile: (filePath, content) => ipcRenderer.invoke('pc-file-create', { filePath, content }),
    readFile: (filePath) => ipcRenderer.invoke('pc-file-read', { filePath }),
    openFile: (filePath) => ipcRenderer.invoke('pc-file-open', { filePath }),
    screenshot: () => ipcRenderer.invoke('pc-screenshot'),
    power: (action) => ipcRenderer.invoke('pc-power', { action }),
    openUrl: (url) => ipcRenderer.invoke('pc-open-url', { url }),
  },

  // === Database / Tasks ===
  tasks: {
    getAll: () => ipcRenderer.invoke('db-get-tasks'),
    create: (task) => ipcRenderer.invoke('db-create-task', task),
    update: (task) => ipcRenderer.invoke('db-update-task', task),
    delete: (id) => ipcRenderer.invoke('db-delete-task', { id }),
  },

  habits: {
    getAll: () => ipcRenderer.invoke('db-get-habits'),
    create: (habit) => ipcRenderer.invoke('db-create-habit', habit),
    toggle: (habitId, date) => ipcRenderer.invoke('db-toggle-habit', { habitId, date }),
    getHeatmap: (habitId, year) => ipcRenderer.invoke('habits-heatmap', { habitId, year }),
  },

  chat: {
    getHistory: (limit) => ipcRenderer.invoke('db-get-chat-history', { limit }),
    saveMessage: (message) => ipcRenderer.invoke('db-save-message', message),
  },

  // === Settings ===
  settings: {
    get: (key) => ipcRenderer.invoke('settings-get', { key }),
    set: (key, value) => ipcRenderer.invoke('settings-set', { key, value }),
    getAll: () => ipcRenderer.invoke('settings-get-all'),
  },

  // === System Info ===
  system: {
    info: () => ipcRenderer.invoke('system-info'),
  },

  // === Stats ===
  stats: {
    get: (period) => ipcRenderer.invoke('stats-get', { period }),
    logFocus: (minutes, taskId, mode) => ipcRenderer.invoke('stats-log-focus', { minutes, taskId, mode }),
  },

  // === Modes ===
  modes: {
    activate: (modeId) => ipcRenderer.invoke('mode-activate', { modeId }),
    getActive: () => ipcRenderer.invoke('mode-get-active'),
  },

  // === Weather ===
  weather: {
    get: (city) => ipcRenderer.invoke('weather-get', { city }),
  },

  // === XP / Gamification ===
  xp: {
    get: () => ipcRenderer.invoke('xp-get'),
    add: (amount, reason) => ipcRenderer.invoke('xp-add', { amount, reason }),
  },

  // === Pomodoro ===
  pomodoro: {
    done: (minutes, taskId) => ipcRenderer.invoke('pomodoro-done', { minutes, taskId }),
  },

  // === Briefing ===
  briefing: {
    trigger: () => ipcRenderer.invoke('briefing-trigger'),
  },

  // === GitHub ===
  github: {
    get: () => ipcRenderer.invoke('github-get'),
  },

  // === News ===
  news: {
    get: (category, country) => ipcRenderer.invoke('news-get', { category, country }),
  },

  // === Brave Search ===
  search: {
    web: (query, count) => ipcRenderer.invoke('brave-search', { query, count }),
  },

  // === Notion ===
  notion: {
    search: (query) => ipcRenderer.invoke('notion-search', { query }),
    createPage: (title, content) => ipcRenderer.invoke('notion-create-page', { title, content }),
  },

  // === Badges ===
  badges: {
    get: () => ipcRenderer.invoke('badges-get'),
    check: (trigger) => ipcRenderer.invoke('badges-check', { trigger }),
    award: (id) => ipcRenderer.invoke('badge-award', { id }),
  },

  // === Memory ===
  memory: {
    save: (key, value) => ipcRenderer.invoke('memory-save', { key, value }),
    get: (key) => ipcRenderer.invoke('memory-get', { key }),
    getAll: () => ipcRenderer.invoke('memory-get-all'),
    delete: (key) => ipcRenderer.invoke('memory-delete', { key }),
  },

  // === Conversation summaries ===
  summaries: {
    save: (summary) => ipcRenderer.invoke('summary-save', { summary }),
    get: (limit) => ipcRenderer.invoke('summary-get', { limit }),
  },

  // === Mode Schedules ===
  schedules: {
    get: () => ipcRenderer.invoke('mode-schedule-get'),
    save: (modeId, startHour, endHour, days, enabled) => ipcRenderer.invoke('mode-schedule-save', { modeId, startHour, endHour, days, enabled }),
    delete: (modeId) => ipcRenderer.invoke('mode-schedule-delete', { modeId }),
  },

  // === Events (main → renderer) ===
  on: (channel, callback) => {
    const allowed = ['toggle-chat', 'navigate', 'activate-mode', 'notification', 'morning-briefing'];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_, data) => callback(data));
    }
  },

  off: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
