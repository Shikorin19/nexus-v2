const { app } = require('electron');
const Store = require('electron-store');

const store = new Store();

function setupAutoStart(appInstance) {
  const enabled = store.get('autoStart', true);
  setAutoStart(enabled, appInstance);
}

function setAutoStart(enabled, appInstance) {
  const instance = appInstance || app;

  if (process.platform !== 'win32') return;

  try {
    instance.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true,
      name: 'NEXUS',
      path: process.execPath,
      args: ['--hidden'],
    });

    store.set('autoStart', enabled);
    console.log(`[AutoStart] ${enabled ? 'Activé' : 'Désactivé'}`);
  } catch (err) {
    console.error('[AutoStart] Error:', err);
  }
}

function isAutoStartEnabled() {
  try {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  } catch {
    return store.get('autoStart', true);
  }
}

module.exports = { setupAutoStart, setAutoStart, isAutoStartEnabled };
