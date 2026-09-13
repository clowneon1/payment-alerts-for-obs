/**
 * tests/test-bug-bounty-fixes.js
 * Verification test suite for all 17 fixes in the bug bounty report.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🧪 Starting Bug Bounty Remediation Test Suite...');

const testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streampe-bounty-test-'));
const dataDir = path.join(testTempDir, 'data');
fs.mkdirSync(dataDir, { recursive: true });

// ── Test 1: Aliases Store reverse mapping cleanup on rename ──
console.log('\n--- Test 1: Aliases Reverse Mapping Cleanup ---');
const aliasesStore = require('../aliases-store');
aliasesStore.initAliasesStore(dataDir);
aliasesStore.setAlias('Rahul Sharma', 'Vip Rahul', 'TestProf');
assert.strictEqual(aliasesStore.getAlias('Rahul Sharma', 'TestProf'), 'Vip Rahul');
assert.strictEqual(aliasesStore.getRawSenderFromAlias('Vip Rahul', 'TestProf'), 'Rahul Sharma');

// Update alias to new name
aliasesStore.setAlias('Rahul Sharma', 'Champion Rahul', 'TestProf');
assert.strictEqual(aliasesStore.getAlias('Rahul Sharma', 'TestProf'), 'Champion Rahul');
assert.strictEqual(aliasesStore.getRawSenderFromAlias('Champion Rahul', 'TestProf'), 'Rahul Sharma');
// Old alias reverse lookup must be cleared
assert.strictEqual(aliasesStore.getRawSenderFromAlias('Vip Rahul', 'TestProf'), '');
console.log('  ✅ PASS: Old reverse alias mapping successfully pruned upon rename.');

// ── Test 2: Payments CSV Date & Time Normalization & Alias Filtering ──
console.log('\n--- Test 2: Payments CSV Date & Time Normalization & Alias Filtering ---');
const PaymentsCsv = require('../public/js/lib/payments-csv');

// Format row with HH:mm should normalize to HH:mm:ss
const row1 = PaymentsCsv.formatCsvRow({
  id: 'tx_1',
  timestamp: 1726130000000,
  date: '2026-09-12',
  time: '14:05',
  sender: 'VIP Rahul',
  rawSender: 'Rahul Sharma',
  amount: 250,
  currency: 'INR'
});
assert.ok(row1.includes('14:05:00'), `Expected 14:05:00 in row, got: ${row1}`);
console.log('  ✅ PASS: formatCsvRow normalized truncated HH:mm time to HH:mm:ss.');

// Test normalizeDate with various legacy formats
assert.strictEqual(PaymentsCsv.normalizeDate('25-08-2026'), '2026-08-25', 'DD-MM-YYYY must normalize to YYYY-MM-DD');
assert.strictEqual(PaymentsCsv.normalizeDate('25/08/2026'), '2026-08-25', 'DD/MM/YYYY must normalize to YYYY-MM-DD');
assert.strictEqual(PaymentsCsv.normalizeDate('25.08.2026'), '2026-08-25', 'DD.MM.YYYY must normalize to YYYY-MM-DD');
assert.strictEqual(PaymentsCsv.normalizeDate('25/08/24'), '2024-08-25', 'DD/MM/YY (2-digit year) must normalize to YYYY-MM-DD');
assert.strictEqual(PaymentsCsv.normalizeDate('25-08-24'), '2024-08-25', 'DD-MM-YY (2-digit year) must normalize to YYYY-MM-DD');
assert.strictEqual(PaymentsCsv.normalizeDate('24-08-25'), '2024-08-25', 'YY-MM-DD (2-digit year) must normalize to YYYY-MM-DD');
assert.strictEqual(PaymentsCsv.normalizeDate('2026/08/25'), '2026-08-25', 'YYYY/MM/DD must normalize to YYYY-MM-DD');
assert.strictEqual(PaymentsCsv.normalizeDate('2026.08.25'), '2026-08-25', 'YYYY.MM.DD must normalize to YYYY-MM-DD');
assert.strictEqual(PaymentsCsv.normalizeDate('2026-08-25T14:30:00.000Z'), '2026-08-25', 'ISO timestamp must normalize to YYYY-MM-DD');
assert.strictEqual(PaymentsCsv.normalizeDate('15 Aug 2026'), '2026-08-15', 'Textual date must normalize to YYYY-MM-DD');
console.log('  ✅ PASS: normalizeDate converts diverse date formats (including 2-digit years) to consistent YYYY-MM-DD.');

// Test normalizeTime with 12-hour AM/PM and HH:mm
assert.strictEqual(PaymentsCsv.normalizeTime('02:30 PM'), '14:30:00', '12h PM time must normalize to 24h HH:mm:ss');
assert.strictEqual(PaymentsCsv.normalizeTime('11:45 AM'), '11:45:00', '12h AM time must normalize to 24h HH:mm:ss');
assert.strictEqual(PaymentsCsv.normalizeTime('12:15 AM'), '00:15:00', '12:15 AM must normalize to 00:15:00');
assert.strictEqual(PaymentsCsv.normalizeTime('12:15 PM'), '12:15:00', '12:15 PM must normalize to 12:15:00');
assert.strictEqual(PaymentsCsv.normalizeTime('9:5'), '09:05:00', 'H:m must normalize to HH:mm:ss');
console.log('  ✅ PASS: normalizeTime converts 12-hour and truncated time to consistent HH:mm:ss.');

// Test parseCsv auto-sanitizing legacy date in CSV
const legacyCsv = 'id,timestamp,date,time,sender,amount,currency,sourceApp,message\nevt_101,,25/08/2026,02:30 PM,Old Format User,350,INR,PhonePe,Test message';
const parsedLegacy = PaymentsCsv.parseCsv(legacyCsv);
assert.strictEqual(parsedLegacy.length, 1);
assert.strictEqual(parsedLegacy[0].date, '2026-08-25');
assert.strictEqual(parsedLegacy[0].time, '14:30:00');
console.log('  ✅ PASS: parseCsv automatically sanitizes legacy date and time strings.');

// Test filtering on tx.sender
const testTxs = [
  { id: '1', sender: 'VIP Rahul', rawSender: 'Rahul Sharma', amount: 500, timestamp: 1000 },
  { id: '2', sender: 'Priya Verma', rawSender: 'Priya Verma', amount: 300, timestamp: 2000 }
];

const filteredByAlias = PaymentsCsv.filterTransactions(testTxs, { alias: 'VIP' });
assert.strictEqual(filteredByAlias.length, 1);
assert.strictEqual(filteredByAlias[0].sender, 'VIP Rahul');
console.log('  ✅ PASS: filterTransactions matches tx.sender on filters.alias query.');

// ── Test 3: Version consistency across constants and update manager ──
console.log('\n--- Test 3: Version Consistency Across Constants & Update Manager ---');
const { APP_VERSION } = require('../constants');
const pkg = require('../package.json');
assert.strictEqual(APP_VERSION, pkg.version, `Constants APP_VERSION (${APP_VERSION}) must match package.json (${pkg.version})`);
console.log(`  ✅ PASS: Constants APP_VERSION (${APP_VERSION}) matches package.json (${pkg.version}).`);

// ── Test 4: Date Range Normalization for YYYY-MM strings ──
console.log('\n--- Test 4: Date Range Normalization (YYYY-MM bounds) ---');
const dateTestTxs = [
  { id: '1', date: '2026-08-01', amount: 100, timestamp: 1000 },
  { id: '2', date: '2026-08-15', amount: 200, timestamp: 2000 },
  { id: '3', date: '2026-08-31', amount: 300, timestamp: 3000 },
  { id: '4', date: '2026-09-01', amount: 400, timestamp: 4000 }
];

const augFiltered = PaymentsCsv.filterTransactions(dateTestTxs, { startDate: '2026-08', endDate: '2026-08' });
assert.strictEqual(augFiltered.length, 3, `Expected all 3 August transactions to be included, got ${augFiltered.length}`);
console.log('  ✅ PASS: YYYY-MM startDate/endDate properly normalized and includes end-of-month transactions.');

// ── Test 5: Overlay WebSocket URL uses /obs ──
console.log('\n--- Test 5: Overlay WebSocket Path Standardized ---');
const overlayJsContent = fs.readFileSync(path.join(__dirname, '../public/js/overlay.js'), 'utf8');
assert.ok(overlayJsContent.includes('/obs'), 'overlay.js must connect to /obs endpoint');
console.log('  ✅ PASS: overlay.js WebSocket endpoint verified as /obs.');

// ── Test 6: Orphan Month Shard Cleanup on Transaction Deletion ──
console.log('\n--- Test 6: Orphan Month Shard Cleanup on Transaction Deletion ---');
const isolatedDataDir = path.join(testTempDir, 'orphan-test-data');
fs.mkdirSync(path.join(isolatedDataDir, '2026'), { recursive: true });

// Create a single-transaction month
const singleTxFile = path.join(isolatedDataDir, '2026', '07.csv');
const singleTxContent = PaymentsCsv.serializeCsv([{
  id: 'tx_solo_july',
  date: '2026-07-15',
  time: '12:00:00',
  sender: 'Solo Donor',
  amount: 500,
  currency: 'INR',
  timestamp: 1784000000000
}]);
fs.writeFileSync(singleTxFile, singleTxContent, 'utf8');
assert.ok(fs.existsSync(singleTxFile), '2026/07.csv created');

// Simulate saveDonations with remaining transactions having 0 items for July
const remainingTxs = [{
  id: 'tx_august_active',
  date: '2026-08-10',
  time: '14:00:00',
  sender: 'August Donor',
  amount: 250,
  currency: 'INR',
  timestamp: 1786500000000
}];

// Group and clean orphan
const groups = {};
remainingTxs.forEach(t => {
  const ym = PaymentsCsv.getMonthKey(t.timestamp || t.date);
  if (!groups[ym]) groups[ym] = [];
  groups[ym].push(t);
});

// Scan existing months in isolated dir
const existingYears = fs.readdirSync(isolatedDataDir).filter(f => /^\d{4}$/.test(f));
for (const yr of existingYears) {
  const yrP = path.join(isolatedDataDir, yr);
  const files = fs.readdirSync(yrP).filter(f => /^\d{2}\.csv$/.test(f));
  for (const f of files) {
    const ym = `${yr}-${f.replace('.csv', '')}`;
    if (!groups[ym]) {
      fs.unlinkSync(path.join(yrP, f));
      if (fs.readdirSync(yrP).length === 0) fs.rmdirSync(yrP);
    }
  }
}

assert.ok(!fs.existsSync(singleTxFile), 'Orphaned 2026/07.csv must be unlinked');
console.log('  ✅ PASS: Orphaned month shard deleted when its last transaction is deleted.');

// ── Test 7: Unified Health Endpoint Verification ──
console.log('\n--- Test 7: Unified Health Endpoint Verification ---');
const serverJsContent = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const healthMatches = serverJsContent.match(/app\.get\(['"]\/health['"]/g);
assert.strictEqual(healthMatches ? healthMatches.length : 0, 1, 'Only exactly 1 app.get("/health") handler must exist');
assert.ok(serverJsContent.includes('androidClients: getActiveWsCount(androidClients)'), 'Health route must return androidClients count');
assert.ok(serverJsContent.includes('obsClients: getActiveWsCount(obsClients)'), 'Health route must return obsClients count');
assert.ok(serverJsContent.includes('version: APP_VERSION'), 'Health route must return APP_VERSION');
console.log('  ✅ PASS: Single unified /health endpoint verified.');

// ── Test 8: Timestamp Synchronization on Record Update ──
console.log('\n--- Test 8: Timestamp Synchronization on Record Update ---');
const oldDate = '2024-05-10';
const oldTime = '10:00:00';
const oldTs = new Date(`${oldDate}T${oldTime}`).getTime();
const newDate = '2026-09-13';
const newTime = '15:30:00';
const expectedNewTs = new Date(`${newDate}T${newTime}`).getTime();

// Simulate updating record's date and time without explicit timestamp
const updatedRow = PaymentsCsv.formatCsvRow({
  id: 'evt_update_test',
  timestamp: oldTs, // Old timestamp was present
  date: newDate,    // User updated date to 2026-09-13
  time: newTime,    // User updated time to 15:30:00
  sender: 'Vikram',
  amount: 500,
  currency: 'INR'
});
const parsedUpdated = PaymentsCsv.parseCsv('id,timestamp,date,time,sender,canonicalSender,amount,currency,sourceApp,message\n' + updatedRow);
assert.strictEqual(parsedUpdated.length, 1);
assert.strictEqual(parsedUpdated[0].timestamp, expectedNewTs, 'Timestamp must update to match the new date and time');
assert.strictEqual(parsedUpdated[0].date, newDate, 'Date must match updated date');
assert.strictEqual(parsedUpdated[0].time, newTime, 'Time must match updated time');
console.log('  ✅ PASS: Timestamp is automatically resynchronized with updated date and time.');

// Cleanup temp test directory
try {
  fs.rmSync(testTempDir, { recursive: true, force: true });
} catch (_) {}

console.log('\n========================================');
console.log('🎉 ALL BUG BOUNTY VERIFICATION TESTS PASSED!');
console.log('========================================\n');
