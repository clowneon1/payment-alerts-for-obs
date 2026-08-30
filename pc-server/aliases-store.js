/**
 * StreamPe — Donor Aliases CSV Store
 *
 * Manages donor alias mappings stored in `data/<profile>/aliases.csv` (sender,alias,updatedAt).
 * Maintains an in-memory O(1) canonical lookup table for fast substitution
 * during live alerts and WebSocket payloads.
 */

const fs = require('fs');
const path = require('path');
const PaymentsCsv = require('./public/js/lib/payments-csv');

let baseDataDir = '';
// Per-profile cache: profileName -> { nameToAlias: Map, aliasToName: Map }
const profileStores = new Map();

function canonicalDonorKey(name) {
  if (PaymentsCsv && typeof PaymentsCsv.canonicalDonorKey === 'function') {
    return PaymentsCsv.canonicalDonorKey(name);
  }
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\.\-_,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function getAliasesFilePath(profileName) {
  const prof = profileName || 'Default';
  return path.join(baseDataDir, prof, 'aliases.csv');
}

function getStoreForProfile(profileName) {
  const prof = profileName || 'Default';
  if (!profileStores.has(prof)) {
    profileStores.set(prof, {
      nameToAlias: new Map(),
      aliasToName: new Map()
    });
    loadAliasesForProfile(prof);
  }
  return profileStores.get(prof);
}

function initAliasesStore(dataDir) {
  baseDataDir = dataDir;
  if (!fs.existsSync(baseDataDir)) {
    fs.mkdirSync(baseDataDir, { recursive: true });
  }
  // Pre-load all existing profile aliases from disk
  try {
    const entries = fs.readdirSync(baseDataDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const aliasFile = path.join(baseDataDir, entry.name, 'aliases.csv');
        if (fs.existsSync(aliasFile)) {
          loadAliasesForProfile(entry.name);
        }
      }
    }
  } catch (_) {}
}

function loadAliasesForProfile(profileName) {
  const prof = profileName || 'Default';
  let store = profileStores.get(prof);
  if (!store) {
    store = { nameToAlias: new Map(), aliasToName: new Map() };
    profileStores.set(prof, store);
  }
  store.nameToAlias.clear();
  store.aliasToName.clear();

  const filePath = getAliasesFilePath(prof);
  if (!fs.existsSync(filePath)) return;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    const startIndex = lines.length > 0 && lines[0].toLowerCase().startsWith('sender,alias') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const parts = parseCsvLine(lines[i]);
      if (parts.length >= 2) {
        const sender = parts[0].trim();
        const alias = parts[1].trim();
        const updatedAt = parts[2] ? parts[2].trim() : new Date().toISOString();

        if (sender && alias) {
          const entry = { sender, alias, updatedAt };
          store.nameToAlias.set(canonicalDonorKey(sender), entry);
          store.aliasToName.set(canonicalDonorKey(alias), sender);
        }
      }
    }
  } catch (err) {
    console.error(`[AliasesStore] Error loading aliases for profile ${prof}:`, err.message);
  }
}

function saveAliasesForProfile(profileName) {
  const prof = profileName || 'Default';
  const store = getStoreForProfile(prof);

  const targetDir = path.join(baseDataDir, prof);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const filePath = path.join(targetDir, 'aliases.csv');

  let csv = 'sender,alias,updatedAt\n';
  for (const entry of store.nameToAlias.values()) {
    csv += `${escapeCsvField(entry.sender)},${escapeCsvField(entry.alias)},${escapeCsvField(entry.updatedAt)}\n`;
  }

  try {
    fs.writeFileSync(filePath, csv, 'utf8');
  } catch (err) {
    console.error(`[AliasesStore] Error saving aliases for profile ${prof}:`, err.message);
  }
}

function getAlias(senderName, profileName = 'Default') {
  if (!senderName) return '';
  const prof = profileName || 'Default';
  const store = getStoreForProfile(prof);
  const entry = store.nameToAlias.get(canonicalDonorKey(senderName));
  return entry ? entry.alias : '';
}

function setAlias(senderName, alias, profileOrNote = 'Default', maybeProfile) {
  if (!senderName || !alias) return false;
  let prof = 'Default';
  if (typeof maybeProfile === 'string' && maybeProfile) {
    prof = maybeProfile;
  } else if (typeof profileOrNote === 'string' && profileOrNote) {
    prof = profileOrNote;
  }

  const store = getStoreForProfile(prof);
  const senderKey = canonicalDonorKey(senderName);
  const entry = {
    sender: String(senderName).trim(),
    alias: String(alias).trim(),
    updatedAt: new Date().toISOString()
  };

  store.nameToAlias.set(senderKey, entry);
  store.aliasToName.set(canonicalDonorKey(entry.alias), entry.sender);
  saveAliasesForProfile(prof);
  return true;
}

function deleteAlias(senderName, profileName = 'Default') {
  if (!senderName) return false;
  const prof = profileName || 'Default';
  const store = getStoreForProfile(prof);
  const senderKey = canonicalDonorKey(senderName);
  const entry = store.nameToAlias.get(senderKey);

  if (entry) {
    store.aliasToName.delete(canonicalDonorKey(entry.alias));
    store.nameToAlias.delete(senderKey);
    saveAliasesForProfile(prof);
    return true;
  }
  return false;
}

function formatDonorName(rawName, settings = {}, profileName = 'Default') {
  let name = String(rawName || 'Anonymous').trim();
  if (!name) return 'Anonymous';

  const prof = profileName || 'Default';
  if (settings.enableAliases !== false) {
    let alias = getAlias(name, prof);
    if (!alias && prof !== 'Default') {
      alias = getAlias(name, 'Default');
    }
    if (alias) {
      name = alias;
    }
  }

  const mode = settings.nameFormatMode || 'full';
  const maxLength = parseInt(settings.maxNameLength, 10) || 0;

  if (mode === 'first_only') {
    const parts = name.split(/\s+/);
    name = parts[0] || name;
  } else if (mode === 'first_initial') {
    const parts = name.split(/\s+/);
    if (parts.length > 1) {
      name = `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
    }
  }

  if (maxLength > 0 && name.length > maxLength) {
    name = name.substring(0, maxLength - 1) + '…';
  }

  return name;
}

function getAliases(profileName = 'Default') {
  const store = getStoreForProfile(profileName);
  return Array.from(store.nameToAlias.values());
}

module.exports = {
  canonicalDonorKey,
  initAliasesStore,
  getAlias,
  setAlias,
  deleteAlias,
  formatDonorName,
  getAliases,
  loadAliasesForProfile,
  saveAliasesForProfile,
  getAliasesFilePath
};
