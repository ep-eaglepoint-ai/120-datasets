// Test runner for repository_after
// All tests should pass

const path = require('path');
const Module = require('module');

// Clear require cache to ensure fresh loads
delete require.cache[require.resolve('./legacy.test.js')];
delete require.cache[require.resolve('./kernel.test.js')];

// Override require to redirect to repository_after
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
    if (id.includes('../repository_before/LegacyBusManager')) {
        // Redirect to repository_after
        return originalRequire.call(this, path.join(__dirname, '..', 'repository_after', 'LegacyBusManager.js'));
    }
    if (id.includes('../repository_after/EventKernel')) {
        return originalRequire.call(this, path.join(__dirname, '..', 'repository_after', 'EventKernel.js'));
    }
    if (id.includes('../repository_after/LegacyBusManager')) {
        return originalRequire.call(this, path.join(__dirname, '..', 'repository_after', 'LegacyBusManager.js'));
    }
    return originalRequire.apply(this, arguments);
};

async function runAllTests() {
    console.log('Testing repository_after implementation...\n');
    
    const { runAllLegacyTests } = require('./legacy.test.js');
    const { runAllTests: runKernelTests } = require('./kernel.test.js');
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    // Run legacy tests (should pass - after has all features)
    const legacyResults = await runAllLegacyTests();
    totalPassed += legacyResults.passed;
    totalFailed += legacyResults.failed;
    
    console.log('\n');
    
    // Run kernel tests (should all pass)
    const kernelResults = await runKernelTests();
    totalPassed += kernelResults.passed;
    totalFailed += kernelResults.failed;
    
    console.log(`\n=== TOTAL: ${totalPassed} passed, ${totalFailed} failed (total: ${totalPassed + totalFailed}) ===\n`);
    
    // Exit with error code if any tests failed
    process.exit(totalFailed > 0 ? 1 : 0);
}

runAllTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});
