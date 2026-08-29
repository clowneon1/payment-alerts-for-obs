const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getDefaultAppDataDir } = require('./constants');

const GITHUB_REPO = 'clowneon1/streampe';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

let cachedRelease = null;
let lastCheckTime = 0;

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
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
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
    if (nameLower.endsWith('.zip') && (nameLower.includes('portable') || nameLower.includes('streampe') || nameLower.includes('windows'))) {
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

module.exports = {
  cleanVersionString,
  compareSemver,
  checkForUpdates,
  getUpdatesDir
};
