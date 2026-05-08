const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

function runPS(script) {
  return new Promise((resolve, reject) => {
    exec(
      `powershell.exe -NonInteractive -Command "${script.replace(/"/g, '\\"')}"`,
      { windowsHide: true, timeout: 10000 },
      (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout.trim());
      }
    );
  });
}

async function setVolume(level) {
  const clamped = Math.max(0, Math.min(100, Math.round(level)));
  // Use Windows Audio API via PowerShell
  const script = `
$obj = New-Object -ComObject WScript.Shell;
$vol = ${clamped};
# Calculate number of key presses (current volume to target)
$currentVol = [Math]::Round((Get-WmiObject -Query 'SELECT * FROM Win32_SoundDevice' | Measure-Object).Count);
Add-Type -TypeDefinition '
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int _VtblGap1_6();
    int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
    int _VtblGap2_1();
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int _VtblGap3_5();
}
[Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
class MMDeviceEnumerator {}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    int _VtblGap1_1();
    int GetDefaultAudioEndpoint(int dataFlow, int role, out System.IntPtr ppDevice);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
    int Activate(ref System.Guid iid, int dwClsCtx, System.IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
}
public class VolumeControl {
    public static void SetVolume(float vol) {
        var enumeratorType = Type.GetTypeFromCLSID(new System.Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"));
        var enumerator = (IMMDeviceEnumerator)System.Activator.CreateInstance(enumeratorType);
        enumerator.GetDefaultAudioEndpoint(0, 1, out System.IntPtr devicePtr);
        var device = (IMMDevice)Marshal.GetObjectForIUnknown(devicePtr);
        var iid = new System.Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
        device.Activate(ref iid, 23, System.IntPtr.Zero, out object epv);
        ((IAudioEndpointVolume)epv).SetMasterVolumeLevelScalar(vol, System.Guid.Empty);
    }
    public static float GetVolume() {
        var enumeratorType = Type.GetTypeFromCLSID(new System.Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"));
        var enumerator = (IMMDeviceEnumerator)System.Activator.CreateInstance(enumeratorType);
        enumerator.GetDefaultAudioEndpoint(0, 1, out System.IntPtr devicePtr);
        var device = (IMMDevice)Marshal.GetObjectForIUnknown(devicePtr);
        var iid = new System.Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
        device.Activate(ref iid, 23, System.IntPtr.Zero, out object epv);
        float vol = 0;
        ((IAudioEndpointVolume)epv).GetMasterVolumeLevelScalar(out vol);
        return vol;
    }
}
';
[VolumeControl]::SetVolume(${(clamped / 100).toFixed(2)})`;

  // Simpler approach using nircmd or powershell audio
  try {
    await runPS(`$audio = New-Object -ComObject WScript.Shell; Add-Type -AssemblyName presentationCore; [System.Windows.Media.MediaPlayer]`);
  } catch {}

  // Use simplest reliable method: set via Windows Audio mixer
  try {
    await runPS(`
$wshShell = New-Object -comObject wscript.shell;
$currentVol = (Get-WmiObject -Namespace root/wmi -Class WMIACPI_audio | Select -First 1).Volume;
`);
  } catch {}

  // Most reliable: use nircmd approach via PowerShell COM
  const simpleScript = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class AudioControl {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

    public static void SetSystemVolume(int targetPercent) {
        // Reset to 0 first, then set
        for(int i = 0; i < 50; i++) keybd_event(0xAE, 0, 0, 0); // Volume down x50
        int steps = (int)Math.Round(targetPercent / 2.0);
        for(int i = 0; i < steps; i++) keybd_event(0xAF, 0, 0, 0); // Volume up
    }
}
'@;
[AudioControl]::SetSystemVolume(${clamped})`;

  try {
    await runPS(simpleScript.replace(/\n/g, ' '));
    return { success: true, level: clamped };
  } catch (err) {
    // Fallback: use mute key combination
    throw new Error(`Impossible de régler le volume: ${err.message}`);
  }
}

async function getVolume() {
  try {
    const script = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int _VtblGap1_6();
    int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
    int _VtblGap2_1();
    int GetMasterVolumeLevelScalar(out float pfLevel);
}
[Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
class MMDeviceEnumerator {}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    int _VtblGap1_1();
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IntPtr ppDevice);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
    int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
}
public class Vol {
    public static float Get() {
        var t = Type.GetTypeFromCLSID(new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"));
        var e = (IMMDeviceEnumerator)Activator.CreateInstance(t);
        e.GetDefaultAudioEndpoint(0, 1, out IntPtr dp);
        var d = (IMMDevice)Marshal.GetObjectForIUnknown(dp);
        var id = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
        d.Activate(ref id, 23, IntPtr.Zero, out object o);
        float v = 0; ((IAudioEndpointVolume)o).GetMasterVolumeLevelScalar(out v); return v * 100;
    }
}
'@;
[Math]::Round([Vol]::Get())`;
    const result = await runPS(script.replace(/\n/g, ' '));
    return parseInt(result) || 50;
  } catch {
    return 50;
  }
}

async function setBrightness(level) {
  const clamped = Math.max(0, Math.min(100, Math.round(level)));
  try {
    await runPS(`(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,${clamped})`);
    return { success: true, level: clamped };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function takeScreenshot() {
  const screenshotDir = path.join(os.homedir(), 'Pictures', 'NEXUS');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(screenshotDir, `nexus-${timestamp}.png`);

  const script = `
Add-Type -AssemblyName System.Windows.Forms;
Add-Type -AssemblyName System.Drawing;
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;
$bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height);
$graphics = [System.Drawing.Graphics]::FromImage($bitmap);
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size);
$bitmap.Save('${outputPath.replace(/\\/g, '\\\\')}');
$graphics.Dispose(); $bitmap.Dispose();
Write-Output '${outputPath.replace(/\\/g, '\\\\')}'`;

  await runPS(script.replace(/\n/g, ' '));
  return outputPath;
}

async function powerAction(action) {
  const actions = {
    lock: 'rundll32.exe user32.dll,LockWorkStation',
    sleep: 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0',
    shutdown: 'shutdown /s /t 30',
    restart: 'shutdown /r /t 30',
    cancel_shutdown: 'shutdown /a',
  };

  const cmd = actions[action];
  if (!cmd) throw new Error(`Action inconnue: ${action}`);

  return new Promise((resolve, reject) => {
    exec(cmd, { windowsHide: true }, (err) => {
      if (err) reject(err);
      else resolve({ success: true, action });
    });
  });
}

module.exports = { setVolume, getVolume, setBrightness, takeScreenshot, powerAction };
