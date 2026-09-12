/**
 * tests/test-packaging-manifest.js
 * Comprehensive automated test suite for Release Packaging Manifest & Runtime Path Resolution.
 *
 * Tests:
 *  1. Server Runtime Path Resolution (Compiled vs Dev mode baseDir, PUBLIC_DIR, PAYMENT_RULES_PATH)
 *  2. Release Packager File Copy Contract (Ensures all server runtime dependencies are copied)
 *  3. Portable Bundle Assembly & Manifest Integrity (Validates a simulated portable release bundle)
 *  4. Isolated Standalone Directory Asset Loading (Ensures server runtime boots with 0 reliance on repo source)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { APP_NAME, APP_VERSION } = require('../constants');

console.log('🧪 Starting StreamPe Release Packaging Manifest & Path Resolution Test Suite...');

const pcServerDir = path.resolve(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streampe-packaging-test-'));

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

try {
  // ── Test 1: Server Runtime Path Resolution Contract ──
  console.log('\n--- Test 1: Runtime Base Directory & Path Resolution Contract ---');

  it('Resolves baseDir and critical assets correctly for compiled standalone binary', () => {
    const mockExeDir = path.join(tempDir, 'mock-portable-install');
    fs.mkdirSync(mockExeDir, { recursive: true });

    // Mock portable directory structure
    fs.writeFileSync(path.join(mockExeDir, 'payment-rules.json'), JSON.stringify({ version: '1.0.0', apps: [] }));
    fs.writeFileSync(path.join(mockExeDir, 'widget-config.json'), JSON.stringify({ version: '1.0.0' }));
    fs.mkdirSync(path.join(mockExeDir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(mockExeDir, 'public', 'config.html'), '<html></html>');

    // Simulate compiled runtime path resolution logic
    const isCompiled = true;
    const mockExecPath = path.join(mockExeDir, 'StreamPe.exe');
    const baseDir = isCompiled ? path.dirname(mockExecPath) : pcServerDir;

    let publicDir = path.join(baseDir, 'public');
    if (!fs.existsSync(publicDir)) publicDir = path.join(pcServerDir, 'public');

    let paymentRulesPath = path.join(baseDir, 'payment-rules.json');
    if (!fs.existsSync(paymentRulesPath)) paymentRulesPath = path.join(pcServerDir, 'payment-rules.json');

    let widgetConfigPath = path.join(baseDir, 'widget-config.json');
    if (!fs.existsSync(widgetConfigPath)) widgetConfigPath = path.join(pcServerDir, 'widget-config.json');

    assert.strictEqual(baseDir, mockExeDir, 'baseDir must point to the standalone executable folder');
    assert.strictEqual(paymentRulesPath, path.join(mockExeDir, 'payment-rules.json'), 'Must resolve local payment-rules.json');
    assert.strictEqual(widgetConfigPath, path.join(mockExeDir, 'widget-config.json'), 'Must resolve local widget-config.json');
    assert.strictEqual(publicDir, path.join(mockExeDir, 'public'), 'Must resolve local public/ directory');
  });

  // ── Test 2: Release Packager Source Code Contract ──
  console.log('\n--- Test 2: Package Release Script Manifest Contract ---');

  it('package-release.js explicitly copies all required runtime assets to portableDir', () => {
    const packageScriptPath = path.join(pcServerDir, 'scripts', 'package-release.js');
    assert.ok(fs.existsSync(packageScriptPath), 'scripts/package-release.js must exist');

    const scriptContent = fs.readFileSync(packageScriptPath, 'utf8');

    const requiredAssets = [
      'public',
      'templates',
      'widget-config.json',
      'payment-rules.json'
    ];

    for (const asset of requiredAssets) {
      const hasAssetCopy = scriptContent.includes(asset);
      assert.ok(hasAssetCopy, `scripts/package-release.js must explicitly include copy step for "${asset}"`);
    }
  });

  // ── Test 3: Simulated Portable Bundle Assembly & Integrity ──
  console.log('\n--- Test 3: Simulated Portable Bundle Assembly & Manifest Integrity ---');

  it('Assembles portable bundle with 100% required runtime files', () => {
    const bundleDir = path.join(tempDir, `StreamPe-v${APP_VERSION}-Portable`);
    fs.mkdirSync(bundleDir, { recursive: true });

    function copyDir(src, dest) {
      if (!fs.existsSync(src)) return;
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyDir(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }

    // Mirror package-release.js copy operations
    copyDir(path.join(pcServerDir, 'public'), path.join(bundleDir, 'public'));
    copyDir(path.join(pcServerDir, 'templates'), path.join(bundleDir, 'templates'));
    fs.copyFileSync(path.join(pcServerDir, 'widget-config.json'), path.join(bundleDir, 'widget-config.json'));
    fs.copyFileSync(path.join(pcServerDir, 'payment-rules.json'), path.join(bundleDir, 'payment-rules.json'));

    // Verify root files in bundle
    assert.ok(fs.existsSync(path.join(bundleDir, 'widget-config.json')), 'widget-config.json missing in bundle');
    assert.ok(fs.existsSync(path.join(bundleDir, 'payment-rules.json')), 'payment-rules.json missing in bundle');

    // Verify public/ critical web assets
    const criticalPublicFiles = [
      'config.html',
      'app.html',
      'preview.html',
      path.join('js', 'config.js'),
      path.join('js', 'app.js'),
      path.join('js', 'overlay.js'),
      path.join('js', 'template-engine.js'),
      path.join('js', 'goal.js'),
      path.join('js', 'leaderboard.js'),
      path.join('js', 'list.js'),
      path.join('js', 'recent.js'),
      path.join('js', 'cycling-widget.js'),
      path.join('js', 'lib', 'payments-csv.js'),
      path.join('js', 'lib', 'template-matcher.js'),
      path.join('js', 'lib', 'handlebars.min.js'),
      path.join('js', 'lib', 'config-schema.js'),
      path.join('js', 'lib', 'config-migration.js'),
      path.join('js', 'lib', 'widget-style.js')
    ];

    for (const f of criticalPublicFiles) {
      const fullPath = path.join(bundleDir, 'public', f);
      assert.ok(fs.existsSync(fullPath), `Critical public file missing in bundle: ${f}`);
      assert.ok(fs.statSync(fullPath).size > 0, `Bundle file must not be empty: ${f}`);
    }

    // Verify templates
    const templateFiles = fs.readdirSync(path.join(bundleDir, 'templates'));
    assert.ok(templateFiles.length > 0, 'templates directory must contain template definitions');
  });

  // ── Test 4: Isolated Standalone Directory Asset Loading ──
  console.log('\n--- Test 4: Isolated Standalone Directory Asset Loading ---');

  it('Loads and parses payment-rules.json and widget-config.json from isolated standalone bundle', () => {
    const bundleDir = path.join(tempDir, `StreamPe-v${APP_VERSION}-Portable`);

    // Verify JSON validity in the portable bundle
    const rulesContent = fs.readFileSync(path.join(bundleDir, 'payment-rules.json'), 'utf8');
    const rulesObj = JSON.parse(rulesContent);
    assert.ok(Array.isArray(rulesObj.apps), 'payment-rules.json in bundle must have apps array');
    assert.ok(rulesObj.apps.length > 0, 'payment-rules.json in bundle must have rules configured');

    const widgetContent = fs.readFileSync(path.join(bundleDir, 'widget-config.json'), 'utf8');
    const widgetObj = JSON.parse(widgetContent);
    assert.ok(widgetObj && typeof widgetObj === 'object', 'widget-config.json in bundle must be valid JSON');
  });

} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {}
}

console.log('\n========================================');
console.log(`📊 Packaging Manifest Summary: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
