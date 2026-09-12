/**
 * sync-version.js
 * Reads version from package.json and syncs it to Cargo.toml, tauri.conf.json, and constants.js.
 * Called automatically by the "version" npm hook after `npm version <bump>`.
 */
const fs = require('fs');
const path = require('path');

const pkgPath    = path.resolve(__dirname, '..', 'package.json');
const cargoPath  = path.resolve(__dirname, '..', 'src-tauri', 'Cargo.toml');
const tauriPath  = path.resolve(__dirname, '..', 'src-tauri', 'tauri.conf.json');

const version = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;

// 1. Sync Cargo.toml
let cargo = fs.readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
fs.writeFileSync(cargoPath, cargo, 'utf8');

// 2. Sync tauri.conf.json
const tauriConf = JSON.parse(fs.readFileSync(tauriPath, 'utf8'));
tauriConf.version = version;
fs.writeFileSync(tauriPath, JSON.stringify(tauriConf, null, 2), 'utf8');

// 3. Sync constants.js
const constantsPath = path.resolve(__dirname, '..', 'constants.js');
if (fs.existsSync(constantsPath)) {
  let constants = fs.readFileSync(constantsPath, 'utf8');
  constants = constants.replace(/^const APP_VERSION\s*=\s*'[^']+';/m, `const APP_VERSION = '${version}';`);
  fs.writeFileSync(constantsPath, constants, 'utf8');
}

console.log(`✅ Synced PC server version ${version} → Cargo.toml, tauri.conf.json & constants.js`);

