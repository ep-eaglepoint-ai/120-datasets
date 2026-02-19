// filename: LegacyBusManager.js

const { EventKernel } = require('./EventKernel');

/**
 * LEGACY PERSISTENCE MOCKS (Context Only)
 * These represent our internal storage/external calls.
 */
const db = {
    save: async (collection, data) => { /* side-effect: DB IO */ },
    log: async (msg) => { console.log(msg); }
};

// Create the EventKernel instance
const kernel = new EventKernel();

// Register schemas for all event types
kernel.registerSchema('ORDER_CREATED', (payload) => {
    if (!payload.id) {
        throw new Error('Missing required field: id');
    }
    if (typeof payload.total !== 'number' || payload.total <= 0) {
        throw new Error('Invalid field: total must be a positive number');
    }
    if (!Array.isArray(payload.items)) {
        throw new Error('Invalid field: items must be an array');
    }
});

kernel.registerSchema('USER_AUTH_ATTEMPT', (payload) => {
    if (!payload.userId) {
        throw new Error('Missing required field: userId');
    }
    if (!payload.ip) {
        throw new Error('Missing required field: ip');
    }
});

kernel.registerSchema('SYSTEM_LOG', (payload) => {
    const validLevels = ['INFO', 'WARN', 'ERROR'];
    if (!validLevels.includes(payload.level)) {
        throw new Error(`Invalid log level: ${payload.level}. Must be one of: ${validLevels.join(', ')}`);
    }
    if (!payload.component) {
        throw new Error('Missing required field: component');
    }
    if (!payload.message) {
        throw new Error('Missing required field: message');
    }
});

// Add middleware for PII scrubbing
kernel.use((event) => {
    if (event.type === 'USER_AUTH_ATTEMPT') {
        // Remove password from payload
        if (event.payload.password) {
            delete event.payload.password;
        }
    }
    return event;
});

kernel.use((event) => {
    if (event.type === 'USER_AUTH_ATTEMPT') {
        // Remove password from payload
        if (event.payload.password) {
            delete event.payload.password;
        }

        // Anonymize IP address (keep only first octet)
        if (event.payload.ip) {
            const ipParts = event.payload.ip.split('.');
            if (ipParts.length === 4) {
                // Keep first octet, mask the rest
                event.payload.ip = `${ipParts[0]}.xxx.xxx.xxx`;
                event.payload.ipAnonymized = true;
            }
        }
    }
    return event;
});

// Add middleware for correlation ID injection
kernel.use((event) => {
    if (!event.payload.correlationId) {
        event.payload.correlationId = `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    return event;
});

// Register listeners for each event type
kernel.on('ORDER_CREATED', async (payload) => {
    await db.save('orders', payload);
    await db.log(`Order ${payload.id} successful`);
});

kernel.on('USER_AUTH_ATTEMPT', async (payload) => {
    await db.save('security_logs', payload);
});

kernel.on('SYSTEM_LOG', async (payload) => {
    await db.log(`[${payload.level}] ${payload.component}: ${payload.message}`);
});

// Export the emit function and kernel for testing
module.exports = {
    emit: (type, payload) => kernel.emit(type, payload),
    kernel
};
