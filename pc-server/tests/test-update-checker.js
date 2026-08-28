const updateManager = require('../update-manager');

console.log('🧪 Starting StreamPe In-App Update Manager Test Suite...\n');

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

// ── TEST 1: Version String Normalization ──────────────────────────────────
console.log('--- Test 1: Version String Normalization ---');
assert(updateManager.cleanVersionString('v2.1.0') === '2.1.0', 'Normalizes "v2.1.0" -> "2.1.0"');
assert(updateManager.cleanVersionString('release-v2.2.0') === '2.2.0', 'Normalizes "release-v2.2.0" -> "2.2.0"');
assert(updateManager.cleanVersionString('release-2.0.0') === '2.0.0', 'Normalizes "release-2.0.0" -> "2.0.0"');
assert(updateManager.cleanVersionString('2.1.0-beta.1') === '2.1.0-beta.1', 'Preserves pre-release tag "2.1.0-beta.1"');
assert(updateManager.cleanVersionString('') === '0.0.0', 'Empty string safely defaults to "0.0.0"');

// ── TEST 2: Semantic Version Comparisons ─────────────────────────────────
console.log('\n--- Test 2: Semantic Version Comparisons ---');
assert(updateManager.compareSemver('2.2.0', '2.1.0') === 1, 'v2.2.0 > v2.1.0 (Major/Minor upgrade)');
assert(updateManager.compareSemver('2.1.1', '2.1.0') === 1, 'v2.1.1 > v2.1.0 (Patch upgrade)');
assert(updateManager.compareSemver('2.1.0', '2.1.0') === 0, 'v2.1.0 == v2.1.0 (Same version)');
assert(updateManager.compareSemver('2.0.0', '2.1.0') === -1, 'v2.0.0 < v2.1.0 (Older version)');
assert(updateManager.compareSemver('2.1.0', '2.1.0-beta.1') === 1, 'v2.1.0 stable > v2.1.0-beta.1 pre-release');
assert(updateManager.compareSemver('2.1.0-beta.1', '2.1.0') === -1, 'v2.1.0-beta.1 pre-release < v2.1.0 stable');
assert(updateManager.compareSemver('release-v2.2.0', '2.1.0') === 1, 'Tagged "release-v2.2.0" > "2.1.0"');

// ── TEST 3: Live / Mock Update Check ─────────────────────────────────────
console.log('\n--- Test 3: Live GitHub Release Fetch & Asset Classification ---');
(async () => {
  try {
    const result = await updateManager.checkForUpdates('2.0.0', true);
    assert(result.ok === true, 'Update check completes successfully');
    assert(typeof result.latestVersion === 'string' && result.latestVersion.length > 0, `Resolved latest version: "${result.latestVersion}"`);
    assert(result.updateAvailable === true, 'v2.0.0 detects updateAvailable = true against GitHub latest');
    assert(result.assets && Array.isArray(result.assets.all), 'Returns classified assets array');

    if (result.assets.portableZip) {
      assert(result.assets.portableZip.name.endsWith('.zip'), `Identified PC Portable Zip: ${result.assets.portableZip.name}`);
    }
    if (result.assets.companionApk) {
      assert(result.assets.companionApk.name.endsWith('.apk'), `Identified Android Companion APK: ${result.assets.companionApk.name}`);
    }

    // Verify same version produces updateAvailable = false
    const sameResult = await updateManager.checkForUpdates(result.latestVersion, false);
    assert(sameResult.updateAvailable === false, `Current = latest (${result.latestVersion}) produces updateAvailable = false`);
    assert(sameResult.cached === true, 'Subsequent call uses in-memory cache');

  } catch (err) {
    console.warn('  ⚠️ Live GitHub check warning (offline or rate-limited):', err.message);
  }

  console.log(`\n========================================`);
  console.log(`📊 Test Summary: ${testsPassed} passed, ${testsFailed} failed`);
  console.log(`========================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
})();
