/**
 * StreamPe — Centralized Donor Aliases CSV Store
 *
 * Manages donor alias mappings stored centrally in `data/aliases.csv` (sender,alias,updatedAt).
 * Maintains an in-memory O(1) canonical lookup table for fast substitution
 * during live alerts and WebSocket payloads.
 */

const fs = require('fs');
const path = require('path');
const PaymentsCsv = require('./public/js/lib/payments-csv');

let baseDataDir = '';
// Centralized in-memory store
const centralStore = {
  nameToAlias: new Map(),
  aliasToName: new Map()
};

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

function getAliasesFilePath(_profileName) {
  return path.join(baseDataDir, 'aliases.csv');
}

function getStoreForProfile(_profileName) {
  return centralStore;
}

function loadAliasesFromFile(filePath) {
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
          centralStore.nameToAlias.set(canonicalDonorKey(sender), entry);
          centralStore.aliasToName.set(canonicalDonorKey(alias), sender);
        }
      }
    }
  } catch (err) {
    console.error(`[AliasesStore] Error loading aliases from ${filePath}:`, err.message);
  }
}

function initAliasesStore(dataDir) {
  baseDataDir = dataDir;
  if (!fs.existsSync(baseDataDir)) {
    fs.mkdirSync(baseDataDir, { recursive: true });
  }

  centralStore.nameToAlias.clear();
  centralStore.aliasToName.clear();

  // 1. Load centralized aliases.csv if present
  const mainAliasFile = path.join(baseDataDir, 'aliases.csv');
  if (fs.existsSync(mainAliasFile)) {
    loadAliasesFromFile(mainAliasFile);
  }

  // 2. Backward compatibility: auto-migrate any legacy profile folders (data/<profile>/aliases.csv)
  try {
    const entries = fs.readdirSync(baseDataDir, { withFileTypes: true });
    let migratedLegacy = false;
    for (const entry of entries) {
      if (entry.isDirectory() && !/^\d{4}$/.test(entry.name)) {
        const legacyFile = path.join(baseDataDir, entry.name, 'aliases.csv');
        if (fs.existsSync(legacyFile)) {
          loadAliasesFromFile(legacyFile);
          migratedLegacy = true;
        }
      }
    }
    if (migratedLegacy && centralStore.nameToAlias.size > 0) {
      saveAliases();
    }
  } catch (_) {}
}

function loadAliasesForProfile(_profileName) {
  const mainAliasFile = path.join(baseDataDir, 'aliases.csv');
  if (fs.existsSync(mainAliasFile)) {
    loadAliasesFromFile(mainAliasFile);
  }
}

function saveAliases() {
  if (!baseDataDir) return;
  if (!fs.existsSync(baseDataDir)) {
    fs.mkdirSync(baseDataDir, { recursive: true });
  }
  const filePath = path.join(baseDataDir, 'aliases.csv');

  let csv = 'sender,alias,updatedAt\n';
  for (const entry of centralStore.nameToAlias.values()) {
    csv += `${escapeCsvField(entry.sender)},${escapeCsvField(entry.alias)},${escapeCsvField(entry.updatedAt)}\n`;
  }

  try {
    fs.writeFileSync(filePath, csv, 'utf8');
  } catch (err) {
    console.error(`[AliasesStore] Error saving centralized aliases:`, err.message);
  }
}

function saveAliasesForProfile(_profileName) {
  saveAliases();
}

function getAlias(senderName, _profileName) {
  if (!senderName) return '';
  const entry = centralStore.nameToAlias.get(canonicalDonorKey(senderName));
  return entry ? entry.alias : '';
}

function setAlias(senderName, alias, _profileOrNote, _maybeProfile) {
  if (!senderName || !alias) return false;

  const senderKey = canonicalDonorKey(senderName);
  const entry = {
    sender: String(senderName).trim(),
    alias: String(alias).trim(),
    updatedAt: new Date().toISOString()
  };

  const oldEntry = centralStore.nameToAlias.get(senderKey);
  if (oldEntry && oldEntry.alias) {
    centralStore.aliasToName.delete(canonicalDonorKey(oldEntry.alias));
  }

  centralStore.nameToAlias.set(senderKey, entry);
  centralStore.aliasToName.set(canonicalDonorKey(entry.alias), entry.sender);
  saveAliases();
  return true;
}

function deleteAlias(senderName, _profileName) {
  if (!senderName) return false;
  const senderKey = canonicalDonorKey(senderName);
  const entry = centralStore.nameToAlias.get(senderKey);

  if (entry) {
    centralStore.aliasToName.delete(canonicalDonorKey(entry.alias));
    centralStore.nameToAlias.delete(senderKey);
    saveAliases();
    return true;
  }
  return false;
}

function formatDonorName(rawName, settings = {}, _profileName) {
  let name = String(rawName || 'Anonymous').trim();
  if (!name) return 'Anonymous';

  if (settings.enableAliases !== false) {
    const alias = getAlias(name);
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

function getRawSenderFromAlias(alias, _profileName) {
  if (!alias) return '';
  return centralStore.aliasToName.get(canonicalDonorKey(alias)) || '';
}

function getAliases(_profileName) {
  return Array.from(centralStore.nameToAlias.values());
}

module.exports = {
  canonicalDonorKey,
  initAliasesStore,
  getAlias,
  setAlias,
  deleteAlias,
  getRawSenderFromAlias,
  formatDonorName,
  getAliases,
  getStoreForProfile,
  loadAliasesForProfile,
  saveAliasesForProfile,
  saveAliases,
  getAliasesFilePath
};
