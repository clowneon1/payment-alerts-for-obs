const path = require('path');

const APP_NAME = 'StreamPe';
const APP_VERSION = '2.2.0';
const DEFAULT_PORT = 2907;
const FALLBACK_PORTS = [DEFAULT_PORT, 8876, 2708, 9091, 1001, 0];
const UDP_DISCOVERY_PORT = 58025;
const MDNS_SERVICE_TYPE = 'streampe';
const MDNS_LEGACY_SERVICE_TYPE = 'payment-alerts';
const MAX_REDOS_INPUT_LENGTH = 300;
const NETWORK_CHANGE_CHECK_INTERVAL_MS = 10000;
const ANDROID_HEARTBEAT_INTERVAL_MS = 5000;
const OBS_HEARTBEAT_INTERVAL_MS = 15000;

function getDefaultAppDataDir() {
  const appData = process.env.APPDATA || (
    process.platform === 'darwin'
      ? path.join(process.env.HOME || '', 'Library', 'Application Support')
      : path.join(process.env.HOME || '', '.config')
  );
  return path.join(appData, APP_NAME);
}

const DISCORD_URL = 'https://partially-practical.codepenguin.in';
const WEBSITE_URL = 'https://partially-practical.codepenguin.in';
const GITHUB_REPO_URL = 'https://github.com/clowneon1/streampe';

module.exports = {
  APP_NAME,
  APP_VERSION,
  DEFAULT_PORT,
  FALLBACK_PORTS,
  UDP_DISCOVERY_PORT,
  MDNS_SERVICE_TYPE,
  MDNS_LEGACY_SERVICE_TYPE,
  MAX_REDOS_INPUT_LENGTH,
  NETWORK_CHANGE_CHECK_INTERVAL_MS,
  ANDROID_HEARTBEAT_INTERVAL_MS,
  OBS_HEARTBEAT_INTERVAL_MS,
  DISCORD_URL,
  WEBSITE_URL,
  GITHUB_REPO_URL,
  getDefaultAppDataDir
};
