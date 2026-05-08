const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

function expandPath(filePath) {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  if (!path.isAbsolute(filePath)) {
    return path.join(os.homedir(), 'Documents', filePath);
  }
  return filePath;
}

async function createFile(filePath, content = '') {
  const resolved = expandPath(filePath);
  const dir = path.dirname(resolved);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(resolved, content, 'utf8');
  return { success: true, path: resolved };
}

async function readFile(filePath) {
  const resolved = expandPath(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Fichier introuvable: ${resolved}`);
  }
  const content = fs.readFileSync(resolved, 'utf8');
  return { success: true, content, path: resolved };
}

async function deleteFile(filePath) {
  const resolved = expandPath(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Fichier introuvable: ${resolved}`);
  }
  fs.unlinkSync(resolved);
  return { success: true, path: resolved };
}

async function listDirectory(dirPath) {
  const resolved = expandPath(dirPath || '~');
  if (!fs.existsSync(resolved)) {
    throw new Error(`Dossier introuvable: ${resolved}`);
  }
  const entries = fs.readdirSync(resolved, { withFileTypes: true });
  return {
    success: true,
    path: resolved,
    entries: entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'folder' : 'file',
      path: path.join(resolved, e.name),
    })),
  };
}

async function openExplorer(dirPath) {
  const resolved = expandPath(dirPath || '~');
  return new Promise((resolve) => {
    exec(`explorer.exe "${resolved}"`, { windowsHide: false }, () => {
      resolve({ success: true, path: resolved });
    });
  });
}

module.exports = { createFile, readFile, deleteFile, listDirectory, openExplorer };
