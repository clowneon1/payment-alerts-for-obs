const fs = require('fs');
const path = require('path');
const assert = require('assert');
const PaymentsCsv = require('../public/js/lib/payments-csv.js');

console.log('🧪 Starting StreamPe Lazy Month CSV Reader & RAM Eviction Test Suite...');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TEST_PROFILE = 'test_lazy_profile';
const TEST_PROFILE_DIR = path.join(DATA_DIR, TEST_PROFILE);

function cleanupTestDir() {
  if (fs.existsSync(TEST_PROFILE_DIR)) {
    fs.rmSync(TEST_PROFILE_DIR, { recursive: true, force: true });
  }
}

cleanupTestDir();

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// ── Mock storage helpers matching server.js ────────────────────────
function getDonationsCsvPath(profileName, yearMonth) {
  const profile = profileName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const [year, month] = yearMonth.split('-');
  return path.join(DATA_DIR, profile, year, `${month}.csv`);
}

function getAvailableProfileMonths(profileName) {
  const profile = profileName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const profileDir = path.join(DATA_DIR, profile);
  if (!fs.existsSync(profileDir)) return [];
  const months = [];
  const years = fs.readdirSync(profileDir).filter(y => /^\d{4}$/.test(y));
  for (const yr of years) {
    const yearDir = path.join(profileDir, yr);
    const files = fs.readdirSync(yearDir).filter(f => /^\d{2}\.csv$/.test(f));
    for (const f of files) {
      months.push(`${yr}-${f.replace('.csv', '')}`);
    }
  }
  return months.sort().reverse();
}

function getFilteredProfileMonths(profileName, filters = {}) {
  const allMonths = getAvailableProfileMonths(profileName);
  if (!allMonths.length) return [];

  const { month, specificDate, startDate, endDate } = filters;

  if (month && month !== 'all' && /^\d{4}-\d{2}$/.test(month)) {
    return allMonths.includes(month) ? [month] : [];
  }

  if (specificDate && /^\d{4}-\d{2}-\d{2}$/.test(specificDate)) {
    const targetYm = specificDate.substring(0, 7);
    return allMonths.includes(targetYm) ? [targetYm] : [];
  }

  const startYm = startDate && /^\d{4}-\d{2}/.test(startDate) ? startDate.substring(0, 7) : null;
  const endYm = endDate && /^\d{4}-\d{2}/.test(endDate) ? endDate.substring(0, 7) : null;

  if (startYm || endYm) {
    return allMonths.filter(ym => {
      if (startYm && ym < startYm) return false;
      if (endYm && ym > endYm) return false;
      return true;
    });
  }

  return allMonths;
}

function countMonthlyTransactionsFast(profileName, monthKey) {
  const filePath = getDonationsCsvPath(profileName, monthKey);
  try {
    if (!fs.existsSync(filePath)) return 0;
    const content = fs.readFileSync(filePath, 'utf8');
    let lines = 0;
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 10) lines++;
    }
    if (content.length > 0 && content.charCodeAt(content.length - 1) !== 10) lines++;
    return Math.max(0, lines - 1);
  } catch (_) {
    return 0;
  }
}

// ── Setup 24 Synthetic Monthly CSV Files (2 Years) ─────────────────
const dummyMonths = [
  '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06',
  '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12',
  '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
  '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'
];

dummyMonths.forEach(ym => {
  const filePath = getDonationsCsvPath(TEST_PROFILE, ym);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const [year, month] = ym.split('-');
  const txs = [];
  for (let d = 1; d <= 20; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    txs.push({
      id: `tx_${ym}_${dayStr}`,
      timestamp: String(new Date(`${dateStr}T12:00:00Z`).getTime()),
      date: dateStr,
      time: '12:00:00',
      sender: `Donor_${ym}_${dayStr}`,
      amount: String(100 * d),
      currency: 'INR',
      sourceApp: 'PhonePe',
      message: `Contribution ${d}`
    });
  }
  fs.writeFileSync(filePath, PaymentsCsv.serializeCsv(txs), 'utf8');
});

// ── Tests ─────────────────────────────────────────────────────────

console.log('\n--- Test 1: Date-Range Month Pruning ---');

it('Scans all 24 months when no date bounds are specified', () => {
  const months = getFilteredProfileMonths(TEST_PROFILE, { month: 'all' });
  assert.strictEqual(months.length, 24);
  assert.strictEqual(months[0], '2025-12');
  assert.strictEqual(months[23], '2024-01');
});

it('Prunes to exactly 1 month when exact month is requested', () => {
  const months = getFilteredProfileMonths(TEST_PROFILE, { month: '2024-06' });
  assert.deepStrictEqual(months, ['2024-06']);
});

it('Prunes to exactly 1 month when specificDate is requested', () => {
  const months = getFilteredProfileMonths(TEST_PROFILE, { specificDate: '2025-03-14' });
  assert.deepStrictEqual(months, ['2025-03']);
});

it('Prunes to 4 candidate months between startDate and endDate range', () => {
  const months = getFilteredProfileMonths(TEST_PROFILE, {
    startDate: '2024-09-10',
    endDate: '2024-12-25'
  });
  assert.deepStrictEqual(months, ['2024-12', '2024-11', '2024-10', '2024-09']);
});

it('Returns empty array when date bounds are completely out of range', () => {
  const months = getFilteredProfileMonths(TEST_PROFILE, {
    startDate: '2027-01-01',
    endDate: '2027-06-01'
  });
  assert.deepStrictEqual(months, []);
});

console.log('\n--- Test 2: Fast Line Counting ---');

it('Computes accurate transaction count from raw CSV stream without parsing', () => {
  const count = countMonthlyTransactionsFast(TEST_PROFILE, '2024-05');
  assert.strictEqual(count, 20);
});

console.log('\n--- Test 3: LRU Cache Eviction & Active Month Preservation ---');

const donationsCache = {};
const historicalKeys = [];
const MAX_HISTORICAL = 2;
const ACTIVE_YM = '2025-12';

function mockLoadDonations(profile, ym) {
  const cacheKey = `${profile}_${ym}`;
  if (donationsCache[cacheKey]) return donationsCache[cacheKey];

  const filePath = getDonationsCsvPath(profile, ym);
  const content = fs.readFileSync(filePath, 'utf8');
  const txs = PaymentsCsv.parseCsv(content);
  donationsCache[cacheKey] = txs;

  if (ym !== ACTIVE_YM) {
    const idx = historicalKeys.indexOf(cacheKey);
    if (idx !== -1) historicalKeys.splice(idx, 1);
    historicalKeys.push(cacheKey);

    while (historicalKeys.length > MAX_HISTORICAL) {
      const evicted = historicalKeys.shift();
      delete donationsCache[evicted];
    }
  }
  return txs;
}

it('Pins active month in cache while evicting oldest historical months', () => {
  // Load active month
  mockLoadDonations(TEST_PROFILE, ACTIVE_YM);
  assert.ok(donationsCache[`${TEST_PROFILE}_${ACTIVE_YM}`]);

  // Load historical month 1 (2024-01)
  mockLoadDonations(TEST_PROFILE, '2024-01');
  assert.ok(donationsCache[`${TEST_PROFILE}_2024-01`]);

  // Load historical month 2 (2024-02)
  mockLoadDonations(TEST_PROFILE, '2024-02');
  assert.ok(donationsCache[`${TEST_PROFILE}_2024-02`]);

  // Load historical month 3 (2024-03) -> 2024-01 should be evicted!
  mockLoadDonations(TEST_PROFILE, '2024-03');
  assert.strictEqual(donationsCache[`${TEST_PROFILE}_2024-01`], undefined);
  assert.ok(donationsCache[`${TEST_PROFILE}_2024-02`]);
  assert.ok(donationsCache[`${TEST_PROFILE}_2024-03`]);
  assert.ok(donationsCache[`${TEST_PROFILE}_${ACTIVE_YM}`]); // Active month never evicted!
});

console.log('\n--- Test 4: Early-Exit Reverse Reader Simulation ---');

it('Fulfills limit=50 query by reading only first 3 newest months instead of all 24', () => {
  const candidateMonths = getFilteredProfileMonths(TEST_PROFILE, { month: 'all' });
  let readMonthsCount = 0;
  let collected = [];
  const limit = 50;

  for (let i = 0; i < candidateMonths.length; i++) {
    const ym = candidateMonths[i];
    readMonthsCount++;
    const raw = mockLoadDonations(TEST_PROFILE, ym);
    collected = collected.concat(raw);
    if (collected.length >= limit) {
      break;
    }
  }

  // 20 items per month -> 3 months = 60 items >= 50
  assert.strictEqual(readMonthsCount, 3);
  assert.ok(readMonthsCount < candidateMonths.length);
  assert.ok(collected.length >= limit);
});

// Clean up test directory
cleanupTestDir();

console.log('\n========================================');
console.log(`📊 Lazy CSV Reader Test Summary: ${passed} passed, ${failed} failed`);
console.log('========================================');

if (failed > 0) process.exit(1);
