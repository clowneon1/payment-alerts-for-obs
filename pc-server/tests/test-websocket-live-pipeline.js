/**
 * tests/test-websocket-live-pipeline.js
 * Comprehensive integration test suite for real-time WebSocket pipeline,
 * socket classification (/android vs /obs), duplicate IP eviction, and broadcast events.
 */
const assert = require('assert');
const http = require('http');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;

console.log('🧪 Starting StreamPe WebSocket Live Pipeline Test Suite...');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  return new Promise((resolve) => {
    try {
      const p = fn();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          console.log(`  ✅ PASS: ${desc}`);
          passed++;
          resolve();
        }).catch(err => {
          console.error(`  ❌ FAIL: ${desc}`);
          console.error(`     Error: ${err.message}`);
          failed++;
          resolve();
        });
      } else {
        console.log(`  ✅ PASS: ${desc}`);
        passed++;
        resolve();
      }
    } catch (err) {
      console.error(`  ❌ FAIL: ${desc}`);
      console.error(`     Error: ${err.message}`);
      failed++;
      resolve();
    }
  });
}

// ── Setup Mock WebSocket Server replicating server.js logic ──
const server = http.createServer();
const wss = new WebSocketServer({ server });

const obsClients = new Set();
const androidClients = new Set();

function getActiveWsCount(clientSet) {
  if (!clientSet || !(clientSet instanceof Set)) return 0;
  let count = 0;
  for (const ws of clientSet) {
    if (ws.readyState === 1) count++;
    else clientSet.delete(ws);
  }
  return count;
}

wss.on('connection', (ws, req) => {
  const url = req.url ? req.url.split('?')[0] : '/';
  const clientType = url === '/android' ? 'android' : 'obs';
  const rawIp = req.socket?.remoteAddress || '127.0.0.1';
  const normIp = rawIp.replace(/^::ffff:/, '');

  if (clientType === 'android') {
    // Evict duplicate android sockets from same IP
    for (const existing of androidClients) {
      if (existing === ws) continue;
      const existingNormIp = (existing.remoteIp || '').replace(/^::ffff:/, '');
      if (existing.readyState !== 1 || (normIp && existingNormIp === normIp)) {
        androidClients.delete(existing);
        try { existing.terminate(); } catch (_) { }
      }
    }
    ws.remoteIp = normIp;
    androidClients.add(ws);
    ws.isAlive = true;

    ws.on('message', (data) => {
      try {
        const notification = JSON.parse(data.toString());
        const decorated = {
          type: 'payment_notification',
          amount: notification.amount || '0',
          sender: notification.sender || 'Anonymous',
          sourceApp: notification.sourceApp || 'UPI'
        };
        const payload = JSON.stringify(decorated);
        obsClients.forEach(c => {
          if (c.readyState === 1) c.send(payload);
        });
      } catch (_) {}
    });

    ws.on('close', () => { androidClients.delete(ws); });
  } else {
    getActiveWsCount(obsClients);
    obsClients.add(ws);
    ws.send(JSON.stringify({ type: 'SETTINGS_UPDATED', payload: { version: '2.2.8' } }));
    ws.on('close', () => { obsClients.delete(ws); });
  }
});

async function runTests() {
  const testPort = 39821;
  await new Promise((res) => server.listen(testPort, res));

  try {
    // ── Test 1: Socket Classification (/obs vs /android) ──
    console.log('\n--- Test 1: Socket Classification & Handshake ---');
    await it('Classifies /android and /obs WebSocket endpoints correctly', async () => {
      const obsWs = new WebSocket(`ws://127.0.0.1:${testPort}/obs`);
      const androidWs = new WebSocket(`ws://127.0.0.1:${testPort}/android`);

      await new Promise(r => obsWs.on('open', r));
      await new Promise(r => androidWs.on('open', r));

      assert.strictEqual(getActiveWsCount(obsClients), 1, 'OBS clients count must be 1');
      assert.strictEqual(getActiveWsCount(androidClients), 1, 'Android clients count must be 1');

      obsWs.close();
      androidWs.close();
      await new Promise(r => setTimeout(r, 50));
    });

    // ── Test 2: Duplicate Android IP Connection Eviction ──
    console.log('\n--- Test 2: Duplicate IP Eviction ---');
    await it('Evicts stale Android socket when new connection arrives from same IP', async () => {
      const client1 = new WebSocket(`ws://127.0.0.1:${testPort}/android`);
      await new Promise(r => client1.on('open', r));
      assert.strictEqual(getActiveWsCount(androidClients), 1);

      let client1Closed = false;
      client1.on('close', () => { client1Closed = true; });

      // Connect 2nd socket from same IP
      const client2 = new WebSocket(`ws://127.0.0.1:${testPort}/android`);
      await new Promise(r => client2.on('open', r));

      await new Promise(r => setTimeout(r, 50));
      assert.strictEqual(getActiveWsCount(androidClients), 1, 'Only 1 active socket should remain');
      assert.ok(client1Closed, 'First client must have been terminated');

      client2.close();
      await new Promise(r => setTimeout(r, 50));
    });

    // ── Test 3: Live Payment Notification Broadcast to OBS ──
    console.log('\n--- Test 3: Live Payment Broadcast ---');
    await it('Broadcasts payment notification from Android socket to OBS overlays', async () => {
      const obsWs = new WebSocket(`ws://127.0.0.1:${testPort}/obs`);
      const androidWs = new WebSocket(`ws://127.0.0.1:${testPort}/android`);

      await new Promise(r => obsWs.on('open', r));
      await new Promise(r => androidWs.on('open', r));

      const receivedPromise = new Promise((resolve) => {
        obsWs.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'payment_notification') {
            resolve(msg);
          }
        });
      });

      androidWs.send(JSON.stringify({
        amount: 500,
        sender: 'Aman Sharma',
        sourceApp: 'PhonePe'
      }));

      const broadcasted = await receivedPromise;
      assert.strictEqual(broadcasted.type, 'payment_notification');
      assert.strictEqual(broadcasted.amount, 500);
      assert.strictEqual(broadcasted.sender, 'Aman Sharma');
      assert.strictEqual(broadcasted.sourceApp, 'PhonePe');

      obsWs.close();
      androidWs.close();
      await new Promise(r => setTimeout(r, 50));
    });

    // ── Test 4: Settings Updated Event on Connect ──
    console.log('\n--- Test 4: Initial Config Payload on OBS Connect ---');
    await it('Sends SETTINGS_UPDATED message on OBS overlay connect', async () => {
      const obsWs = new WebSocket(`ws://127.0.0.1:${testPort}/obs`);
      const received = await new Promise((resolve) => {
        obsWs.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'SETTINGS_UPDATED') resolve(msg);
        });
      });

      assert.strictEqual(received.type, 'SETTINGS_UPDATED');
      assert.strictEqual(received.payload.version, '2.2.8');

      obsWs.close();
      await new Promise(r => setTimeout(r, 50));
    });

  } finally {
    wss.close();
    server.close();
  }

  console.log('\n========================================');
  console.log(`📊 WebSocket Pipeline Summary: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
