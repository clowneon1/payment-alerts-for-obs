/**
 * tests/test-payment-parser-rules.js
 * Comprehensive test suite for Payment Notification Parsers, Payment Rules Engine,
 * and Handlebars Template Matching.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting Payment Parser & Rules Engine Test Suite...');

const TemplateMatcher = require('../public/js/lib/template-matcher');
const TemplateEngine = require('../public/js/template-engine');

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

// ── Test 1: Template Matching by Amount (Rank & Select) ──
console.log('\n--- Test 1: Template Matching by Amount ---');
const sampleTemplates = [
  { id: 'tpl_default', name: 'Default Alert', enabled: true, isDefault: true, amountFilters: [] },
  { id: 'tpl_vip', name: 'VIP Alert (>500)', enabled: true, isDefault: false, amountFilters: [{ type: 'min', min: 500, value: 500 }] },
  { id: 'tpl_mega', name: 'Mega Exact (1000)', enabled: true, isDefault: false, amountFilters: [{ type: 'exact', value: 1000 }] },
  { id: 'tpl_disabled', name: 'Disabled Big Alert', enabled: false, isDefault: false, amountFilters: [{ type: 'min', min: 100, value: 100 }] }
];

it('Matches exact amount filter over generic range (narrowest width wins)', () => {
  const matched = TemplateMatcher.select(sampleTemplates, 1000);
  assert.ok(matched);
  assert.strictEqual(matched.id, 'tpl_mega', 'Exact 1000 template must win over min:500 or default');
});

it('Matches min amount filter when no exact match exists', () => {
  const matched = TemplateMatcher.select(sampleTemplates, 600);
  assert.ok(matched);
  assert.strictEqual(matched.id, 'tpl_vip', 'Min 500 template must match amount 600');
});

it('Falls back to default template when amount does not match specific tiers', () => {
  const matched = TemplateMatcher.select(sampleTemplates, 50);
  assert.ok(matched);
  assert.strictEqual(matched.id, 'tpl_default', 'Amount 50 must fall back to default template');
});

it('Ignores disabled templates during matching', () => {
  const matched = TemplateMatcher.select(sampleTemplates, 200);
  assert.strictEqual(matched.id, 'tpl_default', 'Disabled template must never match');
});

// ── Test 2: Filter Matching Matrix ──
console.log('\n--- Test 2: Filter Matching Matrix ---');
it('Matches exact filters correctly', () => {
  assert.ok(TemplateMatcher.matches({ type: 'exact', value: 100 }, 100));
  assert.ok(!TemplateMatcher.matches({ type: 'exact', value: 100 }, 101));
});

it('Matches range filters correctly', () => {
  assert.ok(TemplateMatcher.matches({ type: 'range', min: 100, max: 500 }, 250));
  assert.ok(TemplateMatcher.matches({ type: 'range', min: 100, max: 500 }, 100));
  assert.ok(TemplateMatcher.matches({ type: 'range', min: 100, max: 500 }, 500));
  assert.ok(!TemplateMatcher.matches({ type: 'range', min: 100, max: 500 }, 501));
});

it('Matches min and max filters correctly', () => {
  assert.ok(TemplateMatcher.matches({ type: 'min', min: 500, value: 500 }, 500));
  assert.ok(TemplateMatcher.matches({ type: 'min', min: 500, value: 500 }, 9999));
  assert.ok(!TemplateMatcher.matches({ type: 'min', min: 500, value: 500 }, 499));

  assert.ok(TemplateMatcher.matches({ type: 'max', max: 500, value: 500 }, 500));
  assert.ok(TemplateMatcher.matches({ type: 'max', max: 500, value: 500 }, 10));
  assert.ok(!TemplateMatcher.matches({ type: 'max', max: 500, value: 500 }, 501));
});

// ── Test 3: Payment Rules JSON Configuration Integrity ──
console.log('\n--- Test 3: Payment Rules JSON Configuration Integrity ---');
const paymentRulesPath = path.resolve(__dirname, '..', 'payment-rules.json');
it('payment-rules.json exists and contains valid app rules', () => {
  assert.ok(fs.existsSync(paymentRulesPath), 'payment-rules.json must exist');
  const rules = JSON.parse(fs.readFileSync(paymentRulesPath, 'utf8'));
  assert.ok(Array.isArray(rules.apps), 'payment-rules must contain apps array');
  assert.ok(rules.apps.some(a => a.appName === 'PhonePe'), 'PhonePe rules present');
  assert.ok(rules.apps.some(a => a.appName === 'Google Pay'), 'Google Pay rules present');
  assert.ok(rules.apps.some(a => a.appName === 'Amazon Pay'), 'Amazon Pay rules present');
});

// ── Test 4: Handlebars Template Helper Engine ──
console.log('\n--- Test 4: Handlebars Template Helper Engine ---');
it('Formats currency with formatAmount helper', () => {
  const tpl = '{{formatAmount amount}}';
  const out1 = TemplateEngine.render(tpl, { amount: 1250 });
  assert.strictEqual(out1, '₹1,250.00');

  const out2 = TemplateEngine.render(tpl, { amount: '₹500.00' });
  assert.strictEqual(out2, '₹500.00');
});

it('Renders conditionals (gte, eq) in custom alert template', () => {
  const tpl = '{{#if (gte amount 1000)}}VIP DONOR: {{sender}}{{else}}Supporter: {{sender}}{{/if}}';
  const vipOut = TemplateEngine.render(tpl, { amount: 1500, sender: 'Rahul' });
  assert.strictEqual(vipOut, 'VIP DONOR: Rahul');

  const standardOut = TemplateEngine.render(tpl, { amount: 200, sender: 'Priya' });
  assert.strictEqual(standardOut, 'Supporter: Priya');
});

it('Escapes HTML in standard expressions to prevent XSS', () => {
  const tpl = 'Hello {{sender}}';
  const out = TemplateEngine.render(tpl, { sender: '<script>alert("xss")</script>' });
  assert.ok(!out.includes('<script>'), 'Must escape script tags');
  assert.ok(out.includes('&lt;script&gt;'), 'Must encode HTML entities');
});

it('Supports triple stash for raw HTML when explicitly desired', () => {
  const tpl = 'Badge: {{{mediaHtml}}}';
  const out = TemplateEngine.render(tpl, { mediaHtml: '<img src="badge.png" />' });
  assert.strictEqual(out, 'Badge: <img src="badge.png" />');
});

// ── Test 5: Amount Parser Edge Cases ──
console.log('\n--- Test 5: Amount Parser Edge Cases ---');
it('Parses edge case amount strings correctly into numbers', () => {
  assert.strictEqual(TemplateMatcher.parseAmount('₹ 1,23,456.78'), 123456.78);
  assert.strictEqual(TemplateMatcher.parseAmount('INR 500'), 500);
  assert.strictEqual(TemplateMatcher.parseAmount('Rs. 2,000'), 2000);
  assert.strictEqual(TemplateMatcher.parseAmount(100), 100);
  assert.strictEqual(TemplateMatcher.parseAmount('invalid'), 0);
});

console.log('\n========================================');
console.log(`📊 Test Summary: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
