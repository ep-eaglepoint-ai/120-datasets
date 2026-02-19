/**
 * Req 25: Run the test suite 5 times consecutively without any failures.
 * Exits with code 1 if any run fails.
 */
const { execSync } = require('child_process');

const RUNS = 5;

for (let i = 1; i <= RUNS; i++) {
  console.log(`\n--- Stability run ${i}/${RUNS} ---\n`);
  try {
    execSync('npx jest --runInBand', {
      stdio: 'inherit',
      cwd: __dirname + '/..',
    });
  } catch (err) {
    console.error(`Stability run ${i} failed.`);
    process.exit(1);
  }
}

console.log(`\nAll ${RUNS} runs passed.\n`);
