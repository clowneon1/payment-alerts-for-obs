const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const PaymentsCsv = require('../public/js/lib/payments-csv.js');

console.log('🧪 Starting Month CSV Sharding & Multi-Month Persistence Test Suite...');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streampe-month-test-'));
const DATA_DIR = tempDir;

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

// ── Storage logic under test ─────────────────────────────────────────
const donationsCache = {};

function getTodayYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getDonationsCsvPath(profileNameOrYm, yearMonth) {
  let ym = yearMonth;
  if (!ym && profileNameOrYm && /^\d{4}-\d{2}$/.test(profileNameOrYm)) {
    ym = profileNameOrYm;
  }
  if (!ym) ym = getTodayYearMonth();
  const [year, month] = ym.split('-');
  return path.join(DATA_DIR, year, `${month}.csv`);
}

function getAvailableProfileMonths() {
  if (!fs.existsSync(DATA_DIR)) return [];
  const months = [];
  try {
    const years = fs.readdirSync(DATA_DIR).filter(y => /^\d{4}$/.test(y));
    for (const yr of years) {
      const yearDir = path.join(DATA_DIR, yr);
      const files = fs.readdirSync(yearDir).filter(f => /^\d{2}\.csv$/.test(f));
      for (const f of files) {
        const mo = f.replace('.csv', '');
        months.push(`${yr}-${mo}`);
      }
    }
  } catch (e) {}
  return months.sort().reverse();
}

function loadDonations(profileName, monthKey) {
  if (monthKey && monthKey !== 'all') {
    const filePath = getDonationsCsvPath(monthKey);
    if (fs.existsSync(filePath)) {
      return PaymentsCsv.parseCsv(fs.readFileSync(filePath, 'utf8'));
    }
    return [];
  }
  const allMonths = getAvailableProfileMonths();
  let allTxs = [];
  for (const ym of allMonths) {
    allTxs = allTxs.concat(loadDonations(null, ym));
  }
  return allTxs.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
}

function saveDonations(profileName, transactions) {
  const groups = {};
  const realTransactions = (transactions || []).filter(t => !t.simulated);
  const seen = new Set();
  const uniqueTxs = [];

  for (const t of realTransactions) {
    const k = t.id || `${t.timestamp}_${t.sender}_${t.amount}`;
    if (!seen.has(k)) {
      seen.add(k);
      uniqueTxs.push(t);
    }
  }

  uniqueTxs.forEach(t => {
    const rawTx = {
      ...t,
      sender: t.rawSender || t.sender
    };
    delete rawTx.rawSender;

    let ym = PaymentsCsv.getMonthKey(rawTx.timestamp || rawTx.date);
    if (!ym) ym = getTodayYearMonth();
    if (!groups[ym]) groups[ym] = [];
    groups[ym].push(rawTx);
  });

  for (const [ym, txs] of Object.entries(groups)) {
    const filePath = getDonationsCsvPath(ym);
    const fileDir = path.dirname(filePath);
    if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });
    const content = PaymentsCsv.serializeCsv(txs);
    fs.writeFileSync(filePath, content, 'utf8');
    donationsCache[`ledger_${ym}`] = txs;
  }
  return true;
}

function appendDonation(profileName, tx) {
  if (tx.simulated) return;

  let ym = PaymentsCsv.getMonthKey(tx.timestamp || tx.date);
  if (!ym) ym = getTodayYearMonth();

  const filePath = getDonationsCsvPath(ym);
  const cacheKey = `ledger_${ym}`;

  const fileDir = path.dirname(filePath);
  if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });

  const rawTx = { ...tx, sender: tx.rawSender || tx.sender };
  delete rawTx.rawSender;
  const row = PaymentsCsv.formatCsvRow(rawTx) + '\n';

  if (!fs.existsSync(filePath)) {
    const content = PaymentsCsv.serializeCsv([rawTx]);
    fs.writeFileSync(filePath, content, 'utf8');
    donationsCache[cacheKey] = [tx];
  } else {
    fs.appendFileSync(filePath, row, 'utf8');
    if (donationsCache[cacheKey]) {
      donationsCache[cacheKey].unshift(tx);
    } else {
      loadDonations(null, ym);
    }
  }
  return true;
}

// ── Test Cases ────────────────────────────────────────────────────────
console.log('\n--- Test 1: Historical Month File Creation & Persistence ---');
it('Creates initial month file (2026-08.csv) with transaction', () => {
  const txAug = {
    id: 'tx_aug_1',
    timestamp: 1786968000000, // 2026-08-15
    date: '2026-08-15',
    time: '12:00:00',
    sender: 'Aman',
    amount: 100,
    currency: 'INR',
    sourceApp: 'PhonePe',
    message: 'August donation'
  };
  appendDonation(null, txAug);

  const augPath = path.join(DATA_DIR, '2026', '08.csv');
  assert(fs.existsSync(augPath), '2026/08.csv must exist');
  const augTxs = loadDonations(null, '2026-08');
  assert.strictEqual(augTxs.length, 1);
  assert.strictEqual(augTxs[0].sender, 'Aman');
});

console.log('\n--- Test 2: New Month Append must NOT delete previous months ---');
it('Appends donation for new month (2026-09) without deleting 2026-08', () => {
  const txSep = {
    id: 'tx_sep_1',
    timestamp: 1788264000000, // 2026-09-01
    date: '2026-09-01',
    time: '10:00:00',
    sender: 'Vikram',
    amount: 500,
    currency: 'INR',
    sourceApp: 'GPay',
    message: 'September donation'
  };
  appendDonation(null, txSep);

  const augPath = path.join(DATA_DIR, '2026', '08.csv');
  const sepPath = path.join(DATA_DIR, '2026', '09.csv');

  assert(fs.existsSync(augPath), '2026/08.csv must STILL exist after 2026-09 creation');
  assert(fs.existsSync(sepPath), '2026/09.csv must exist');

  const allTxs = loadDonations();
  assert.strictEqual(allTxs.length, 2, 'Total transactions across all months must be 2');
  assert(allTxs.some(t => t.id === 'tx_aug_1'), 'August transaction preserved');
  assert(allTxs.some(t => t.id === 'tx_sep_1'), 'September transaction added');
});

console.log('\n--- Test 3: saveDonations on single month does not delete other months ---');
it('saveDonations for single month does not prune other historical months', () => {
  const txOct = {
    id: 'tx_oct_1',
    timestamp: 1790856000000, // 2026-10-01
    date: '2026-10-01',
    time: '10:00:00',
    sender: 'Priya',
    amount: 250,
    currency: 'INR',
    sourceApp: 'Paytm',
    message: 'October donation'
  };
  saveDonations(null, [txOct]);

  const augPath = path.join(DATA_DIR, '2026', '08.csv');
  const sepPath = path.join(DATA_DIR, '2026', '09.csv');
  const octPath = path.join(DATA_DIR, '2026', '10.csv');

  assert(fs.existsSync(augPath), '2026/08.csv must still exist');
  assert(fs.existsSync(sepPath), '2026/09.csv must still exist');
  assert(fs.existsSync(octPath), '2026/10.csv must exist');

  const allMonths = getAvailableProfileMonths();
  assert.deepStrictEqual(allMonths, ['2026-10', '2026-09', '2026-08']);
});

console.log('\n--- Test 4: New Year Rollover (2026 -> 2027) does NOT delete previous year ---');
it('Appends donation for new year (2027-01) creating data/2027/01.csv without touching 2026 data', () => {
  const txNewYear = {
    id: 'tx_jan_2027',
    timestamp: 1798761600000, // 2027-01-01
    date: '2027-01-01',
    time: '00:01:00',
    sender: 'Celebrator',
    amount: 1000,
    currency: 'INR',
    sourceApp: 'GPay',
    message: 'Happy New Year 2027'
  };
  appendDonation(null, txNewYear);

  const aug2026 = path.join(DATA_DIR, '2026', '08.csv');
  const sep2026 = path.join(DATA_DIR, '2026', '09.csv');
  const oct2026 = path.join(DATA_DIR, '2026', '10.csv');
  const jan2027 = path.join(DATA_DIR, '2027', '01.csv');

  assert(fs.existsSync(aug2026), '2026/08.csv must still exist');
  assert(fs.existsSync(sep2026), '2026/09.csv must still exist');
  assert(fs.existsSync(oct2026), '2026/10.csv must still exist');
  assert(fs.existsSync(jan2027), '2027/01.csv must be created');

  const allMonths = getAvailableProfileMonths();
  assert.deepStrictEqual(allMonths, ['2027-01', '2026-10', '2026-09', '2026-08']);

  const allTxs = loadDonations();
  assert.strictEqual(allTxs.length, 4, 'Total transactions across all years/months must be 4');
  assert(allTxs.some(t => t.id === 'tx_jan_2027'), '2027 transaction present');
  assert(allTxs.some(t => t.id === 'tx_aug_1'), '2026 August transaction preserved');
});

// Cleanup temp test directory
try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}

console.log('\n========================================');
console.log(`📊 Test Summary: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
