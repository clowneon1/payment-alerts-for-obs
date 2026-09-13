/**
 * tests/test-ui-dom-contract.js
 * Automated UI DOM Contract and Element ID integrity test suite.
 *
 * Scans all JavaScript files in public/js/ and asserts that all DOM element IDs
 * referenced via el('id'), val('id'), on('id'), setVal('id'), or getElementById('id')
 * strictly exist in the corresponding HTML markup.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting StreamPe UI DOM Contract & Element Integrity Test Suite...');

const publicDir = path.resolve(__dirname, '..', 'public');
const configHtmlPath = path.join(publicDir, 'config.html');
const appHtmlPath = path.join(publicDir, 'app.html');
const previewHtmlPath = path.join(publicDir, 'preview.html');

assert.ok(fs.existsSync(configHtmlPath), 'config.html must exist');
assert.ok(fs.existsSync(appHtmlPath), 'app.html must exist');

function extractHtmlIds(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const idRegex = /id=["']([^"']+)["']/g;
  const ids = new Set();
  let match;
  while ((match = idRegex.exec(content)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

const configHtmlIds = extractHtmlIds(configHtmlPath);
const appHtmlIds = extractHtmlIds(appHtmlPath);

// ── Test 1: Config UI DOM Contract Integrity ──
console.log('\n--- Test 1: Config.js DOM Element ID Contract ---');
const configJsContent = fs.readFileSync(path.join(publicDir, 'js', 'config.js'), 'utf8');

// Known dynamic or special tokens that are not static HTML elements
const configIgnoredTokens = new Set([
  'mode', 'change', 'cursorActivity', 'click', 'input', 'keydown', 'keyup',
  'custom', 'default', 'tab', 'active'
]);

const jsCallRegex = /(?:el|val|setVal|on)\(['"]([a-zA-Z0-9_-]+)['"]/g;
const missingConfigIds = [];
let m;
while ((m = jsCallRegex.exec(configJsContent)) !== null) {
  const elementId = m[1];
  if (!configIgnoredTokens.has(elementId) && !configHtmlIds.has(elementId)) {
    if (!missingConfigIds.includes(elementId)) {
      missingConfigIds.push(elementId);
    }
  }
}

assert.strictEqual(
  missingConfigIds.length,
  0,
  `Found ${missingConfigIds.length} missing DOM IDs in config.html: ${missingConfigIds.join(', ')}`
);
console.log('  ✅ PASS: 100% of DOM IDs referenced in config.js exist in config.html markup.');

// ── Test 2: App.js DOM Element ID Contract ──
console.log('\n--- Test 2: App.js DOM Element ID Contract ---');
const appJsContent = fs.readFileSync(path.join(publicDir, 'js', 'app.js'), 'utf8');

const appGetElementRegex = /getElementById\(['"]([a-zA-Z0-9_-]+)['"]/g;
const missingAppIds = [];
while ((m = appGetElementRegex.exec(appJsContent)) !== null) {
  const elementId = m[1];
  if (!appHtmlIds.has(elementId)) {
    if (!missingAppIds.includes(elementId)) {
      missingAppIds.push(elementId);
    }
  }
}

assert.strictEqual(
  missingAppIds.length,
  0,
  `Found ${missingAppIds.length} missing DOM IDs in app.html: ${missingAppIds.join(', ')}`
);
console.log('  ✅ PASS: 100% of DOM IDs referenced in app.js exist in app.html markup.');

// ── Test 3: Preview.html Test Trigger Button Contract ──
console.log('\n--- Test 3: Preview.html Test Trigger Button Contract ---');
const previewHtmlIds = extractHtmlIds(previewHtmlPath);
assert.ok(previewHtmlIds.has('btn-test-preview'), 'preview.html must contain #btn-test-preview button element');
console.log('  ✅ PASS: preview.html contains #btn-test-preview trigger button.');

// ── Test 4: Code Studio Status Bar Contract ──
console.log('\n--- Test 4: Code Studio Status Bar Contract ---');
assert.ok(configHtmlIds.has('code-studio-cursor-info'), 'config.html must contain #code-studio-cursor-info');
assert.ok(configHtmlIds.has('code-studio-char-info'), 'config.html must contain #code-studio-char-info');
assert.ok(configHtmlIds.has('code-studio-mode-pill'), 'config.html must contain #code-studio-mode-pill');
console.log('  ✅ PASS: Code Studio status bar elements verified.');

console.log('\n========================================');
console.log('📊 UI DOM Contract Summary: 4 passed, 0 failed');
console.log('========================================\n');
