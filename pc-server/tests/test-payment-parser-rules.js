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

// ── Test 6: Code Studio Template Variables Schema & Chip Rendering ──
console.log('\n--- Test 6: Code Studio Template Variables Schema & Chip Formatting ---');
const ConfigSchema = require('../public/js/lib/config-schema');

it('Exports valid TEMPLATE_VARIABLES descriptor schema for all 4 widgets', () => {
  assert.ok(ConfigSchema.TEMPLATE_VARIABLES, 'ConfigSchema.TEMPLATE_VARIABLES must be defined');
  const kinds = ['alerts', 'goal', 'list', 'cycling'];
  for (const kind of kinds) {
    const list = ConfigSchema.TEMPLATE_VARIABLES[kind];
    assert.ok(Array.isArray(list), `TEMPLATE_VARIABLES.${kind} must be an array`);
    assert.ok(list.length > 0, `TEMPLATE_VARIABLES.${kind} must not be empty`);
    for (const v of list) {
      assert.strictEqual(typeof v, 'object', 'Variable definition must be an object');
      assert.ok(typeof v.name === 'string' && v.name.length > 0, 'Variable name must be non-empty string');
      assert.ok(typeof v.desc === 'string' && v.desc.length > 0, 'Variable desc must be non-empty string');
      assert.ok(!v.name.includes('[object Object]'), 'Variable name must never be [object Object]');
    }
  }
});

it('Resolves variable descriptor objects to clean template tags without [object Object]', () => {
  const kinds = ['alerts', 'goal', 'list', 'cycling'];
  for (const kind of kinds) {
    const list = ConfigSchema.TEMPLATE_VARIABLES[kind];
    for (const v of list) {
      const varName = (typeof v === 'object' && v !== null) ? v.name : String(v);
      const varDesc = (typeof v === 'object' && v !== null) ? v.desc : '';
      const htmlTag = `{{${varName}}}`;
      const jsIdentifier = varName;

      assert.ok(!htmlTag.includes('[object Object]'), `HTML tag ${htmlTag} must not contain [object Object]`);
      assert.ok(!jsIdentifier.includes('[object Object]'), `JS identifier ${jsIdentifier} must not contain [object Object]`);
      assert.ok(varDesc.length > 0, `Descriptor for ${varName} must have description text`);
    }
  }
});

// ── Test 7: Widget Template Rendering with amount vs formattedAmount ──
console.log('\n--- Test 7: Multi-Widget Template Rendering with amount vs formattedAmount ---');

it('Renders Alerts template with distinct amount (number) and formattedAmount (currency)', () => {
  const tpl = '{{sender}} paid {{formattedAmount}} (raw: {{amount}}, app: {{providerName}})';
  const out = TemplateEngine.render(tpl, {
    sender: 'Rahul Kumar',
    amount: 500,
    formattedAmount: '₹500.00',
    providerName: 'PhonePe'
  });
  assert.strictEqual(out, 'Rahul Kumar paid ₹500.00 (raw: 500, app: PhonePe)');
});

it('Renders Cycling Widget template with separated name, amount, and formattedAmount', () => {
  const tpl = '<div class="card"><span>{{label}}</span><b>{{name}}</b><em>{{formattedAmount}}</em>(val: {{amount}})</div>';
  const out = TemplateEngine.render(tpl, {
    label: 'Top Supporter',
    text: 'Rahul ₹500',
    name: 'Rahul',
    amount: 500,
    formattedAmount: '₹500'
  });
  assert.strictEqual(out, '<div class="card"><span>Top Supporter</span><b>Rahul</b><em>₹500</em>(val: 500)</div>');
});

it('Renders Goal Widget template with current/target numbers and formatted amounts', () => {
  const tpl = '{{title}}: {{formattedCurrent}} / {{formattedTarget}} ({{percent}})';
  const out = TemplateEngine.render(tpl, {
    title: 'New Mic Goal',
    current: 1200,
    target: 5000,
    currentAmount: '₹1,200',
    targetAmount: '₹5,000',
    formattedCurrent: '₹1,200',
    formattedTarget: '₹5,000',
    percent: '24.0%',
    percentage: 24.0
  });
  assert.strictEqual(out, 'New Mic Goal: ₹1,200 / ₹5,000 (24.0%)');
});

it('Renders List Widget template with totalAmount number and formattedTotal string', () => {
  const tpl = '{{title}} ({{count}}/{{max}}): Total {{formattedTotal}} (sum: {{totalAmount}})';
  const out = TemplateEngine.render(tpl, {
    title: 'Top Supporters',
    count: 5,
    max: 5,
    totalAmount: 2500,
    formattedTotal: '₹2,500'
  });
  assert.strictEqual(out, 'Top Supporters (5/5): Total ₹2,500 (sum: 2500)');
});

console.log('\n========================================');
console.log(`📊 Test Summary: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
