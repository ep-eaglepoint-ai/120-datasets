const AuthService = require('./authService');

async function runTests() {
    const auth = new AuthService('test-secret');
    let passed = 0;
    let failed = 0;

    console.log('Running AuthService tests...\n');

    // Test 1: Register user
    try {
        const result = await auth.register('user@test.com', 'password123');
        if (result.success) {
            console.log('✓ Test 1: Register user - PASSED');
            passed++;
        } else {
            console.log('✗ Test 1: Register user - FAILED');
            failed++;
        }
    } catch (e) {
        console.log('✗ Test 1: Register user - ERROR:', e.message);
        failed++;
    }

    // Test 2: Login user
    try {
        const session = {};
        const result = await auth.login('user@test.com', 'password123', session);
        if (result.success && result.token) {
            console.log('✓ Test 2: Login user - PASSED');
            passed++;
        } else {
            console.log('✗ Test 2: Login user - FAILED');
            failed++;
        }
    } catch (e) {
        console.log('✗ Test 2: Login user - ERROR:', e.message);
        failed++;
    }

    // Test 3: Verify token
    try {
        const session = {};
        const loginResult = await auth.login('user@test.com', 'password123', session);
        const verifyResult = auth.verifyToken(loginResult.token);
        if (verifyResult.valid) {
            console.log('✓ Test 3: Verify token - PASSED');
            passed++;
        } else {
            console.log('✗ Test 3: Verify token - FAILED');
            failed++;
        }
    } catch (e) {
        console.log('✗ Test 3: Verify token - ERROR:', e.message);
        failed++;
    }

    // Test 4: Generate reset token
    try {
        const result = auth.generateResetToken('user@test.com');
        if (result.success && result.token) {
            console.log('✓ Test 4: Generate reset token - PASSED');
            passed++;
        } else {
            console.log('✗ Test 4: Generate reset token - FAILED');
            failed++;
        }
    } catch (e) {
        console.log('✗ Test 4: Generate reset token - ERROR:', e.message);
        failed++;
    }

    // Test 5: Reset password
    try {
        const resetResult = auth.generateResetToken('user@test.com');
        const result = await auth.resetPassword(resetResult.token, 'newpassword456');
        if (result.success) {
            console.log('✓ Test 5: Reset password - PASSED');
            passed++;
        } else {
            console.log('✗ Test 5: Reset password - FAILED');
            failed++;
        }
    } catch (e) {
        console.log('✗ Test 5: Reset password - ERROR:', e.message);
        failed++;
    }

    console.log(`\n========================================`);
    console.log(`Tests: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
    console.log(`========================================`);
}

runTests();

