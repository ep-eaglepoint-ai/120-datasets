// Test runner for repository_before
// This should show failures because the legacy implementation lacks features

const path = require('path');
const Module = require('module');

// Clear require cache to ensure fresh loads
delete require.cache[require.resolve('./legacy.test.js')];
delete require.cache[require.resolve('./kernel.test.js')];

// Override require to redirect to repository_before
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
    if (id.includes('../repository_before/LegacyBusManager')) {
        return originalRequire.call(this, path.join(__dirname, '..', 'repository_before', 'LegacyBusManager.js'));
    }
    if (id.includes('../repository_after/EventKernel')) {
        // For before tests, EventKernel doesn't exist, so return a mock
        return { EventKernel: function() {}, SchemaViolationError: Error };
    }
    if (id.includes('../repository_after/LegacyBusManager')) {
        // Redirect to repository_before
        return originalRequire.call(this, path.join(__dirname, '..', 'repository_before', 'LegacyBusManager.js'));
    }
    return originalRequire.apply(this, arguments);
};

async function runAllTests() {
    console.log('Testing repository_before implementation...\n');
    
    const { runAllLegacyTests } = require('./legacy.test.js');
    const { runAllTests: runKernelTests } = require('./kernel.test.js');
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    // Run legacy tests (should fail - before lacks features)
    const legacyResults = await runAllLegacyTests();
    totalPassed += legacyResults.passed;
    totalFailed += legacyResults.failed;
    
    console.log('\n');
    
    // Run kernel tests (should fail - before lacks EventKernel)
    const kernelResults = await runKernelTests();
    totalPassed += kernelResults.passed;
    totalFailed += kernelResults.failed;
    
    console.log(`\n=== TOTAL: ${totalPassed} passed, ${totalFailed} failed (total: ${totalPassed + totalFailed}) ===\n`);
    
    // Always exit 0 for before tests
    process.exit(0);
}

runAllTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(0); // Still exit 0 for before
});
