const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');
const { getDefaultAppDataDir } = require('./constants');

const GITHUB_REPO = 'clowneon1/streampe';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

let cachedRelease = null;
let lastCheckTime = 0;

let updateState = {
  status: 'idle', // 'idle' | 'downloading' | 'extracting' | 'ready' | 'error'
  progress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  targetVersion: '',
  error: null
};

function getUpdatesDir() {
  const baseDir = getDefaultAppDataDir ? getDefaultAppDataDir() : path.join(process.env.APPDATA || os.tmpdir(), 'StreamPe');
  const updatesDir = path.join(baseDir, 'updates');
  if (!fs.existsSync(updatesDir)) {
    fs.mkdirSync(updatesDir, { recursive: true });
  }
  return updatesDir;
}

/**
 * Normalizes semver string: "release-v2.1.0" -> "2.1.0", "v2.1.0-beta.1" -> "2.1.0-beta.1"
 */
function cleanVersionString(v) {
  if (!v) return '0.0.0';
  let cleaned = String(v).trim();
  if (cleaned.startsWith('release-v')) cleaned = cleaned.substring(9);
  else if (cleaned.startsWith('release-')) cleaned = cleaned.substring(8);
  else if (cleaned.startsWith('v')) cleaned = cleaned.substring(1);
  return cleaned;
}

/**
 * Compares two semantic version strings.
 */
function compareSemver(v1, v2) {
  const clean1 = cleanVersionString(v1);
  const clean2 = cleanVersionString(v2);

  const [core1, pre1] = clean1.split('-');
  const [core2, pre2] = clean2.split('-');

  const parts1 = core1.split('.').map(n => parseInt(n, 10) || 0);
  const parts2 = core2.split('.').map(n => parseInt(n, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  if (!pre1 && pre2) return 1;
  if (pre1 && !pre2) return -1;
  if (pre1 && pre2) {
    if (pre1 > pre2) return 1;
    if (pre1 < pre2) return -1;
  }

  return 0;
}

/**
 * Fetches latest release payload from GitHub Releases API
 */
function fetchLatestReleaseFromGitHub() {
  return new Promise((resolve, reject) => {
    const url = new URL(GITHUB_API_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: {
        'User-Agent': 'StreamPe-UpdateManager/2.2.0',
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return https.get(res.headers.location, { headers: { 'User-Agent': 'StreamPe-UpdateManager/2.2.0' } }, (redRes) => {
          let redData = '';
          redRes.on('data', chunk => { redData += chunk; });
          redRes.on('end', () => {
            try {
              resolve(JSON.parse(redData));
            } catch (e) {
              reject(new Error(`Failed to parse redirect release JSON: ${e.message}`));
            }
          });
        }).on('error', reject);
      }

      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`GitHub API returned status ${res.statusCode}: ${data}`));
        }
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error(`Failed to parse GitHub release JSON: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('GitHub API request timed out after 10s'));
    });
    req.end();
  });
}

/**
 * Checks for updates against currentVersion
 */
async function checkForUpdates(currentVersion = '2.1.0', forceRefresh = false) {
  const now = Date.now();
  let releaseData = cachedRelease;

  if (forceRefresh || !releaseData || (now - lastCheckTime > CACHE_TTL_MS)) {
    try {
      releaseData = await fetchLatestReleaseFromGitHub();
      cachedRelease = releaseData;
      lastCheckTime = now;
    } catch (err) {
      if (!cachedRelease) {
        return {
          ok: false,
          error: err.message,
          currentVersion,
          checkedAt: new Date().toISOString()
        };
      }
      releaseData = cachedRelease;
    }
  }

  const rawTag = releaseData.tag_name || releaseData.name || '';
  const latestVersion = cleanVersionString(rawTag);
  const isUpdateAvailable = compareSemver(latestVersion, currentVersion) > 0;

  const assets = {
    portableZip: null,
    companionApk: null,
    all: []
  };

  for (const asset of (releaseData.assets || [])) {
    const assetObj = {
      name: asset.name,
      size: asset.size,
      downloadUrl: asset.browser_download_url,
      downloadCount: asset.download_count,
      updatedAt: asset.updated_at
    };
    assets.all.push(assetObj);

    const nameLower = (asset.name || '').toLowerCase();
    if (nameLower.endsWith('.zip') && (nameLower.includes('portable') || nameLower.includes('streampe'))) {
      assets.portableZip = assetObj;
    } else if (nameLower.endsWith('.apk')) {
      assets.companionApk = assetObj;
    }
  }

  return {
    ok: true,
    currentVersion,
    latestVersion,
    updateAvailable: isUpdateAvailable,
    releaseName: releaseData.name || `StreamPe v${latestVersion}`,
    tagName: rawTag,
    releaseNotes: releaseData.body || '',
    releaseUrl: releaseData.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`,
    publishedAt: releaseData.published_at,
    prerelease: releaseData.prerelease || false,
    assets,
    cached: (now - lastCheckTime <= CACHE_TTL_MS && !forceRefresh),
    checkedAt: new Date(lastCheckTime).toISOString()
  };
}

/**
 * Downloads a file following redirects and tracks progress
 */
function downloadFileWithRedirects(fileUrl, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const makeRequest = (currentUrl) => {
      const parsed = new URL(currentUrl);
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': 'StreamPe-UpdateManager/2.2.0',
          'Accept': 'application/octet-stream'
        }
      };

      const req = https.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return makeRequest(res.headers.location);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;
        const fileStream = fs.createWriteStream(destPath);

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const progress = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
          if (onProgress) {
            onProgress(progress, downloadedBytes, totalBytes);
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => resolve({ destPath, totalBytes: downloadedBytes }));
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => { });
          reject(err);
        });
      });

      req.on('error', (err) => {
        fs.unlink(destPath, () => { });
        reject(err);
      });

      req.end();
    };

    makeRequest(fileUrl);
  });
}

/**
 * 1-Click Background Download & Staging
 */
async function downloadAndStageUpdate(customDownloadUrl = null) {
  const updatesDir = getUpdatesDir();
  const zipPath = path.join(updatesDir, 'StreamPe-update.zip');
  const stagedDir = path.join(updatesDir, 'staged');

  let downloadUrl = customDownloadUrl;
  let targetVersion = 'latest';

  if (!downloadUrl) {
    const checkResult = await checkForUpdates('0.0.0', true);
    if (!checkResult.ok || !checkResult.assets.portableZip) {
      throw new Error(checkResult.error || 'No desktop release bundle (.zip) found on GitHub');
    }
    downloadUrl = checkResult.assets.portableZip.downloadUrl;
    targetVersion = checkResult.latestVersion;
  }

  updateState = {
    status: 'downloading',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    targetVersion,
    error: null
  };

  try {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    if (fs.existsSync(stagedDir)) fs.rmSync(stagedDir, { recursive: true, force: true });
    fs.mkdirSync(stagedDir, { recursive: true });

    await downloadFileWithRedirects(downloadUrl, zipPath, (progress, downloaded, total) => {
      updateState.progress = progress;
      updateState.downloadedBytes = downloaded;
      updateState.totalBytes = total;
    });

    updateState.status = 'extracting';
    updateState.progress = 100;

    // Extract using PowerShell Expand-Archive
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${stagedDir}' -Force"`, {
      timeout: 60000
    });

    // Check if extracted contents are in a nested single subfolder
    const stagedEntries = fs.readdirSync(stagedDir);
    if (stagedEntries.length === 1 && fs.statSync(path.join(stagedDir, stagedEntries[0])).isDirectory()) {
      const nestedDir = path.join(stagedDir, stagedEntries[0]);
      for (const item of fs.readdirSync(nestedDir)) {
        fs.renameSync(path.join(nestedDir, item), path.join(stagedDir, item));
      }
      fs.rmdirSync(nestedDir);
    }

    updateState.status = 'ready';
    return {
      ok: true,
      stagedDir,
      zipPath,
      targetVersion
    };
  } catch (err) {
    updateState.status = 'error';
    updateState.error = err.message;
    throw err;
  }
}

/**
 * Returns current download/staging progress
 */
function getUpdateProgress() {
  return { ...updateState };
}

/**
 * Executes in-place replacement and restarts the application
 */
function applyUpdateAndRestart() {
  const updatesDir = getUpdatesDir();
  const stagedDir = path.join(updatesDir, 'staged');

  if (!fs.existsSync(stagedDir) || fs.readdirSync(stagedDir).length === 0) {
    throw new Error('No staged update found. Please download the update first.');
  }

  // Detect running app root directory & protect dev environment
  let targetDir = path.resolve(__dirname, '..');
  const exePath = process.execPath;
  const isDevMode = exePath.endsWith('node.exe') || exePath.endsWith('node') || fs.existsSync(path.join(targetDir, '.git'));

  if (!exePath.endsWith('node.exe') && !exePath.endsWith('node')) {
    targetDir = path.dirname(exePath);
  }

  // Safety guard: do not overwrite source repository in Dev mode
  if (isDevMode && fs.existsSync(path.join(targetDir, '.git'))) {
    return {
      ok: true,
      devMode: true,
      stagedDir,
      message: `Update files downloaded and staged safely in "${stagedDir}". Source repository was protected from overwrite.`
    };
  }

  const batPath = path.join(updatesDir, 'apply_update.bat');
  const batScript = [
    '@echo off',
    'chcp 65001 >nul',
    'title StreamPe Auto-Updater',
    'echo [StreamPe Updater] Applying update to: ' + targetDir,
    'echo [StreamPe Updater] Waiting for current instance to exit...',
    'timeout /t 2 /nobreak >nul',
    `xcopy /s /e /y /q "${stagedDir}\\*" "${targetDir}\\" >nul`,
    'echo [StreamPe Updater] Files updated successfully!',
    'echo [StreamPe Updater] Launching StreamPe...',
    `if exist "${targetDir}\\StreamPe.exe" (`,
    `    start "" "${targetDir}\\StreamPe.exe"`,
    `) else if exist "${targetDir}\\server.exe" (`,
    `    start "" "${targetDir}\\server.exe"`,
    `) else (`,
    `    cd /d "${targetDir}" && start "" npm start`,
    `)`,
    'timeout /t 1 /nobreak >nul',
    `del /f /q "${batPath}"`
  ].join('\r\n');

  fs.writeFileSync(batPath, batScript, 'utf8');

  // Spawn updater script completely detached from current Node/Tauri process
  const child = spawn('cmd.exe', ['/c', batPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false
  });
  child.unref();

  // Exit current process cleanly after short buffer to allow HTTP response to return
  setTimeout(() => {
    process.exit(0);
  }, 600);

  return { ok: true, message: 'Update script launched. StreamPe is restarting...' };
}

module.exports = {
  cleanVersionString,
  compareSemver,
  checkForUpdates,
  downloadAndStageUpdate,
  getUpdateProgress,
  applyUpdateAndRestart
};
