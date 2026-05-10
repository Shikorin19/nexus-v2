/**
 * NEXUS — secure-store
 *
 * Stockage chiffré des secrets (clés API) via Keytar (OS keychain).
 * Fallback automatique vers electron-store si keytar n'est pas compilé.
 *
 * Keytar stocke dans :
 *   Windows → Windows Credential Manager
 *   macOS   → Keychain
 *   Linux   → libsecret / KWallet
 *
 * Pour activer keytar :
 *   npm install keytar
 *   npx electron-rebuild -w keytar
 */

const SERVICE = 'nexus-v2-secrets';

// ── Chargement optionnel de keytar ───────────────────────────────────────────

let _keytar = null;
let _keytarTried = false;

function tryKeytar() {
  if (_keytarTried) return _keytar;
  _keytarTried = true;
  try {
    _keytar = require('keytar');
    console.log('[SecureStore] Keytar disponible — OS keychain actif');
  } catch {
    console.log('[SecureStore] Keytar non disponible — fallback electron-store');
  }
  return _keytar;
}

// ── Fallback : electron-store ────────────────────────────────────────────────

function getStore() {
  const Store = require('electron-store');
  return new Store({ name: 'nexus-secrets' });
}

// ── API publique ─────────────────────────────────────────────────────────────

/**
 * Lire un secret.
 * @param {string} key  Identifiant du secret (ex : 'weatherApiKey')
 * @returns {Promise<string>}
 */
async function getSecret(key) {
  const keytar = tryKeytar();
  if (keytar) {
    try {
      const val = await keytar.getPassword(SERVICE, key);
      if (val !== null) return val;
    } catch (e) {
      console.warn('[SecureStore] keytar.getPassword error:', e.message);
    }
  }
  // Lecture electron-store (migration transparente)
  const storeVal = getStore().get(key, '');
  return storeVal || '';
}

/**
 * Écrire un secret.
 * @param {string} key
 * @param {string} value
 */
async function setSecret(key, value) {
  const keytar = tryKeytar();
  if (keytar) {
    try {
      await keytar.setPassword(SERVICE, key, value);
      // Supprime la copie electron-store si elle existait (migration)
      getStore().delete(key);
      return;
    } catch (e) {
      console.warn('[SecureStore] keytar.setPassword error:', e.message);
    }
  }
  getStore().set(key, value);
}

/**
 * Supprimer un secret.
 */
async function deleteSecret(key) {
  const keytar = tryKeytar();
  if (keytar) {
    try { await keytar.deletePassword(SERVICE, key); } catch {}
  }
  getStore().delete(key);
}

module.exports = { getSecret, setSecret, deleteSecret };
