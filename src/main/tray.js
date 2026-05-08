const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

let trayInstance = null;
let currentState = 'idle'; // idle, listening, speaking

function createTray(mainWindow, appInstance) {
  const iconPath = path.join(__dirname, '../../assets/icons/tray-idle.png');

  // Create a simple colored icon if the file doesn't exist
  const icon = createFallbackIcon('#00f5ff');

  trayInstance = new Tray(icon);
  trayInstance.setToolTip('NEXUS — Agent IA Personnel');

  updateTrayMenu(mainWindow, appInstance);

  trayInstance.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return trayInstance;
}

function createFallbackIcon(color) {
  // Create a 16x16 colored PNG using raw pixel data
  // This is a simple approach that works without external deps
  try {
    const iconPath = path.join(__dirname, '../../assets/icons/');
    const fs = require('fs');
    if (fs.existsSync(path.join(iconPath, 'tray-idle.png'))) {
      return nativeImage.createFromPath(path.join(iconPath, 'tray-idle.png'));
    }
  } catch {}

  // Create minimal icon from base64 (16x16 cyan square)
  const CYAN_ICON_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6AUHCiYxF1DsqQAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAUklEQVQ4y2NgGDrgPwMDA4OKuoY4AwMDA4O6hro4AwMDA4O6hro4AwMDA4O6hro4AwMDA4O6hro4AwMDA4O6hro4AwMDA4O6hro4AwMDA4O6gQEAAAD//zQ/BEoAAAAASUVORK5CYII=';

  try {
    return nativeImage.createFromDataURL(`data:image/png;base64,${CYAN_ICON_BASE64}`);
  } catch {
    return nativeImage.createEmpty();
  }
}

function updateTrayMenu(mainWindow, appInstance) {
  if (!trayInstance) return;

  const Store = require('electron-store');
  const store = new Store();
  const activeMode = store.get('activeMode', 'aucun');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'NEXUS',
      enabled: false,
      icon: createFallbackIcon('#00f5ff'),
    },
    { type: 'separator' },
    {
      label: `Mode actif : ${activeMode}`,
      enabled: false,
    },
    {
      label: 'Changer de mode',
      submenu: [
        { label: '🎯 Travail / Focus', click: () => activateMode('travail', mainWindow) },
        { label: '🎮 Gaming', click: () => activateMode('gaming', mainWindow) },
        { label: '📚 Étude', click: () => activateMode('etude', mainWindow) },
        { label: '🌙 Détente', click: () => activateMode('detente', mainWindow) },
        { label: '🎨 Créatif', click: () => activateMode('creatif', mainWindow) },
        { label: '💪 Sport', click: () => activateMode('sport', mainWindow) },
        { label: '📖 Lecture', click: () => activateMode('lecture', mainWindow) },
        { label: '📺 Streaming', click: () => activateMode('streaming', mainWindow) },
      ],
    },
    { type: 'separator' },
    {
      label: 'Ouvrir NEXUS',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: 'Préférences',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('navigate', 'settings');
      },
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => {
        appInstance.isQuiting = true;
        appInstance.quit();
      },
    },
  ]);

  trayInstance.setContextMenu(contextMenu);
}

function activateMode(modeId, mainWindow) {
  mainWindow.webContents.send('activate-mode', { modeId });
}

function setTrayState(state) {
  currentState = state;
  if (!trayInstance) return;

  const colors = {
    idle: '#00f5ff',
    listening: '#00f5ff',
    speaking: '#b026ff',
    error: '#ff006e',
  };

  const tooltips = {
    idle: 'NEXUS — En attente',
    listening: 'NEXUS — Écoute...',
    speaking: 'NEXUS — Parle...',
    error: 'NEXUS — Erreur',
  };

  trayInstance.setToolTip(tooltips[state] || 'NEXUS');
}

module.exports = { createTray, updateTrayMenu, setTrayState };
