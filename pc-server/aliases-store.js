/**
 * StreamPe — Donor Aliases CSV Store
 *
 * Manages donor alias mappings stored in `data/aliases.csv` (sender,alias,note,updatedAt).
 * Maintains an in-memory O(1) case-insensitive lookup table for fast substitution
 * during live alerts and WebSocket payloads.
 */

const fs = require('fs');
const path = require('path');

let aliasesFilePath = '';
let nameToAlias = new Map(); // Lowercase sender -> { originalSender, alias, note, updatedAt }
let aliasToName = new Map(); // Lowercase alias -> originalSender

/**
 * Escape CSV fields according to RFC 4180 rules.
 */
function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Parse a CSV line handling quoted strings.
 */
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

/**
 * Initialize the Aliases Store with the base data directory.
 */
function initAliasesStore(dataDir) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  aliasesFilePath = path.join(dataDir, 'aliases.csv');
  loadAliasesFromDisk();
}

/**
 * Load `data/aliases.csv` into RAM lookup maps.
 */
function loadAliasesFromDisk() {
  nameToAlias.clear();
  aliasToName.clear();

  if (!aliasesFilePath || !fs.existsSync(aliasesFilePath)) {
    saveAliasesToDisk(); // Initialize empty file with header
    return;
  }

  try {
    const content = fs.readFileSync(aliasesFilePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

    // Skip header line if present
    const startIndex = lines.length > 0 && lines[0].toLowerCase().startsWith('sender,alias') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const parts = parseCsvLine(lines[i]);
      if (parts.length >= 2) {
        const sender = parts[0].trim();
        const alias = parts[1].trim();
        const note = parts[2] ? parts[2].trim() : '';
        const updatedAt = parts[3] ? parts[3].trim() : new Date().toISOString();

        if (sender && alias) {
          const entry = { sender, alias, note, updatedAt };
          nameToAlias.set(sender.toLowerCase(), entry);
          aliasToName.set(alias.toLowerCase(), sender);
        }
      }
    }
  } catch (err) {
    console.error('[AliasesStore] Error loading aliases.csv:', err.message);
  }
}

/**
 * Save current in-memory aliases map back to `data/aliases.csv`.
 */
function saveAliasesToDisk() {
  if (!aliasesFilePath) return;

  let csv = 'sender,alias,note,updatedAt\n';
  for (const entry of nameToAlias.values()) {
    csv += `${escapeCsvField(entry.sender)},${escapeCsvField(entry.alias)},${escapeCsvField(entry.note)},${escapeCsvField(entry.updatedAt)}\n`;
  }

  try {
    fs.writeFileSync(aliasesFilePath, csv, 'utf8');
  } catch (err) {
    console.error('[AliasesStore] Error saving aliases.csv:', err.message);
  }
}

/**
 * Get custom alias for a donor name (case-insensitive O(1) lookup).
 */
function getAlias(senderName) {
  if (!senderName) return '';
  const entry = nameToAlias.get(String(senderName).trim().toLowerCase());
  return entry ? entry.alias : '';
}

/**
 * Set or update a donor alias.
 */
function setAlias(senderName, alias, note = '') {
  if (!senderName || !alias) return false;
  const senderKey = String(senderName).trim().toLowerCase();
  const entry = {
    sender: String(senderName).trim(),
    alias: String(alias).trim(),
    note: String(note || '').trim(),
    updatedAt: new Date().toISOString()
  };

  nameToAlias.set(senderKey, entry);
  aliasToName.set(entry.alias.toLowerCase(), entry.sender);
  saveAliasesToDisk();
  return true;
}

/**
 * Delete a donor alias.
 */
function deleteAlias(senderName) {
  if (!senderName) return false;
  const senderKey = String(senderName).trim().toLowerCase();
  const entry = nameToAlias.get(senderKey);

  if (entry) {
    aliasToName.delete(entry.alias.toLowerCase());
    nameToAlias.delete(senderKey);
    saveAliasesToDisk();
    return true;
  }
  return false;
}

/**
 * Format donor name according to mode ('full', 'first_only', 'first_initial') and length limits.
 */
function formatDonorName(rawName, settings = {}) {
  let name = String(rawName || 'Anonymous').trim();
  if (!name) return 'Anonymous';

  // Apply Custom Alias Substitution if enabled
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

/**
 * Return all registered aliases array.
 */
function getAliases() {
  return Array.from(nameToAlias.values());
}

module.exports = {
  initAliasesStore,
  getAlias,
  setAlias,
  deleteAlias,
  formatDonorName,
  getAliases
};
