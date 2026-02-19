const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Generate timestamp for report folder structure
function getDateFolder() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTimeFolder() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}-${minutes}-${seconds}`;
}

const REQUIRED_TEST_PATTERNS = [
  // getCart tests
  { pattern: /should return empty cart structure for non-existent cart/i, description: 'getCart: empty cart for non-existent' },
  { pattern: /should return populated cart with correct item mapping/i, description: 'getCart: populated cart with items' },
  
  // addToCart tests
  { pattern: /should throw 404.*when menu item not found/i, description: 'addToCart: 404 when menu item not found' },
  { pattern: /should throw 400.*when menu item is unavailable/i, description: 'addToCart: 400 when unavailable' },
  { pattern: /should throw 409.*when duplicate item/i, description: 'addToCart: 409 for duplicate items' },
  { pattern: /should calculate subtotal correctly with addOns/i, description: 'addToCart: subtotal calculation with addOns' },
  
  // updateCartItem tests
  { pattern: /should remove item when quantity is 0/i, description: 'updateCartItem: removes item when quantity=0' },
  { pattern: /should.*recalculate subtotal/i, description: 'updateCartItem: recalculates subtotal' },
  { pattern: /should validate.*variable product variations/i, description: 'updateCartItem: validates variable product variations' },
  
  // removeFromCart tests
  { pattern: /should filter correct item from cart/i, description: 'removeFromCart: filters correct item' },
  
  // clearCart tests
  { pattern: /should reset items array and pricing to zero/i, description: 'clearCart: resets items and pricing' },
  
  // deleteCart tests
  { pattern: /should call findOneAndDelete with correct parameters/i, description: 'deleteCart: calls findOneAndDelete correctly' },
  
  // checkoutCart tests
  { pattern: /should throw 400.*when no items selected/i, description: 'checkoutCart: 400 when no items selected' },
  { pattern: /should throw 400.*when.*multiple merchants/i, description: 'checkoutCart: 400 for multiple merchants' },
  { pattern: /should throw 400.*when unavailable items selected/i, description: 'checkoutCart: 400 for unavailable items' },
  { pattern: /should create order with correct data/i, description: 'checkoutCart: creates order with correct data' }
];

const MOCK_PATTERNS = [
  { pattern: /jest\.mock\(.*(Cart|MenuItem|Merchant)\.model/gi, description: 'Mocks Mongoose models' },
  { pattern: /mockCartFindOne|Cart\.findOne/i, description: 'Mocks Cart.findOne' },
  { pattern: /mockCartSave|\.save\(/i, description: 'Mocks cart.save()' },
  { pattern: /populate/i, description: 'Mocks populate chain' },
  { pattern: /lean/i, description: 'Mocks lean()' }
];

function readTestFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading test file: ${error.message}`);
    return null;
  }
}

function checkTestPatterns(content, patterns) {
  const results = [];
  for (const { pattern, description } of patterns) {
    const found = pattern.test(content);
    results.push({ description, found });
  }
  return results;
}

function runTests(directory) {
  try {
    const result = execSync('npm test -- --coverage --json --outputFile=test-results.json', {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, output: result };
  } catch (error) {
    // Jest exits with code 1 even if tests pass but there are console warnings
    if (error.stdout && error.stdout.includes('"success":true')) {
      return { success: true, output: error.stdout };
    }
    return { success: false, output: error.stdout || error.message, stderr: error.stderr };
  }
}

function getCoverageData(directory) {
  try {
    const coveragePath = path.join(directory, 'coverage', 'coverage-summary.json');
    if (fs.existsSync(coveragePath)) {
      return JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    }
  } catch (error) {
    console.error(`Error reading coverage: ${error.message}`);
  }
  return null;
}

function getTestResults(directory) {
  try {
    const resultsPath = path.join(directory, 'test-results.json');
    if (fs.existsSync(resultsPath)) {
      return JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    }
  } catch (error) {
    console.error(`Error reading test results: ${error.message}`);
  }
  return null;
}

function main() {
  const repoAfterPath = path.join(__dirname, '..', 'repository_after');
  const testsPath = path.join(__dirname, '..', 'tests');
  const testFilePath = path.join(repoAfterPath, 'cartService.test.js');
  const reportsDir = path.join(__dirname, 'reports');
  
  // Ensure reports directory exists
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const report = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    },
    results: {
      testFileExists: false,
      mockPatterns: { found: 0, total: MOCK_PATTERNS.length, details: [] },
      testPatterns: { found: 0, total: REQUIRED_TEST_PATTERNS.length, details: [] },
      unitTestExecution: { passed: false, totalTests: 0, passedTests: 0, failedTests: 0 },
      metaTestExecution: { passed: false, totalTests: 0, passedTests: 0, failedTests: 0 },
      coverage: { met: false, statements: 0, branches: 0, functions: 0, lines: 0 }
    },
    overallPass: false
  };
  
  console.log('='.repeat(60));
  console.log('CART SERVICE TEST EVALUATION');
  console.log('='.repeat(60));
  
  // 1. Check test file exists
  console.log('\n[1] Checking test file exists...');
  if (!fs.existsSync(testFilePath)) {
    console.log('FAIL: Test file not found at', testFilePath);
    saveReport(report, reportsDir);
    process.exit(1);
  }
  console.log('PASS: Test file found');
  report.results.testFileExists = true;
  
  // 2. Read and analyze test content
  console.log('\n[2] Analyzing test content...');
  const testContent = readTestFile(testFilePath);
  if (!testContent || testContent.trim().length < 100) {
    console.log('FAIL: Test file is empty or too short');
    saveReport(report, reportsDir);
    process.exit(1);
  }
  
  // 3. Check for mock setup
  console.log('\n[3] Checking mock setup...');
  const mockResults = checkTestPatterns(testContent, MOCK_PATTERNS);
  let mocksPassed = 0;
  for (const { description, found } of mockResults) {
    const status = found ? 'PASS' : 'FAIL';
    console.log(`  ${status}: ${description}`);
    report.results.mockPatterns.details.push({ description, found });
    if (found) mocksPassed++;
  }
  console.log(`  Mock setup: ${mocksPassed}/${MOCK_PATTERNS.length} patterns found`);
  report.results.mockPatterns.found = mocksPassed;
  
  // 4. Check for required test patterns
  console.log('\n[4] Checking required test cases...');
  const testPatternResults = checkTestPatterns(testContent, REQUIRED_TEST_PATTERNS);
  let testsPassed = 0;
  for (const { description, found } of testPatternResults) {
    const status = found ? 'PASS' : 'FAIL';
    console.log(`  ${status}: ${description}`);
    report.results.testPatterns.details.push({ description, found });
    if (found) testsPassed++;
  }
  console.log(`  Test patterns: ${testsPassed}/${REQUIRED_TEST_PATTERNS.length} found`);
  report.results.testPatterns.found = testsPassed;
  
  // 5. Run unit tests in repository_after
  console.log('\n[5] Running unit tests (repository_after)...');
  const unitTestRun = runTests(repoAfterPath);
  if (!unitTestRun.success) {
    console.log('FAIL: Unit tests did not pass');
    console.log(unitTestRun.output);
    if (unitTestRun.stderr) console.log(unitTestRun.stderr);
    saveReport(report, reportsDir);
    process.exit(1);
  }
  console.log('PASS: All unit tests passed');
  report.results.unitTestExecution.passed = true;
  
  // Parse unit test results
  const unitTestResults = getTestResults(repoAfterPath);
  if (unitTestResults) {
    report.results.unitTestExecution.totalTests = unitTestResults.numTotalTests || 0;
    report.results.unitTestExecution.passedTests = unitTestResults.numPassedTests || 0;
    report.results.unitTestExecution.failedTests = unitTestResults.numFailedTests || 0;
  }
  
  // 6. Check coverage
  console.log('\n[6] Checking code coverage...');
  const coverage = getCoverageData(repoAfterPath);
  let coveragePassed = true;
  if (coverage && coverage.total) {
    const { statements, branches, functions, lines } = coverage.total;
    report.results.coverage.statements = statements.pct;
    report.results.coverage.branches = branches.pct;
    report.results.coverage.functions = functions.pct;
    report.results.coverage.lines = lines.pct;
    
    const metrics = [
      { name: 'Statements', value: statements.pct },
      { name: 'Branches', value: branches.pct },
      { name: 'Functions', value: functions.pct },
      { name: 'Lines', value: lines.pct }
    ];
    
    for (const { name, value } of metrics) {
      const status = value >= 80 ? 'PASS' : 'FAIL';
      console.log(`  ${status}: ${name}: ${value}%`);
      if (value < 80) coveragePassed = false;
    }
    
    report.results.coverage.met = coveragePassed;
  } else {
    console.log('WARNING: Could not read coverage data');
  }
  
  // 7. Run metatests in tests/
  console.log('\n[7] Running metatests (tests/)...');
  const metaTestRun = runMetaTests(testsPath);
  if (!metaTestRun.success) {
    console.log('FAIL: Metatests did not pass');
    console.log(metaTestRun.output);
    if (metaTestRun.stderr) console.log(metaTestRun.stderr);
    saveReport(report, reportsDir);
    process.exit(1);
  }
  console.log('PASS: All metatests passed');
  report.results.metaTestExecution.passed = true;
  
  // Parse metatest results
  const metaTestResults = getTestResults(testsPath);
  if (metaTestResults) {
    report.results.metaTestExecution.totalTests = metaTestResults.numTotalTests || 0;
    report.results.metaTestExecution.passedTests = metaTestResults.numPassedTests || 0;
    report.results.metaTestExecution.failedTests = metaTestResults.numFailedTests || 0;
  }
  
  // 8. Summary
  console.log('\n' + '='.repeat(60));
  console.log('EVALUATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Mock patterns found: ${mocksPassed}/${MOCK_PATTERNS.length}`);
  console.log(`Test patterns found: ${testsPassed}/${REQUIRED_TEST_PATTERNS.length}`);
  console.log(`Unit tests: ${report.results.unitTestExecution.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`Metatests: ${report.results.metaTestExecution.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`Coverage threshold met: ${coveragePassed ? 'YES' : 'NO'}`);
  
  const overallPass = mocksPassed >= 3 && testsPassed >= 12 && 
                      report.results.unitTestExecution.passed && 
                      report.results.metaTestExecution.passed &&
                      coveragePassed;
  report.overallPass = overallPass;
  console.log('\n' + (overallPass ? 'OVERALL: PASS' : 'OVERALL: FAIL'));
  
  // Save report
  const reportPath = saveReport(report, reportsDir);
  console.log(`\nReport saved to: ${reportPath}`);
  
  process.exit(overallPass ? 0 : 1);
}

function runMetaTests(directory) {
  try {
    const result = execSync('npx jest --json --outputFile=test-results.json', {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, output: result };
  } catch (error) {
    if (error.stdout && error.stdout.includes('"success":true')) {
      return { success: true, output: error.stdout };
    }
    return { success: false, output: error.stdout || error.message, stderr: error.stderr };
  }
}

function saveReport(report, reportsDir) {
  const dateFolder = getDateFolder();
  const timeFolder = getTimeFolder();
  const reportDir = path.join(reportsDir, dateFolder, timeFolder);
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

main();

