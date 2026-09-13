const fs = require('fs');
const path = require('path');
const os = require('os');
const aliasesStore = require('../aliases-store');
const PaymentsCsv = require('../public/js/lib/payments-csv');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streampe-canonical-test-'));

console.log('🧪 Starting StreamPe Canonical Donor Matching & Normalization Test Suite...');
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
  aliasesStore.initAliasesStore(tempDir);

  // ── TEST 1: Canonical Key Normalization Functions ─────────────────────────
  console.log('\n--- Test 1: Canonical Key Normalization ---');
  const c1 = aliasesStore.canonicalDonorKey('D SINGH');
  const c2 = aliasesStore.canonicalDonorKey('D. SINGH');
  const c3 = aliasesStore.canonicalDonorKey('D.  SINGH ');
  const c4 = aliasesStore.canonicalDonorKey('d-singh');
  const c5 = aliasesStore.canonicalDonorKey('d_singh');

  assert(c1 === 'd singh', `c1 ('D SINGH') normalizes to 'd singh': got '${c1}'`);
  assert(c2 === 'd singh', `c2 ('D. SINGH') normalizes to 'd singh': got '${c2}'`);
  assert(c3 === 'd singh', `c3 ('D.  SINGH ') normalizes to 'd singh': got '${c3}'`);
  assert(c4 === 'd singh', `c4 ('d-singh') normalizes to 'd singh': got '${c4}'`);
  assert(c5 === 'd singh', `c5 ('d_singh') normalizes to 'd singh': got '${c5}'`);
  assert(c1 === c2 && c2 === c3 && c3 === c4 && c4 === c5, 'All dot/hyphen/space variations match identical canonical key');

  // Multi-initials test
  const ak1 = aliasesStore.canonicalDonorKey('A. K. Sharma');
  const ak2 = aliasesStore.canonicalDonorKey('A K Sharma');
  const ak3 = aliasesStore.canonicalDonorKey('A.K. Sharma');
  assert(ak1 === ak2 && ak2 === ak3 && ak1 === 'a k sharma', `Multi-initial variations ('A. K. Sharma' / 'A K Sharma' / 'A.K. Sharma') all map to 'a k sharma'`);

  // Unicode / Hindi Script Preserved
  const hindiName = 'राहुल कुमार';
  const hindiNorm = aliasesStore.canonicalDonorKey('  राहुल   कुमार  ');
  assert(hindiNorm === hindiName, `Hindi script preserved correctly without stripping: got '${hindiNorm}'`);

  // ── TEST 2: Cross-Banking Alias Resolution ───────────────────────────────
  console.log('\n--- Test 2: Cross-Banking App Alias Resolution ---');
  // Streamer sets alias for "D SINGH" in their Default profile
  aliasesStore.setAlias('D SINGH', 'Major Donator D 🌟', 'Default');

  // 1. PhonePe sends exact "D SINGH"
  const resPhonePe = aliasesStore.formatDonorName('D SINGH', {}, 'Default');
  assert(resPhonePe === 'Major Donator D 🌟', `PhonePe raw 'D SINGH' resolves to alias: '${resPhonePe}'`);

  // 2. Google Pay sends "D. SINGH" (with dot)
  const resGPay = aliasesStore.formatDonorName('D. SINGH', {}, 'Default');
  assert(resGPay === 'Major Donator D 🌟', `Google Pay raw 'D. SINGH' (with dot) resolves to alias: '${resGPay}'`);

  // 3. Paytm sends "D  SINGH" (with double space)
  const resPaytm = aliasesStore.formatDonorName('D  SINGH', {}, 'Default');
  assert(resPaytm === 'Major Donator D 🌟', `Paytm raw 'D  SINGH' (with double space) resolves to alias: '${resPaytm}'`);

  // 4. Bank transfer sends "d-singh" (with hyphen / lowercase)
  const resBank = aliasesStore.formatDonorName('d-singh', {}, 'Default');
  assert(resBank === 'Major Donator D 🌟', `Bank raw 'd-singh' resolves to alias: '${resBank}'`);

  // ── TEST 3: Deletion via any canonical variation ──────────────────────────
  console.log('\n--- Test 3: Alias Deletion via Canonical Key ---');
  aliasesStore.setAlias('Rahul Kumar', 'Top Supporter Rahul', 'Default');
  assert(aliasesStore.getAlias('Rahul.Kumar', 'Default') === 'Top Supporter Rahul', 'Can lookup alias using dotted name');

  const deleted = aliasesStore.deleteAlias('Rahul.Kumar', 'Default');
  assert(deleted === true, 'Alias deleted using dotted variation "Rahul.Kumar"');
  assert(aliasesStore.getAlias('Rahul Kumar', 'Default') === '', 'Original "Rahul Kumar" alias is now empty');

  // ── TEST 4: Leaderboard Merged Aggregation ────────────────────────────────
  console.log('\n--- Test 4: Leaderboard Metric Aggregation ---');
  // Simulate multiple transactions from different payment apps for the same person
  const txs = [
    { id: 'tx1', amount: 500, sender: aliasesStore.formatDonorName('D SINGH', {}, 'Default'), sourceApp: 'PhonePe' },
    { id: 'tx2', amount: 300, sender: aliasesStore.formatDonorName('D. SINGH', {}, 'Default'), sourceApp: 'Google Pay' },
    { id: 'tx3', amount: 200, sender: aliasesStore.formatDonorName('D  SINGH', {}, 'Default'), sourceApp: 'Paytm' },
    { id: 'tx4', amount: 1000, sender: 'Priya Sharma', sourceApp: 'PhonePe' }
  ];

  const metrics = PaymentsCsv.computeMetrics(txs);
  assert(metrics.totalRevenue === 2000, `Total revenue calculated as ₹2000: got ₹${metrics.totalRevenue}`);
  assert(metrics.analytics.uniqueDonorsCount === 2, `Unique donors count is 2 (Major Donator D + Priya Sharma): got ${metrics.analytics.uniqueDonorsCount}`);
  assert(metrics.supporters['Major Donator D 🌟'] === 1000, `Major Donator D combined total across 3 apps is ₹1000: got ₹${metrics.supporters['Major Donator D 🌟']}`);

  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log(`🎉 Canonical Donor Matching Test Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('─────────────────────────────────────────────────────────────────');

  if (testsFailed > 0) {
    process.exit(1);
  }
} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {}
}
