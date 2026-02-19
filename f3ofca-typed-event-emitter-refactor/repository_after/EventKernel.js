// filename: EventKernel.js

/**
 * Custom Error Classes
 */
class SchemaViolationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SchemaViolationError';
    }
}

/**
 * EventKernel - A hardened, schema-enforced event bus with resiliency features
 */
class EventKernel {
    constructor() {
        this.schemas = new Map();
        this.listeners = new Map();
        this.middlewares = [];
        this.dlq = [];
        this.circuitBreakers = new Map();
        this.stats = {
            successfulDispatches: 0,
            failedDispatches: 0
        };
        this.CIRCUIT_BREAKER_THRESHOLD = 3;
        this.CIRCUIT_BREAKER_COOLDOWN = 30000; // 30 seconds
        this._listenerIdCounter = 0;
    }

    /**
     * Register an event schema
     * @param {string} eventType - The event type name
     * @param {Function} validator - Validation function that throws on invalid payload
     */
    registerSchema(eventType, validator) {
        this.schemas.set(eventType, validator);
        return this;
    }

    /**
     * Add middleware to the pipeline
     * @param {Function} middleware - Middleware function (event) => event | null
     */
    use(middleware) {
        this.middlewares.push(middleware);
        return this;
    }

    /**
     * Subscribe to an event
     * @param {string} eventType - The event type to listen for
     * @param {Function} listener - The listener function
     */
    on(eventType, listener) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        
        // Assign unique ID to listener for circuit breaker tracking
        if (!listener.__kernelId) {
            listener.__kernelId = `listener_${this._listenerIdCounter++}_${Date.now()}`;
        }
        
        this.listeners.get(eventType).push(listener);

        // Initialize circuit breaker for this listener
        if (!this.circuitBreakers.has(listener.__kernelId)) {
            this.circuitBreakers.set(listener.__kernelId, {
                failures: 0,
                trippedUntil: 0
            });
        }
        return this;
    }

    /**
     * Emit an event asynchronously
     * @param {string} eventType - The event type
     * @param {*} payload - The event payload
     */
    async emit(eventType, payload) {
        // Validate schema registration
        if (!this.schemas.has(eventType)) {
            throw new SchemaViolationError(`Event type '${eventType}' is not registered`);
        }

        // Validate payload against schema
        const validator = this.schemas.get(eventType);
        try {
            validator(payload);
        } catch (error) {
            throw new SchemaViolationError(`Schema validation failed for '${eventType}': ${error.message}`);
        }

        // Create event object with deep clone to prevent mutations
        let event = {
            type: eventType,
            payload: JSON.parse(JSON.stringify(payload))
        };

        // Run middleware pipeline
        for (const middleware of this.middlewares) {
            const result = middleware(event);
            if (result === null || result === false) {
                // Middleware halted the event
                return;
            }
            if (result) {
                event = result;
            }
        }

        // Dispatch asynchronously (non-blocking)
        // Each listener runs independently without blocking others
        setImmediate(() => this._dispatchToListeners(event));
    }

    /**
     * Internal method to dispatch events to listeners
     * Each listener runs independently in parallel
     * @private
     */
    _dispatchToListeners(event) {
        const listeners = this.listeners.get(event.type) || [];

        // Trigger all listeners in parallel - no listener blocks another
        listeners.forEach(listener => this._invokeSubscriber(listener, event));
    }

    /**
     * Invoke a single subscriber with circuit breaker protection
     * @private
     */
    async _invokeSubscriber(listener, event) {
        const breaker = this.circuitBreakers.get(listener.__kernelId);
        
        // Check if circuit breaker is tripped (time-based cooldown)
        if (Date.now() < breaker.trippedUntil) {
            return; // Circuit is still open, skip this listener
        }

        try {
            await listener(event.payload);
            this.stats.successfulDispatches++;
            // Reset failure count on success
            breaker.failures = 0;
        } catch (error) {
            this.stats.failedDispatches++;
            breaker.failures++;

            // Add to DLQ with full error context
            this.dlq.push({
                event,
                error: {
                    message: error.message,
                    stack: error.stack
                },
                timestamp: new Date().toISOString(),
                listenerId: listener.__kernelId
            });

            // Trip circuit breaker if threshold reached
            if (breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
                breaker.trippedUntil = Date.now() + this.CIRCUIT_BREAKER_COOLDOWN;
            }
        }
    }

    /**
     * Get observability statistics
     */
    getStats() {
        const trippedBreakers = [];
        const now = Date.now();
        
        for (const [listenerId, breaker] of this.circuitBreakers.entries()) {
            if (now < breaker.trippedUntil) {
                trippedBreakers.push(listenerId);
            }
        }

        return {
            successfulDispatches: this.stats.successfulDispatches,
            dlqSize: this.dlq.length,
            trippedCircuitBreakers: trippedBreakers
        };
    }

    /**
     * Get the Dead Letter Queue
     */
    getDLQ() {
        return [...this.dlq];
    }

    /**
     * Clear the Dead Letter Queue
     */
    clearDLQ() {
        this.dlq = [];
    }
}

module.exports = { EventKernel, SchemaViolationError };
