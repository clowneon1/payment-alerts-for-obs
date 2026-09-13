const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const aliasesStore = require('../aliases-store');
const PaymentsCsv = require('../public/js/lib/payments-csv');

// Create temporary directory for test isolation
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streampe-test-'));

console.log('🧪 Starting StreamPe Alias & ZIP Backup Workflow Test Suite...');
console.log('📁 Using temporary test directory:', tempDir);

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    testsFailed++;
  }
}

try {
  // ── TEST 1: Legacy Boot & Fallback to rawSender ─────────────────────────
  console.log('\n--- Test 1: Legacy Boot & Fallback to rawSender ---');
  aliasesStore.initAliasesStore(tempDir);

  const rawName = 'Rahul Kumar';
  const formattedNoAlias = aliasesStore.formatDonorName(rawName, {}, 'TestProfileA');
  assert(formattedNoAlias === 'Rahul Kumar', 'When aliases.csv does not exist, formatDonorName returns rawSender ("Rahul Kumar")');

  const aliasPathBefore = aliasesStore.getAliasesFilePath();
  assert(!fs.existsSync(aliasPathBefore), 'aliases.csv file does NOT exist on disk prior to setting first alias');

  // ── TEST 2: Centralized Alias Storage & File Creation ────────────────────
  console.log('\n--- Test 2: Centralized Alias Storage & File Creation ---');
  aliasesStore.setAlias('Rahul Kumar', 'Big Boss Rahul 👑');

  const aliasPathAfter = aliasesStore.getAliasesFilePath();
  assert(fs.existsSync(aliasPathAfter), 'data/aliases.csv is created on disk after setAlias()');

  const formattedProfileA = aliasesStore.formatDonorName('Rahul Kumar', {}, 'TestProfileA');
  assert(formattedProfileA === 'Big Boss Rahul 👑', 'Resolves alias to "Big Boss Rahul 👑" in ProfileA');

  const formattedProfileB = aliasesStore.formatDonorName('Rahul Kumar', {}, 'TestProfileB');
  assert(formattedProfileB === 'Big Boss Rahul 👑', 'Centralized alias also resolves to "Big Boss Rahul 👑" in ProfileB');

  // ── TEST 3: Raw CSV Disk Storage Isolation ────────────────────────────
  console.log('\n--- Test 3: Raw CSV Disk Storage Isolation ---');
  const sampleTx = {
    id: 'evt_test_1',
    timestamp: 1787916900000,
    date: '2026-08-28',
    time: '17:00:00',
    rawSender: 'Rahul Kumar',
    sender: 'Big Boss Rahul 👑',
    amount: 500,
    currency: 'INR',
    sourceApp: 'PhonePe',
    message: 'Awesome stream!'
  };

  const csvRow = PaymentsCsv.formatCsvRow(sampleTx);
  assert(csvRow.includes('Rahul Kumar') && !csvRow.includes('Big Boss Rahul 👑'), 'formatCsvRow writes rawSender ("Rahul Kumar") to CSV string, omitting alias');

  // ── TEST 4: Zero-Dependency ZIP Creation & Unzipping ─────────────────
  console.log('\n--- Test 4: ZIP Creation & Parsing Engine ---');
  
  class TestZipBuilder {
    constructor() { this.files = []; }
    addFile(filename, contentBuffer) {
      const buf = Buffer.isBuffer(contentBuffer) ? contentBuffer : Buffer.from(String(contentBuffer || ''), 'utf8');
      const filenameBuf = Buffer.from(filename, 'utf8');
      const crc = zlib.crc32 ? zlib.crc32(buf) : 0;
      const now = new Date();
      const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
      const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
      this.files.push({ name: filename, nameBuf: filenameBuf, content: buf, crc, dosTime, dosDate, uncompressedSize: buf.length, compressedSize: buf.length });
    }
    toBuffer() {
      const localHeaders = [], cdEntries = [];
      let offset = 0;
      for (const f of this.files) {
        const header = Buffer.alloc(30 + f.nameBuf.length);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(20, 4); header.writeUInt16LE(0, 6); header.writeUInt16LE(0, 8);
        header.writeUInt16LE(f.dosTime, 10); header.writeUInt16LE(f.dosDate, 12);
        header.writeUInt32LE(f.crc, 14); header.writeUInt32LE(f.compressedSize, 18);
        header.writeUInt32LE(f.uncompressedSize, 22); header.writeUInt16LE(f.nameBuf.length, 26);
        header.writeUInt16LE(0, 28); f.nameBuf.copy(header, 30);

        const cdEntry = Buffer.alloc(46 + f.nameBuf.length);
        cdEntry.writeUInt32LE(0x02014b50, 0);
        cdEntry.writeUInt16LE(20, 4); cdEntry.writeUInt16LE(20, 6); cdEntry.writeUInt16LE(0, 8); cdEntry.writeUInt16LE(0, 10);
        cdEntry.writeUInt16LE(f.dosTime, 12); cdEntry.writeUInt16LE(f.dosDate, 14);
        cdEntry.writeUInt32LE(f.crc, 16); cdEntry.writeUInt32LE(f.compressedSize, 20);
        cdEntry.writeUInt32LE(f.uncompressedSize, 24); cdEntry.writeUInt16LE(f.nameBuf.length, 28);
        cdEntry.writeUInt16LE(0, 30); cdEntry.writeUInt16LE(0, 32); cdEntry.writeUInt16LE(0, 34); cdEntry.writeUInt16LE(0, 36);
        cdEntry.writeUInt32LE(0, 38); cdEntry.writeUInt32LE(offset, 42); f.nameBuf.copy(cdEntry, 46);

        localHeaders.push(header, f.content); cdEntries.push(cdEntry);
        offset += header.length + f.content.length;
      }
      const cdStart = offset;
      let cdSize = 0; for (const cd of cdEntries) cdSize += cd.length;
      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
      eocd.writeUInt16LE(this.files.length, 8); eocd.writeUInt16LE(this.files.length, 10);
      eocd.writeUInt32LE(cdSize, 12); eocd.writeUInt32LE(cdStart, 16); eocd.writeUInt16LE(0, 20);
      return Buffer.concat([...localHeaders, ...cdEntries, eocd]);
    }
  }

  function testParseZipEntries(buffer) {
    const entries = [];
    if (!Buffer.isBuffer(buffer) || buffer.length < 30) return entries;
    let offset = 0;
    while (offset + 30 <= buffer.length) {
      const sig = buffer.readUInt32LE(offset);
      if (sig !== 0x04034b50) break;
      const compMethod = buffer.readUInt16LE(offset + 8);
      const compSize = buffer.readUInt32LE(offset + 18);
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLen);
      const dataStart = offset + 30 + nameLen + extraLen;
      const rawData = buffer.subarray(dataStart, dataStart + compSize);
      let content = (compMethod === 0) ? rawData.toString('utf8') : zlib.inflateRawSync(rawData).toString('utf8');
      entries.push({ name, content });
      offset = dataStart + compSize;
    }
    return entries;
  }

  const zip = new TestZipBuilder();
  zip.addFile('donations_ledger.csv', 'id,timestamp,date,time,sender,amount,currency,sourceApp,message\nevt_1,1787916900000,2026-08-28,17:00:00,Rahul Kumar,500.00,INR,PhonePe,Awesome stream!');
  zip.addFile('aliases.csv', 'sender,alias,updatedAt\nRahul Kumar,Big Boss Rahul 👑,2026-08-28T17:00:00.000Z');

  const zipBuffer = zip.toBuffer();
  assert(zipBuffer.length > 0 && zipBuffer.readUInt32LE(0) === 0x04034b50, 'ZIP Builder produces valid PKWARE (PK\x03\x04) magic header');

  const unpacked = testParseZipEntries(zipBuffer);
  assert(unpacked.length === 2, 'Unpacked ZIP contains exactly 2 files');
  assert(unpacked[0].name === 'donations_ledger.csv' && unpacked[1].name === 'aliases.csv', 'Unpacked filenames match expected entries');

  // ── TEST 5: Resilient Unpacking (Header Inspection) ──────────────────
  console.log('\n--- Test 5: Resilient Unpacking (Header Inspection) ---');
  let detectedLedger = false;
  let detectedAlias = false;

  for (const entry of unpacked) {
    const firstLine = entry.content.split(/\r?\n/)[0].toLowerCase();
    if (firstLine.includes('amount') || firstLine.includes('timestamp')) detectedLedger = true;
    if (firstLine.includes('alias') || firstLine.includes('nickname')) detectedAlias = true;
  }

  assert(detectedLedger, 'Header Inspection correctly identifies Transactions Ledger by column names');
  assert(detectedAlias, 'Header Inspection correctly identifies Donor Aliases by column names');

  // ── TEST 6: Deleted / Non-Existent File Export Resilience ─────────────
  console.log('\n--- Test 6: Non-Existent File & Empty Export Resilience ---');
  aliasesStore.deleteAlias('Rahul Kumar');
  const emptyAliases = aliasesStore.getAliases();
  assert(Array.isArray(emptyAliases) && emptyAliases.length === 0, 'getAliases after deleting alias returns empty array [] without throwing');

  let emptyCsvAliases = 'sender,alias,note,updatedAt\n';
  for (const entry of emptyAliases) {
    emptyCsvAliases += `${entry.sender},${entry.alias}\n`;
  }
  const emptyZip = new TestZipBuilder();
  emptyZip.addFile('donations_ledger.csv', PaymentsCsv.serializeCsv([]));
  emptyZip.addFile('aliases.csv', emptyCsvAliases);

  const emptyBuffer = emptyZip.toBuffer();
  assert(emptyBuffer.length > 0 && emptyBuffer.readUInt32LE(0) === 0x04034b50, 'Exporting empty/deleted profile produces clean valid ZIP buffer with CSV headers');

} catch (err) {
  console.error('💥 Test execution error:', err.stack);
  testsFailed++;
} finally {
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
}

console.log('\n========================================');
console.log(`📊 TEST RESULTS: ${testsPassed} Passed, ${testsFailed} Failed`);
console.log('========================================\n');

if (testsFailed > 0) process.exit(1);
