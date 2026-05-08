const { exec, spawn } = require('child_process');

// Common app name mappings
const APP_ALIASES = {
  'notepad': 'notepad.exe',
  'bloc-notes': 'notepad.exe',
  'explorateur': 'explorer.exe',
  'explorer': 'explorer.exe',
  'calculatrice': 'calc.exe',
  'calc': 'calc.exe',
  'chrome': 'chrome.exe',
  'firefox': 'firefox.exe',
  'edge': 'msedge.exe',
  'vscode': 'code.exe',
  'vs code': 'code.exe',
  'code': 'code.exe',
  'spotify': 'spotify.exe',
  'discord': 'discord.exe',
  'steam': 'steam.exe',
  'obs': 'obs64.exe',
  'terminal': 'wt.exe',
  'powershell': 'powershell.exe',
  'cmd': 'cmd.exe',
  'paint': 'mspaint.exe',
  'word': 'winword.exe',
  'excel': 'excel.exe',
  'powerpoint': 'powerpnt.exe',
  'outlook': 'outlook.exe',
  'teams': 'teams.exe',
  'zoom': 'zoom.exe',
  'slack': 'slack.exe',
  'notion': 'notion.exe',
  'task manager': 'taskmgr.exe',
  'gestionnaire des tâches': 'taskmgr.exe',
  'control panel': 'control.exe',
  'panneau de configuration': 'control.exe',
  'settings': 'ms-settings:',
  'paramètres': 'ms-settings:',
};

function resolveApp(name) {
  const lower = name.toLowerCase().trim();
  return APP_ALIASES[lower] || name;
}

async function launchApp(name) {
  const resolved = resolveApp(name);

  return new Promise((resolve, reject) => {
    // Handle ms- protocol URIs
    if (resolved.startsWith('ms-')) {
      exec(`start ${resolved}`, { windowsHide: true, shell: true }, (err) => {
        if (err) reject(new Error(`Impossible de lancer "${name}": ${err.message}`));
        else resolve({ success: true, app: name });
      });
      return;
    }

    // Use Start-Process for better Windows integration
    exec(
      `powershell.exe -NonInteractive -Command "Start-Process '${resolved.replace(/'/g, "''")}'"`,
      { windowsHide: true },
      (err) => {
        if (err) {
          // Fallback: direct exec
          exec(resolved, { windowsHide: true, shell: true }, (err2) => {
            if (err2) reject(new Error(`Impossible de lancer "${name}": ${err2.message}`));
            else resolve({ success: true, app: name });
          });
        } else {
          resolve({ success: true, app: name });
        }
      }
    );
  });
}

async function closeApp(name) {
  const processName = resolveApp(name).replace('.exe', '');

  return new Promise((resolve, reject) => {
    exec(
      `powershell.exe -NonInteractive -Command "Stop-Process -Name '${processName}' -Force -ErrorAction SilentlyContinue"`,
      { windowsHide: true },
      (err) => {
        if (err) reject(new Error(`Impossible de fermer "${name}": ${err.message}`));
        else resolve({ success: true, app: name });
      }
    );
  });
}

async function listRunningApps() {
  return new Promise((resolve) => {
    exec(
      `powershell.exe -NonInteractive -Command "Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object Name, Id, CPU, WorkingSet | ConvertTo-Json"`,
      { windowsHide: true, maxBuffer: 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve([]);
          return;
        }
        try {
          const processes = JSON.parse(stdout.trim());
          const list = Array.isArray(processes) ? processes : [processes];
          resolve(list.map(p => ({
            name: p.Name,
            pid: p.Id,
            cpu: p.CPU,
            memMB: Math.round(p.WorkingSet / 1024 / 1024),
          })));
        } catch {
          resolve([]);
        }
      }
    );
  });
}

async function focusWindow(name) {
  const script = `
$wshell = New-Object -ComObject wscript.shell;
$app = Get-Process | Where-Object { $_.Name -like '*${name}*' } | Select-Object -First 1;
if ($app) { $wshell.AppActivate($app.Id) }`;

  return new Promise((resolve) => {
    exec(`powershell.exe -NonInteractive -Command "${script.replace(/\n/g, ' ')}"`,
      { windowsHide: true },
      (err) => resolve({ success: !err })
    );
  });
}

module.exports = { launchApp, closeApp, listRunningApps, focusWindow };
