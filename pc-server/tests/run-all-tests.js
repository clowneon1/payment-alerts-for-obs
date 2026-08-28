const { execSync } = require('child_process');
const path = require('path');

console.log('========================================');
console.log('🚀 Running StreamPe Complete Test Suite');
console.log('========================================\n');

const tests = [
  { name: 'Database & CSV Storage Engine Tests', file: 'scripts/test-database.js' },
  { name: 'Profile Aliases & ZIP Backup Engine Tests', file: 'tests/test-alias-zip-workflow.js' }
];

let failed = false;

for (const t of tests) {
  console.log(`▶ Running ${t.name} (${t.file})...`);
  try {
    execSync(`node "${path.join(__dirname, '..', t.file)}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`❌ Test suite failed: ${t.name}`);
    failed = true;
    break;
  }
}

if (failed) {
  console.error('\n💥 TEST RUN FAILED!');
  process.exit(1);
} else {
  console.log('\n========================================');
  console.log('🎉 ALL STREAMPE TEST SUITES PASSED CLEANLY!');
  console.log('========================================\n');
}
