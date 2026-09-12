/**
 * tests/test-config-schema-migration.js
 * Comprehensive automated test suite for ConfigSchema and ConfigMigration engine.
 *
 * Tests:
 *  1. ConfigSchema default config generation and structure validation
 *  2. Migration from legacy v0 flat widget-config.json format to v2
 *  3. Migration from v1 block format (text, style, media) to v2
 *  4. Preservation of existing v2 config structures and alertTemplates
 *  5. Graceful handling of null/empty/corrupted config objects
 */
const assert = require('assert');
const path = require('path');

const ConfigSchema = require('../public/js/lib/config-schema');
const ConfigMigration = require('../public/js/lib/config-migration');

console.log('🧪 Starting StreamPe Config Schema & Migration Test Suite...');

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

// ── Test 1: ConfigSchema Default Config ──
console.log('\n--- Test 1: ConfigSchema Default Config Generation ---');

it('Generates a fully valid default v2 config object', () => {
  const def = ConfigSchema.createDefaultConfig();
  assert.ok(def, 'Default config must not be null');
  assert.strictEqual(def.version, ConfigSchema.CONFIG_VERSION, 'Default config must have CONFIG_VERSION');
  assert.ok(Array.isArray(def.alertTemplates), 'Default config must contain alertTemplates array');
  assert.ok(def.alertTemplates.length > 0, 'Must contain at least 1 default alert template');
  assert.ok(def.widgets, 'Default config must contain widgets block');
  assert.ok(def.widgets.goal, 'Default config must contain goal widget');
  assert.ok(def.widgets.leaderboard, 'Default config must contain leaderboard widget');
  assert.ok(def.widgets.recent, 'Default config must contain recent widget');
  assert.ok(def.widgets.cycling, 'Default config must contain cycling widget');
});

// ── Test 2: v0 Flat Config Migration ──
console.log('\n--- Test 2: Legacy v0 Flat Config Migration ---');

it('Migrates flat v0 widget-config.json to valid v2 structure', () => {
  const legacyV0 = {
    lineTop: 'Received donation from {sender}!',
    lineBottom: 'Amount: {amount}',
    bgColor: '#1a1a2e',
    accentColor: '#e94560',
    fontSize: 28,
    borderRadius: 16
  };

  const migrated = ConfigMigration.migrate(legacyV0);
  assert.ok(migrated, 'Migrated config must not be null');
  assert.strictEqual(migrated.version, ConfigSchema.CONFIG_VERSION);
  assert.ok(Array.isArray(migrated.alertTemplates), 'Must generate alertTemplates array');
  assert.strictEqual(migrated.alertTemplates.length, 1);

  const tpl = migrated.alertTemplates[0];
  assert.strictEqual(tpl.style.backgroundColor, '#1a1a2e');
  assert.strictEqual(tpl.style.accentColor, '#e94560');
  assert.strictEqual(tpl.style.borderRadius, 16);
  assert.strictEqual(tpl.text.fontSize, 28);
  assert.strictEqual(tpl.text.titleTemplate, 'Received donation from {{sender}}!');
  assert.strictEqual(tpl.text.subtitleTemplate, 'Amount: {{amount}}');
});

// ── Test 3: v1 Block Config Migration ──
console.log('\n--- Test 3: Legacy v1 Block Config Migration ---');

it('Migrates v1 nested blocks (text, style, media) to v2 alertTemplates', () => {
  const legacyV1 = {
    version: 1,
    text: {
      titleTemplate: '🎉 {{sender}} donated!',
      subtitleTemplate: '₹{{amount}}',
      fontSize: 32
    },
    style: {
      backgroundColor: '#0f3460',
      accentColor: '#533483'
    },
    media: {
      imageUrl: '/images/custom-alert.gif',
      soundUrl: '/audio/custom-chime.mp3'
    },
    goal: {
      title: 'Monthly Goal',
      targetAmount: 20000,
      currentAmount: 5000
    }
  };

  const migrated = ConfigMigration.migrate(legacyV1);
  assert.strictEqual(migrated.version, ConfigSchema.CONFIG_VERSION);
  assert.ok(migrated.alertTemplates.length >= 1);

  const tpl = migrated.alertTemplates[0];
  assert.strictEqual(tpl.text.titleTemplate, '🎉 {{sender}} donated!');
  assert.strictEqual(tpl.image.imageUrl, '/images/custom-alert.gif');
  assert.strictEqual(tpl.sound.soundUrl, '/audio/custom-chime.mp3');
  assert.strictEqual(migrated.widgets.goal.title, 'Monthly Goal');
  assert.strictEqual(migrated.widgets.goal.targetAmount, 20000);
});

// ── Test 4: Idempotent v2 Config Pass-Through ──
console.log('\n--- Test 4: Idempotent v2 Config Normalization ---');

it('Preserves custom multi-template v2 configs without mutating existing IDs', () => {
  const customV2 = {
    version: ConfigSchema.CONFIG_VERSION,
    activeProfile: 'SpecialEvent',
    alertTemplates: [
      { id: 'tpl_standard', name: 'Standard', filters: { minAmount: 1 } },
      { id: 'tpl_whale', name: 'VIP Super Alert', filters: { minAmount: 5000 } }
    ],
    widgets: {
      goal: { enabled: true, title: 'Epic Stream Goal' }
    }
  };

  const migrated = ConfigMigration.migrate(customV2);
  assert.strictEqual(migrated.alertTemplates.length, 2);
  assert.strictEqual(migrated.alertTemplates[0].id, 'tpl_standard');
  assert.strictEqual(migrated.alertTemplates[1].id, 'tpl_whale');
  assert.strictEqual(migrated.widgets.goal.title, 'Epic Stream Goal');
});

// ── Test 5: Graceful Handling of Null / Empty Input ──
console.log('\n--- Test 5: Corrupt & Empty Input Resilience ---');

it('Returns full default config when input is null or non-object', () => {
  const fromNull = ConfigMigration.migrate(null);
  assert.ok(fromNull && fromNull.version === ConfigSchema.CONFIG_VERSION);

  const fromString = ConfigMigration.migrate('invalid string');
  assert.ok(fromString && fromString.version === ConfigSchema.CONFIG_VERSION);

  const fromEmpty = ConfigMigration.migrate({});
  assert.ok(fromEmpty && fromEmpty.version === ConfigSchema.CONFIG_VERSION);
});

console.log('\n========================================');
console.log(`📊 Config Schema & Migration Summary: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
