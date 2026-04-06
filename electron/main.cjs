const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');

let mainWindow = null;

const DEFAULT_PATCH_MANIFEST_URL = process.env.NEBULA_PATCH_MANIFEST_URL || '';
const DEFAULT_GITHUB_REPO = process.env.NEBULA_GITHUB_REPO || 'Churst86/nebula-havoc-copy';
const DEFAULT_GITHUB_ASSET_REGEX = process.env.NEBULA_GITHUB_ASSET_REGEX || 'Nebula-Havoc-.*\\.exe$';

function parseVersionNumber(version) {
  return String(version || '')
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isVersionGreater(a, b) {
  const av = parseVersionNumber(a);
  const bv = parseVersionNumber(b);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i += 1) {
    const ai = av[i] || 0;
    const bi = bv[i] || 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }
  return false;
}

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('Patch manifest URL is not configured.'));
      return;
    }
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, { headers }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Patch manifest request failed with status ${res.statusCode}.`));
        res.resume();
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('Patch manifest JSON is invalid.'));
        }
      });
    });
    req.on('error', (err) => reject(err));
  });
}

function buildPatchFromGithubRelease(release, repo, assetRegexText) {
  const tagVersion = release?.tag_name;
  if (!tagVersion) return null;

  let assetRegex = null;
  try {
    assetRegex = new RegExp(assetRegexText || DEFAULT_GITHUB_ASSET_REGEX, 'i');
  } catch {
    assetRegex = /\.exe$/i;
  }

  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const matchingAsset = assets.find((asset) => {
    const name = asset?.name || '';
    return assetRegex.test(name);
  }) || assets.find((asset) => /\.exe$/i.test(asset?.name || ''));

  if (!matchingAsset?.browser_download_url) return null;

  return {
    version: tagVersion,
    url: matchingAsset.browser_download_url,
    sha256: null,
    notes: release?.body || '',
    source: 'github',
    repo,
    assetName: matchingAsset.name || '',
  };
}

function downloadFile(url, destinationPath, expectedSha256, onProgress) {
  return new Promise(async (resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const out = fs.createWriteStream(destinationPath);

    const fail = (err) => {
      try {
        if (!out.destroyed) out.destroy();
        if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
      } catch {
        // Ignore cleanup errors.
      }
      reject(err instanceof Error ? err : new Error(String(err || 'Patch download failed.')));
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Nebula-Havoc-Updater',
          'Accept': 'application/octet-stream,application/json;q=0.9,*/*;q=0.8',
        },
      });

      const status = Number(response.status || 0);
      if (!response.ok) {
        fail(new Error(`Patch download failed with status ${status}.`));
        return;
      }

      const total = Number.parseInt(response.headers.get('content-length') || '0', 10) || 0;
      let received = 0;

      // Stream with progress when available.
      if (response.body && typeof response.body.getReader === 'function') {
        const reader = response.body.getReader();
        const pump = async () => {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = Buffer.from(value);
            received += chunk.length;
            hash.update(chunk);
            if (!out.write(chunk)) {
              await new Promise((resume) => out.once('drain', resume));
            }
            if (onProgress) {
              const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
              onProgress({ received, total, percent });
            }
          }
        };
        await pump();
      } else {
        // Fallback for environments without readable stream support.
        const arr = await response.arrayBuffer();
        const chunk = Buffer.from(arr);
        received = chunk.length;
        hash.update(chunk);
        out.write(chunk);
        if (onProgress) {
          const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 100;
          onProgress({ received, total, percent });
        }
      }

      out.end(() => {
        const digest = hash.digest('hex');
        if (expectedSha256 && String(expectedSha256).toLowerCase() !== digest.toLowerCase()) {
          fail(new Error('Patch checksum validation failed.'));
          return;
        }
        resolve({ path: destinationPath, sha256: digest });
      });
    } catch (err) {
      fail(err);
    }
  });
}

function buildApplyPatchScript(scriptPath, sourceExePath, destinationExePath) {
  const script = [
    '@echo off',
    'setlocal',
    `set "SRC=${sourceExePath}"`,
    `set "DST=${destinationExePath}"`,
    ':copy_retry',
    'copy /y "%SRC%" "%DST%" >nul 2>nul',
    'if errorlevel 1 (',
    '  timeout /t 1 /nobreak >nul',
    '  goto copy_retry',
    ')',
    'start "" "%DST%"',
    'del /q "%SRC%" >nul 2>nul',
    'del /q "%~f0" >nul 2>nul',
    'endlocal',
  ].join('\r\n');
  fs.writeFileSync(scriptPath, script, 'utf8');
}

function getDesktopSavePath() {
  return path.join(app.getPath('userData'), 'voidstorm-save.json');
}

function getDesktopExportDir() {
  const exeDir = path.dirname(app.getPath('exe'));
  return path.join(exeDir, 'save-exports');
}

function sanitizeExportFileName(fileName) {
  const base = String(fileName || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .trim();
  const withoutExt = base.replace(/\.json$/i, '');
  return `${withoutExt || 'save-export'}.json`;
}

function getLastPatchedVersionPath() {
  return path.join(app.getPath('userData'), 'last-patched-version.json');
}

function readLastPatchedVersion() {
  try {
    const p = getLastPatchedVersionPath();
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'))?.version || null;
  } catch {
    return null;
  }
}

function writeLastPatchedVersion(version) {
  try {
    const p = getLastPatchedVersionPath();
    fs.writeFileSync(p, JSON.stringify({ version, patchedAt: new Date().toISOString() }), 'utf8');
  } catch {
    // ignore
  }
}

ipcMain.on('desktop:save:read', (event) => {
  try {
    const savePath = getDesktopSavePath();
    if (!fs.existsSync(savePath)) {
      event.returnValue = null;
      return;
    }
    event.returnValue = fs.readFileSync(savePath, 'utf8');
  } catch {
    event.returnValue = null;
  }
});

ipcMain.on('desktop:save:write', (event, payload) => {
  try {
    const savePath = getDesktopSavePath();
    fs.mkdirSync(path.dirname(savePath), { recursive: true });
    fs.writeFileSync(savePath, String(payload ?? ''), 'utf8');
    event.returnValue = true;
  } catch {
    event.returnValue = false;
  }
});

ipcMain.on('desktop:save:delete', (event) => {
  try {
    const savePath = getDesktopSavePath();
    if (fs.existsSync(savePath)) fs.unlinkSync(savePath);
    event.returnValue = true;
  } catch {
    event.returnValue = false;
  }
});

ipcMain.handle('desktop:save:export-slot', async (_event, payload = {}) => {
  const json = payload?.json;
  const fileName = payload?.fileName;

  if (!json || typeof json !== 'string') {
    return { ok: false, error: 'No export data provided.' };
  }

  try {
    const exportDir = getDesktopExportDir();
    fs.mkdirSync(exportDir, { recursive: true });
    const finalName = sanitizeExportFileName(fileName);
    const filePath = path.join(exportDir, finalName);
    fs.writeFileSync(filePath, json, 'utf8');
    return { ok: true, filePath };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'Failed to export save file.',
    };
  }
});

ipcMain.handle('desktop:save:pick-import', async () => {
  try {
    const exportDir = getDesktopExportDir();
    fs.mkdirSync(exportDir, { recursive: true });

    const result = await dialog.showOpenDialog(mainWindow || undefined, {
      title: 'Import Save File',
      defaultPath: exportDir,
      properties: ['openFile'],
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePaths?.length) {
      return { ok: false, cancelled: true };
    }

    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf8');
    return { ok: true, filePath, content };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'Failed to open import dialog.',
    };
  }
});

ipcMain.handle('desktop:update:check', async (_event, payload = {}) => {
  const rawVersion = app.getVersion();
  const isDevBuild = rawVersion === '0.0.0';
  const lastPatchedVersion = readLastPatchedVersion();
  const currentVersion = (isDevBuild && lastPatchedVersion) ? lastPatchedVersion : rawVersion;
  const manifestUrl = payload.manifestUrl || DEFAULT_PATCH_MANIFEST_URL;
  const githubRepo = payload.githubRepo || DEFAULT_GITHUB_REPO;
  const githubAssetPattern = payload.githubAssetPattern || DEFAULT_GITHUB_ASSET_REGEX;

  if (!manifestUrl && !githubRepo) {
    return {
      ok: true,
      configured: false,
      updateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
      patch: null,
    };
  }

  // Dev build with no prior patch baseline — never show UPDATE AVAILABLE.
  // Show LOCAL BUILD badge in UI instead.
  if (isDevBuild && !lastPatchedVersion) {
    return {
      ok: true,
      configured: true,
      updateAvailable: false,
      isDevBuild: true,
      currentVersion,
      latestVersion: currentVersion,
      patch: null,
    };
  }
  try {
    let patch = null;
    let latestVersion = currentVersion;
    let configured = true;

    if (manifestUrl) {
      const manifest = await fetchJson(manifestUrl);
      latestVersion = manifest?.version;
      const downloadUrl = manifest?.url;
      if (!latestVersion || !downloadUrl) {
        return {
          ok: false,
          updateAvailable: false,
          error: 'Patch manifest is missing required fields: version and url.',
        };
      }
      patch = {
        version: latestVersion,
        url: downloadUrl,
        sha256: manifest.sha256 || null,
        notes: manifest.notes || '',
        source: 'manifest',
      };
    } else if (githubRepo) {
      const ghUrl = `https://api.github.com/repos/${githubRepo}/releases/latest`;
      const release = await fetchJson(ghUrl, {
        'User-Agent': 'Nebula-Havoc-Updater',
        'Accept': 'application/vnd.github+json',
      });
      patch = buildPatchFromGithubRelease(release, githubRepo, githubAssetPattern);
      if (!patch) {
        return {
          ok: false,
          updateAvailable: false,
          error: `No matching EXE asset found in latest GitHub release for ${githubRepo}.`,
        };
      }
      latestVersion = patch.version;
    } else {
      configured = false;
    }

    const updateAvailable = patch ? isVersionGreater(latestVersion, currentVersion) : false;
    return {
      ok: true,
      configured,
      updateAvailable,
      isDevBuild,
      currentVersion,
      latestVersion,
      patch: updateAvailable ? patch : null,
    };
  } catch (error) {
    return {
      ok: false,
      updateAvailable: false,
      error: error?.message || 'Failed to check for patch.',
    };
  }
});

ipcMain.handle('desktop:update:download', async (_event, patch = {}) => {
  const downloadUrl = patch?.url;
  const version = patch?.version || 'unknown';
  const sha256 = patch?.sha256 || null;
  if (!downloadUrl) {
    return { ok: false, error: 'Patch URL is missing.' };
  }

  try {
    const updatesDir = path.join(app.getPath('userData'), 'updates');
    fs.mkdirSync(updatesDir, { recursive: true });
    const sanitizedVersion = String(version).replace(/[^a-zA-Z0-9._-]/g, '_');
    const patchPath = path.join(updatesDir, `Nebula-Havoc-${sanitizedVersion}.exe`);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:update:progress', { stage: 'downloading', percent: 0, received: 0, total: 0 });
    }

    const result = await downloadFile(downloadUrl, patchPath, sha256, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop:update:progress', {
          stage: 'downloading',
          percent: progress.percent,
          received: progress.received,
          total: progress.total,
        });
      }
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:update:progress', { stage: 'downloaded', percent: 100, received: 0, total: 0 });
    }

    return {
      ok: true,
      patchPath: result.path,
      sha256: result.sha256,
      version,
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'Patch download failed.',
    };
  }
});

ipcMain.handle('desktop:update:apply-and-restart', async (_event, payload = {}) => {
  const patchPath = payload?.patchPath;
  const patchVersion = payload?.version || null;
  if (!patchPath || !fs.existsSync(patchPath)) {
    return { ok: false, error: 'Downloaded patch file was not found.' };
  }

  try {
    const targetExePath = process.execPath;
    const scriptPath = path.join(os.tmpdir(), `nebula-patch-${Date.now()}.cmd`);
    buildApplyPatchScript(scriptPath, patchPath, targetExePath);

    const child = spawn('cmd.exe', ['/c', scriptPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();

    if (patchVersion) writeLastPatchedVersion(patchVersion);
    setTimeout(() => app.quit(), 120);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'Failed to apply patch.',
    };
  }
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#050816',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('desktop:app:version', async () => {
  const rawVersion = app.getVersion();
  const isDevBuild = rawVersion === '0.0.0';
  const lastPatchedVersion = readLastPatchedVersion();
  return {
    ok: true,
    version: (isDevBuild && lastPatchedVersion) ? lastPatchedVersion : rawVersion,
    isDevBuild,
    lastPatchedVersion,
  };
});