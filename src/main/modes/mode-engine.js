const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { launchApp, closeApp } = require('../pc-control/apps');
const { setVolume, setBrightness } = require('../pc-control/system');

const store = new Store();

function loadModePresets() {
  const presetsDir = path.join(__dirname, 'presets');
  const modes = {};

  const files = fs.readdirSync(presetsDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(presetsDir, file), 'utf8'));
      modes[content.id] = content;
    } catch (err) {
      console.error(`[Modes] Error loading ${file}:`, err);
    }
  }

  return modes;
}

async function activateMode(modeId) {
  const modes = loadModePresets();
  const mode = modes[modeId];
  if (!mode) throw new Error(`Mode inconnu: ${modeId}`);

  const actions = mode.actions || {};
  const results = [];

  // Volume
  if (actions.volume?.master !== undefined) {
    try {
      await setVolume(actions.volume.master);
      results.push(`Volume → ${actions.volume.master}%`);
    } catch (e) {
      results.push(`Volume: erreur (${e.message})`);
    }
  }

  // Brightness
  if (actions.brightness !== undefined) {
    try {
      await setBrightness(actions.brightness);
      results.push(`Luminosité → ${actions.brightness}%`);
    } catch (e) {
      results.push(`Luminosité: erreur`);
    }
  }

  // Launch apps
  if (actions.launch_apps?.length) {
    for (const appName of actions.launch_apps) {
      try {
        await launchApp(appName);
        results.push(`Lancé: ${appName}`);
      } catch {
        results.push(`Lancement échoué: ${appName}`);
      }
    }
  }

  // Close apps
  if (actions.close_apps?.length) {
    for (const appName of actions.close_apps) {
      try {
        await closeApp(appName);
        results.push(`Fermé: ${appName}`);
      } catch {}
    }
  }

  // Save active mode
  store.set('activeMode', modeId);
  store.set('activeModeData', mode);

  return {
    success: true,
    mode: mode.name,
    actions: results,
    ttsMessage: actions.tts_message || `Mode ${mode.name} activé.`,
  };
}

function getActiveMode() {
  return {
    id: store.get('activeMode', null),
    data: store.get('activeModeData', null),
  };
}

function getModes() {
  return loadModePresets();
}

module.exports = { activateMode, getActiveMode, getModes };
