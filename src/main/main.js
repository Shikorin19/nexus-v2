// ── Chargement des variables d'environnement (.env) ──────────────────────────
try { require('dotenv').config(); } catch (_) {}

const { app, BrowserWindow, ipcMain, shell, globalShortcut } = require('electron');

// Désactive la politique autoplay Chrome — nécessaire en dev (HTTP origin)
// V1 n'avait pas ce problème car chargé depuis file://
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
const path = require('path');

let mainWindow = null;
let tray = null;

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width : 1400,
    height: 900,
    minWidth : 960,
    minHeight: 640,
    frame          : false,
    backgroundColor: '#03050d',
    webPreferences: {
      preload         : path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration : false,
      sandbox         : false,
      // Dev : chargé depuis http://localhost → webSecurity bloque blob:/data: URLs pour médias
      // Prod : chargé depuis file:// → pas de restriction, webSecurity: true OK
      webSecurity     : process.env.NODE_ENV !== 'development',
    },
    show         : false,
    titleBarStyle: 'hidden',
  });

  // Dev → Vite dev server | Prod → fichier buildé
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Minimize to tray on close
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  return mainWindow;
}

app.whenReady().then(async () => {

  // ── 1. Fenêtre UI en PREMIER — toujours ouverte même si le backend plante
  createWindow();

  // ── 2. DB — optionnel, ne bloque pas l'UI si SQLite échoue
  try {
    const { initDB } = require('./db/db');
    initDB();
    console.log('[NEXUS] DB OK');
  } catch (err) {
    console.warn('[NEXUS] DB indisponible (better-sqlite3 non compilé) :', err.message);
    console.warn('[NEXUS] Lance "npx electron-rebuild -w better-sqlite3" pour activer le stockage.');
  }

  // ── 3. IPC handlers
  try {
    const { setupIpcHandlers } = require('./ipc-handlers');
    setupIpcHandlers(mainWindow);
  } catch (err) {
    console.warn('[NEXUS] IPC handlers partiels :', err.message);
  }

  // ── 4. Tray
  try {
    const { createTray } = require('./tray');
    tray = createTray(mainWindow, app);
  } catch (err) {
    console.warn('[NEXUS] Tray désactivé :', err.message);
  }

  // ── 5. Auto-start
  try {
    const { setupAutoStart } = require('./auto-start');
    setupAutoStart(app);
  } catch (err) {
    console.warn('[NEXUS] Auto-start désactivé :', err.message);
  }

  // ── 6. Briefing matin
  try {
    const { setupBriefing } = require('./briefing');
    setupBriefing(mainWindow);
  } catch (err) {
    console.warn('[NEXUS] Briefing désactivé :', err.message);
  }

  // ── 7. Scheduler de modes
  try {
    const { setupScheduler } = require('./scheduler');
    setupScheduler(mainWindow);
  } catch (err) {
    console.warn('[NEXUS] Scheduler désactivé :', err.message);
  }

  // ── 8. Raccourci global Ctrl+Espace
  try {
    globalShortcut.register('CommandOrControl+Space', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.webContents.send('toggle-chat');
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (err) {
    console.warn('[NEXUS] Raccourci global désactivé :', err.message);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Ne pas quitter sur Windows — l'app vit dans le tray
});

app.on('will-quit',    () => { globalShortcut.unregisterAll(); });
app.on('before-quit',  () => { app.isQuiting = true; });

module.exports = { getMainWindow: () => mainWindow };
