// filename: LegacyBusManager.js

const EventEmitter = require('events'); 
// EventEmitter is the legacy core. It provides .on() and .emit(). 
// side effect: listeners are executed synchronously by default.
const bus = new EventEmitter(); 

/**
 * LEGACY PERSISTENCE MOCKS (Context Only)
 * These represent our internal storage/external calls.
 */
const db = { 
    save: async (collection, data) => { /* side-effect: DB IO */ },
    log: async (msg) => { console.log(msg); }
};

/**
 * This monolithic handler is the source of frequent race conditions and memory leaks.
 * It currently manually processes 'ORDER_CREATED', 'USER_AUTH_ATTEMPT', and 'SYSTEM_LOG'.
 */
bus.on('DISPATCH', async (event) => {
    // Problem: Manually handling PII scrubbing for every event type here
    if (event.type === 'USER_AUTH_ATTEMPT') {
        if (event.payload.password) delete event.payload.password; // Scrubber
        if (!event.payload.userId || !event.payload.ip) {
            console.error('Invalid Auth Payload');
            return;
        }
        await db.save('security_logs', event.payload);
    }

    if (event.type === 'ORDER_CREATED') {
        // Problem: Deep nesting and manual property access
        if (event.payload.total > 0 && Array.isArray(event.payload.items)) {
            try {
                // Problem: If this save blocks, the entire emitter is stuck
                await db.save('orders', event.payload);
                await db.log(`Order ${event.payload.id} successful`);
            } catch (err) {
                // Problem: No recovery; errors are just swallowed locally
                console.log('Order failed');
            }
        }
    }

    if (event.type === 'SYSTEM_LOG') {
        // Rule: Log level must be INFO, WARN, or ERROR
        const levels = ['INFO', 'WARN', 'ERROR'];
        if (levels.includes(event.payload.level)) {
            await db.log(`[${event.payload.level}] ${event.payload.component}: ${event.payload.message}`);
        }
    }
});

module.exports = { 
    emit: (type, payload) => bus.emit('DISPATCH', { type, payload })
};