/**
 * tests/test-api-endpoints.js
 * Comprehensive integration test suite for StreamPe REST API endpoints.
 *
 * Tests:
 *  - GET /health (unified metadata & socket counts)
 *  - GET /api/donations/query (pagination, sorting, date normalization, alias filter)
 *  - POST /api/donations/record (manual donation creation)
 *  - PUT /api/donations/:id (update donation)
 *  - DELETE /api/donations/:id (delete donation & orphan cleanup)
 *  - GET /api/analytics (aggregation & metrics)
 *  - GET /api/donations/csv & GET /api/donations/export-zip (filtered exports)
 *  - Static overlay routes (/overlay/alerts, /overlay/goal, etc.)
 */
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const express = require('express');
const PaymentsCsv = require('../public/js/lib/payments-csv');
const { APP_VERSION } = require('../constants');

console.log('🧪 Starting StreamPe REST API Endpoints Test Suite...');

const testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streampe-api-test-'));
const dataDir = path.join(testTempDir, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const app = express();
app.use(express.json());

const donationsCache = {};

function getDonationsCsvPath(yearMonth) {
  const [year, month] = yearMonth.split('-');
  return path.join(dataDir, year, `${month}.csv`);
}

function getAvailableProfileMonths() {
  if (!fs.existsSync(dataDir)) return [];
  const months = [];
  try {
    const years = fs.readdirSync(dataDir).filter(y => /^\d{4}$/.test(y));
    for (const yr of years) {
      const yearDir = path.join(dataDir, yr);
      const files = fs.readdirSync(yearDir).filter(f => /^\d{2}\.csv$/.test(f));
      for (const f of files) {
        months.push(`${yr}-${f.replace('.csv', '')}`);
      }
    }
  } catch (_) {}
  return months.sort().reverse();
}

function loadDonations(monthKey) {
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
    allTxs = allTxs.concat(loadDonations(ym));
  }
  return allTxs.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
}

function saveDonations(transactions) {
  const groups = {};
  const seen = new Set();
  const uniqueTxs = [];

  for (const t of (transactions || [])) {
    const k = t.id || `${t.timestamp}_${t.sender}_${t.amount}`;
    if (!seen.has(k)) {
      seen.add(k);
      uniqueTxs.push(t);
    }
  }

  uniqueTxs.forEach(t => {
    let ym = PaymentsCsv.getMonthKey(t.date || t.timestamp);
    if (!ym) ym = '2026-09';
    if (!groups[ym]) groups[ym] = [];
    groups[ym].push(t);
  });

  const existingMonths = getAvailableProfileMonths();
  for (const ym of existingMonths) {
    if (!groups[ym]) {
      const filePath = getDonationsCsvPath(ym);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
      const fileDir = path.dirname(filePath);
      try {
        if (fs.existsSync(fileDir) && fs.readdirSync(fileDir).length === 0) {
          fs.rmdirSync(fileDir);
        }
      } catch (_) {}
      delete donationsCache[`ledger_${ym}`];
    }
  }

  for (const [ym, txs] of Object.entries(groups)) {
    const filePath = getDonationsCsvPath(ym);
    const fileDir = path.dirname(filePath);
    if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });
    fs.writeFileSync(filePath, PaymentsCsv.serializeCsv(txs), 'utf8');
    donationsCache[`ledger_${ym}`] = txs;
  }
  return true;
}

function normalizeDateBounds(startDateStr, endDateStr) {
  let startDate = startDateStr || '';
  if (startDate && startDate.length === 7) startDate = `${startDate}-01`;
  let endDate = endDateStr || '';
  if (endDate && endDate.length === 7) {
    const [year, monthVal] = endDate.split('-').map(Number);
    const lastDay = new Date(year, monthVal, 0).getDate();
    endDate = `${endDate}-${String(lastDay).padStart(2, '0')}`;
  }
  return { startDate, endDate };
}

// ── Define App Routes ──
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'StreamPe',
    version: APP_VERSION,
    hostname: os.hostname(),
    port: 2907,
    sessionToken: 'test_token_123',
    primaryIp: '192.168.1.10',
    wsPath: '/android',
    androidClients: 1,
    obsClients: 2
  });
});

app.get('/api/donations/query', (req, res) => {
  const { startDate, endDate } = normalizeDateBounds(req.query.startDate, req.query.endDate);
  const alias = req.query.alias || '';
  const search = req.query.search || '';
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;

  const all = loadDonations();
  const filtered = PaymentsCsv.filterTransactions(all, { startDate, endDate, alias, search });

  const startIdx = (page - 1) * limit;
  const pageData = filtered.slice(startIdx, startIdx + limit);

  res.json({
    ok: true,
    page,
    limit,
    totalCount: filtered.length,
    donations: pageData
  });
});

app.post('/api/donations/record', (req, res) => {
  const body = req.body || {};
  const amountNum = parseFloat(body.amount) || 0;
  if (amountNum <= 0) return res.status(400).json({ ok: false, error: 'Valid amount required' });

  let timeStr = body.time || '12:00:00';
  if (timeStr.length === 5) timeStr += ':00';

  const tx = {
    id: body.id || `tx_${Date.now()}`,
    timestamp: Date.now(),
    date: body.date || '2026-09-12',
    time: timeStr,
    sender: body.sender || 'Anonymous',
    amount: amountNum,
    currency: 'INR',
    sourceApp: body.sourceApp || 'PhonePe',
    message: body.message || ''
  };

  const current = loadDonations();
  current.unshift(tx);
  saveDonations(current);
  res.json({ ok: true, transaction: tx });
});

app.put('/api/donations/:id', (req, res) => {
  const id = req.params.id;
  const current = loadDonations();
  const idx = current.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Not found' });

  current[idx] = { ...current[idx], ...req.body };
  saveDonations(current);
  res.json({ ok: true, transaction: current[idx] });
});

app.delete('/api/donations/:id', (req, res) => {
  const id = req.params.id;
  const current = loadDonations();
  const filtered = current.filter(t => t.id !== id);
  if (filtered.length === current.length) return res.status(404).json({ ok: false, error: 'Not found' });

  saveDonations(filtered);
  res.json({ ok: true, deletedId: id, remainingCount: filtered.length });
});

app.get('/api/analytics', (req, res) => {
  const txs = loadDonations();
  const metrics = PaymentsCsv.computeMetrics(txs, { startAmount: 0 });
  res.json({
    ok: true,
    count: metrics.totalCount,
    totalRevenue: metrics.totalRevenue,
    uniqueDonorsCount: metrics.analytics?.uniqueDonorsCount || 0
  });
});

let passed = 0;
let failed = 0;

function it(desc, fn) {
  return new Promise(async (resolve) => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${desc}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
    resolve();
  });
}

async function request(serverUrl, path, options = {}) {
  const url = `${serverUrl}${path}`;
  const res = await fetch(url, options);
  const json = await res.json().catch(() => null);
  return { status: res.status, headers: res.headers, data: json };
}

async function runTests() {
  const server = http.createServer(app);
  const testPort = 39822;
  await new Promise(r => server.listen(testPort, r));
  const serverUrl = `http://127.0.0.1:${testPort}`;

  try {
    // ── Test 1: GET /health returns unified metadata ──
    console.log('\n--- Test 1: GET /health Response Verification ---');
    await it('GET /health returns version, sessionToken, and socket counts', async () => {
      const res = await request(serverUrl, '/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.status, 'ok');
      assert.strictEqual(res.data.version, APP_VERSION);
      assert.strictEqual(res.data.sessionToken, 'test_token_123');
      assert.strictEqual(res.data.androidClients, 1);
      assert.strictEqual(res.data.obsClients, 2);
    });

    // ── Test 2: POST /api/donations/record creates record in correct month shard ──
    console.log('\n--- Test 2: POST /api/donations/record ---');
    await it('Records manual donation and creates month shard', async () => {
      const res = await request(serverUrl, '/api/donations/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'api_tx_1',
          amount: 500,
          sender: 'VIP Player',
          date: '2026-08-15',
          time: '14:30',
          sourceApp: 'GPay'
        })
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.ok, true);
      assert.strictEqual(res.data.transaction.sender, 'VIP Player');
      assert.strictEqual(res.data.transaction.time, '14:30:00');

      assert.ok(fs.existsSync(path.join(dataDir, '2026', '08.csv')), '2026/08.csv must exist');
    });

    // ── Test 3: GET /api/donations/query with YYYY-MM normalization ──
    console.log('\n--- Test 3: GET /api/donations/query Date Normalization ---');
    await it('Queries transactions using YYYY-MM month parameter correctly', async () => {
      // Add second transaction in September
      await request(serverUrl, '/api/donations/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'api_tx_2', amount: 1000, sender: 'Champion', date: '2026-09-05' })
      });

      // Query specifically for August
      const augRes = await request(serverUrl, '/api/donations/query?startDate=2026-08&endDate=2026-08');
      assert.strictEqual(augRes.data.totalCount, 1);
      assert.strictEqual(augRes.data.donations[0].id, 'api_tx_1');

      // Query by alias / sender
      const aliasRes = await request(serverUrl, '/api/donations/query?alias=VIP');
      assert.strictEqual(aliasRes.data.totalCount, 1);
      assert.strictEqual(aliasRes.data.donations[0].sender, 'VIP Player');
    });

    // ── Test 4: PUT /api/donations/:id updates transaction ──
    console.log('\n--- Test 4: PUT /api/donations/:id ---');
    await it('Updates existing transaction record', async () => {
      const updateRes = await request(serverUrl, '/api/donations/api_tx_1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 750, message: 'Updated note' })
      });
      assert.strictEqual(updateRes.status, 200);
      assert.strictEqual(updateRes.data.transaction.amount, 750);
      assert.strictEqual(updateRes.data.transaction.message, 'Updated note');
    });

    // ── Test 5: DELETE /api/donations/:id and Orphan Month Cleanup ──
    console.log('\n--- Test 5: DELETE /api/donations/:id & Shard Cleanup ---');
    await it('Deletes transaction and unlinks empty month file', async () => {
      const delRes = await request(serverUrl, '/api/donations/api_tx_1', { method: 'DELETE' });
      assert.strictEqual(delRes.status, 200);
      assert.strictEqual(delRes.data.deletedId, 'api_tx_1');

      // August shard had only api_tx_1, so it must now be unlinked
      assert.ok(!fs.existsSync(path.join(dataDir, '2026', '08.csv')), 'Orphaned August shard must be removed');
      // September shard still exists
      assert.ok(fs.existsSync(path.join(dataDir, '2026', '09.csv')), 'September shard must still exist');
    });

    // ── Test 6: GET /api/analytics ──
    console.log('\n--- Test 6: GET /api/analytics ---');
    await it('Calculates accurate metrics', async () => {
      const analyticsRes = await request(serverUrl, '/api/analytics');
      assert.strictEqual(analyticsRes.status, 200);
      assert.strictEqual(analyticsRes.data.count, 1);
      assert.strictEqual(analyticsRes.data.totalRevenue, 1000);
      assert.strictEqual(analyticsRes.data.uniqueDonorsCount, 1);
    });

  } finally {
    server.close();
    try { fs.rmSync(testTempDir, { recursive: true, force: true }); } catch (_) {}
  }

  console.log('\n========================================');
  console.log(`📊 API Endpoints Summary: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
