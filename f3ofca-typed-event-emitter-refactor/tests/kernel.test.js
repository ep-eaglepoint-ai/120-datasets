// filename: kernel.test.js

const assert = require('assert');
const { EventKernel, SchemaViolationError } = require('../repository_after/EventKernel');

/**
 * Test Suite for EventKernel
 */

// Requirement 1: Schema Enforcement
async function testSchemaEnforcement() {
    const kernel = new EventKernel();

    // Register a schema
    kernel.registerSchema('TEST_EVENT', (payload) => {
        if (!payload.id) throw new Error('Missing id');
    });

    // Test 1a: Unregistered event should throw
    try {
        await kernel.emit('UNREGISTERED_EVENT', {});
        throw new Error('Should have thrown SchemaViolationError');
    } catch (error) {
        assert.strictEqual(error.name, 'SchemaViolationError');
        assert(error.message.includes('not registered'));
    }

    // Test 1b: Malformed payload should throw
    try {
        await kernel.emit('TEST_EVENT', { name: 'test' });
        throw new Error('Should have thrown SchemaViolationError');
    } catch (error) {
        assert.strictEqual(error.name, 'SchemaViolationError');
        assert(error.message.includes('Missing id'));
    }

    // Test 1c: Valid payload should not throw
    await kernel.emit('TEST_EVENT', { id: '123' });
}

// Requirement 2: Asynchronous Dispatch
async function testAsynchronousDispatch() {
    const kernel = new EventKernel();
    const results = [];

    kernel.registerSchema('ASYNC_TEST', () => { });

    kernel.on('ASYNC_TEST', async (payload) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        results.push('listener-done');
    });

    const startTime = Date.now();
    await kernel.emit('ASYNC_TEST', { data: 'test' });
    const emitDuration = Date.now() - startTime;

    // Emit should return in < 10ms (non-blocking)
    assert(emitDuration < 10, `Emit took ${emitDuration}ms, expected < 10ms`);

    // Wait for listener to complete
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0], 'listener-done');
}

// Requirement 3: Middleware Pipeline
async function testMiddlewarePipeline() {
    const kernel = new EventKernel();
    const results = [];

    kernel.registerSchema('MIDDLEWARE_TEST', () => { });

    // Middleware 1: Modify payload
    kernel.use((event) => {
        event.payload.modified = true;
        return event;
    });

    // Middleware 2: Inject correlationId
    kernel.use((event) => {
        event.payload.correlationId = 'test-correlation-id';
        return event;
    });

    // Middleware 3: Halt propagation for specific condition
    kernel.use((event) => {
        if (event.payload.halt) {
            return null;
        }
        return event;
    });

    kernel.on('MIDDLEWARE_TEST', async (payload) => {
        results.push(payload);
    });

    // Test 3a: Middleware modifies payload
    await kernel.emit('MIDDLEWARE_TEST', { data: 'test' });
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.strictEqual(results[0].modified, true);
    assert.strictEqual(results[0].correlationId, 'test-correlation-id');

    // Test 3b: Middleware can halt propagation
    await kernel.emit('MIDDLEWARE_TEST', { halt: true });
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.strictEqual(results.length, 1); // No new event processed
}

// Requirement 4: Dead Letter Queue (DLQ)
async function testDeadLetterQueue() {
    const kernel = new EventKernel();

    kernel.registerSchema('DLQ_TEST', () => { });

    kernel.on('DLQ_TEST', async (payload) => {
        throw new Error('Listener failure');
    });

    await kernel.emit('DLQ_TEST', { data: 'test' });
    await new Promise(resolve => setTimeout(resolve, 50));

    const dlq = kernel.getDLQ();
    assert.strictEqual(dlq.length, 1);
    assert.strictEqual(dlq[0].event.type, 'DLQ_TEST');
    assert.strictEqual(dlq[0].error.message, 'Listener failure');
    assert(dlq[0].error.stack);
    assert(dlq[0].timestamp);
}

// Requirement 5: Circuit Breaker (3-strike policy)
async function testCircuitBreaker() {
    const kernel = new EventKernel();
    const callCount = [];

    kernel.registerSchema('CIRCUIT_TEST', () => { });

    kernel.on('CIRCUIT_TEST', async (payload) => {
        callCount.push(1);
        throw new Error('Failure');
    });

    // Trigger 3 failures
    for (let i = 0; i < 3; i++) {
        await kernel.emit('CIRCUIT_TEST', { attempt: i + 1 });
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    assert.strictEqual(callCount.length, 3);

    // 4th event should NOT reach the listener (circuit is tripped)
    await kernel.emit('CIRCUIT_TEST', { attempt: 4 });
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.strictEqual(callCount.length, 3); // Still 3, not 4

    const stats = kernel.getStats();
    assert.strictEqual(stats.trippedCircuitBreakers.length, 1);
}

// Requirement 6: Observability (getStats)
async function testObservability() {
    const kernel = new EventKernel();

    kernel.registerSchema('STATS_TEST', () => { });

    kernel.on('STATS_TEST', async (payload) => {
        if (payload.fail) throw new Error('Failure');
    });

    // Successful dispatch
    await kernel.emit('STATS_TEST', { fail: false });
    await new Promise(resolve => setTimeout(resolve, 50));

    // Failed dispatch
    await kernel.emit('STATS_TEST', { fail: true });
    await new Promise(resolve => setTimeout(resolve, 50));

    const stats = kernel.getStats();
    assert.strictEqual(stats.successfulDispatches, 1);
    assert.strictEqual(stats.dlqSize, 1);
}

// Requirement 7: Data Shape Preservation (SYSTEM_LOG level validation)
async function testSystemLogLevelValidation() {
    const kernel = new EventKernel();

    kernel.registerSchema('SYSTEM_LOG', (payload) => {
        const validLevels = ['INFO', 'WARN', 'ERROR'];
        if (!validLevels.includes(payload.level)) {
            throw new Error(`Invalid log level: ${payload.level}`);
        }
    });

    // Valid levels should pass
    await kernel.emit('SYSTEM_LOG', { level: 'INFO' });
    await kernel.emit('SYSTEM_LOG', { level: 'WARN' });
    await kernel.emit('SYSTEM_LOG', { level: 'ERROR' });

    // Invalid level should throw
    try {
        await kernel.emit('SYSTEM_LOG', { level: 'DEBUG' });
        throw new Error('Should have thrown SchemaViolationError');
    } catch (error) {
        assert.strictEqual(error.name, 'SchemaViolationError');
        assert(error.message.includes('Invalid log level'));
    }
}

// Requirement 8: ORDER_CREATED with missing 'id' should be caught by validation
async function testOrderCreatedMissingId() {
    const kernel = new EventKernel();
    const listenerCalled = [];

    kernel.registerSchema('ORDER_CREATED', (payload) => {
        if (!payload.id) throw new Error('Missing id');
        if (typeof payload.total !== 'number' || payload.total <= 0) {
            throw new Error('Invalid total');
        }
        if (!Array.isArray(payload.items)) {
            throw new Error('Invalid items');
        }
    });

    kernel.on('ORDER_CREATED', async (payload) => {
        listenerCalled.push(payload);
    });

    // Missing 'id' should throw before reaching listener
    try {
        await kernel.emit('ORDER_CREATED', { total: 100, items: [] });
        throw new Error('Should have thrown SchemaViolationError');
    } catch (error) {
        assert.strictEqual(error.name, 'SchemaViolationError');
        assert(error.message.includes('Missing id'));
    }

    await new Promise(resolve => setTimeout(resolve, 50));
    assert.strictEqual(listenerCalled.length, 0); // Listener never called
}

// Requirement 9: Slow Subscriber (200ms delay) - emit resolves in < 10ms
async function testSlowSubscriber() {
    const kernel = new EventKernel();

    kernel.registerSchema('SLOW_TEST', () => { });

    kernel.on('SLOW_TEST', async (payload) => {
        await new Promise(resolve => setTimeout(resolve, 200));
    });

    const startTime = Date.now();
    await kernel.emit('SLOW_TEST', { data: 'test' });
    const emitDuration = Date.now() - startTime;

    assert(emitDuration < 10, `Emit took ${emitDuration}ms, expected < 10ms`);
}

// Requirement 10: Circuit Breaker - 4th event not sent after 3 failures
async function testCircuitBreakerFourthEvent() {
    const kernel = new EventKernel();
    const callLog = [];

    kernel.registerSchema('CB_TEST', () => { });

    kernel.on('CB_TEST', async (payload) => {
        callLog.push(payload.attempt);
        throw new Error('Simulated failure');
    });

    // Trigger 3 failures
    for (let i = 1; i <= 3; i++) {
        await kernel.emit('CB_TEST', { attempt: i });
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    assert.deepStrictEqual(callLog, [1, 2, 3]);

    // 4th event should NOT reach listener
    await kernel.emit('CB_TEST', { attempt: 4 });
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.deepStrictEqual(callLog, [1, 2, 3]); // Still only 3 calls
    assert.strictEqual(callLog.includes(4), false);
}

async function testCircuitBreakerAutoReset() {
    const kernel = new EventKernel();
    const callLog = [];

    // Reduce the circuit breaker cooldown for testing (from 30 seconds to 100ms)
    // We need to modify the kernel instance to allow shorter cooldown for testing
    kernel.CIRCUIT_BREAKER_COOLDOWN = 100; // 100ms for testing

    kernel.registerSchema('AUTO_RESET_TEST', () => { });

    kernel.on('AUTO_RESET_TEST', async (payload) => {
        callLog.push({
            attempt: payload.attempt,
            timestamp: Date.now()
        });
        throw new Error('Simulated failure');
    });

    // Trigger 3 failures to trip the circuit breaker
    for (let i = 1; i <= 3; i++) {
        await kernel.emit('AUTO_RESET_TEST', { attempt: i });
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    assert.deepStrictEqual(callLog.map(c => c.attempt), [1, 2, 3]);

    // 4th event should NOT reach listener (circuit is tripped)
    await kernel.emit('AUTO_RESET_TEST', { attempt: 4 });
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.deepStrictEqual(callLog.map(c => c.attempt), [1, 2, 3]);

    // Wait for cooldown to expire (100ms + buffer)
    await new Promise(resolve => setTimeout(resolve, 150));

    // 5th event should reach listener (circuit should have auto-reset)
    await kernel.emit('AUTO_RESET_TEST', { attempt: 5 });
    await new Promise(resolve => setTimeout(resolve, 50));

    // Now we should have 4 calls (the 5th attempt)
    assert.strictEqual(callLog.length, 4);
    assert.strictEqual(callLog[3].attempt, 5);

    // Verify the circuit breaker stats
    const stats = kernel.getStats();
    // After the 5th failure, circuit should be tripped again
    assert.strictEqual(stats.trippedCircuitBreakers.length, 1);
}

async function testIPAddressAnonymization() {
    const kernel = new EventKernel();
    const processedEvents = [];

    kernel.registerSchema('USER_AUTH_ATTEMPT', (payload) => {
        if (!payload.userId) throw new Error('Missing userId');
        if (!payload.ip) throw new Error('Missing ip');
    });

    // Add IP anonymization middleware
    kernel.use((event) => {
        if (event.type === 'USER_AUTH_ATTEMPT' && event.payload.ip) {
            // Remove password if present
            if (event.payload.password) {
                delete event.payload.password;
            }

            // Anonymize IP address (keep only first octet)
            const ipParts = event.payload.ip.split('.');
            if (ipParts.length === 4) {
                event.payload.ip = `${ipParts[0]}.xxx.xxx.xxx`;
                event.payload.ipAnonymized = true;
            }
        }
        return event;
    });

    kernel.on('USER_AUTH_ATTEMPT', async (payload) => {
        processedEvents.push(payload);
    });

    // Emit event with real IP
    await kernel.emit('USER_AUTH_ATTEMPT', {
        userId: 'user123',
        ip: '192.168.1.100',
        password: 'secret123'
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify IP was anonymized and password removed
    assert.strictEqual(processedEvents.length, 1);
    assert.strictEqual(processedEvents[0].ip, '192.xxx.xxx.xxx');
    assert.strictEqual(processedEvents[0].ipAnonymized, true);
    assert.strictEqual(processedEvents[0].password, undefined);
}

// Run all tests
async function runAllTests() {
    const tests = [
        { name: 'Schema Enforcement', fn: testSchemaEnforcement },
        { name: 'Asynchronous Dispatch', fn: testAsynchronousDispatch },
        { name: 'Middleware Pipeline', fn: testMiddlewarePipeline },
        { name: 'Dead Letter Queue', fn: testDeadLetterQueue },
        { name: 'Circuit Breaker', fn: testCircuitBreaker },
        { name: 'Circuit Breaker Auto-Reset', fn: testCircuitBreakerAutoReset },
        { name: 'Observability', fn: testObservability },
        { name: 'System Log Level Validation', fn: testSystemLogLevelValidation },
        { name: 'Order Created Missing ID', fn: testOrderCreatedMissingId },
        { name: 'Slow Subscriber', fn: testSlowSubscriber },
        { name: 'Circuit Breaker Fourth Event', fn: testCircuitBreakerFourthEvent },
        { name: 'IP Address Anonymization', fn: testIPAddressAnonymization },
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            await test.fn();
            console.log(`  [✓ PASS] ${test.name}`);
            passed++;
        } catch (error) {
            console.log(`  [✗ FAIL] ${test.name}`);
            console.log(`    Error: ${error.message}`);
            failed++;
        }
    }

    return { passed, failed, total: tests.length };
}

module.exports = { runAllTests };

// Run tests if executed directly
if (require.main === module) {
    runAllTests().then(results => {
        console.log(`\nResults: ${results.passed} passed, ${results.failed} failed (total: ${results.total})`);
        process.exit(results.failed > 0 ? 1 : 0);
    });
}
