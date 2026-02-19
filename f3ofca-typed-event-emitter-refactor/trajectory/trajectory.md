# Trajectory: Typed Event Emitter Refactor

## 1. Audit the Original Code (Identify Scaling Problems)

I audited the legacy `LegacyBusManager.js` implementation and identified critical architectural flaws:

- **Synchronous Execution**: Listeners executed synchronously via EventEmitter, blocking the main event loop
- **No Schema Validation**: Events accepted any payload without validation, leading to runtime errors
- **Manual Type Checking**: Brittle `if-in` checks scattered throughout the codebase
- **No Error Recovery**: Listener failures were silently swallowed with no recovery mechanism
- **No Resiliency**: A single failing listener could destabilize the entire event bus
- **Side-Effect Coupling**: PII scrubbing and logging logic tightly coupled to event handlers
- **No Observability**: No metrics, monitoring, or visibility into event processing

These issues would not scale in a production microservices environment where event throughput is high and reliability is critical.

## 2. Define a Performance Contract First

I defined strict architectural contracts for the refactored system:

- **Schema Enforcement**: All events must be registered with validation schemas before emission
- **Asynchronous Dispatch**: Event emission must be non-blocking (< 10ms return time)
- **Middleware Pipeline**: Support composable middleware for cross-cutting concerns
- **Fault Tolerance**: Implement Dead Letter Queue (DLQ) for failed events
- **Circuit Breaker**: 3-strike policy to prevent cascading failures
- **Observability**: Expose metrics via `getStats()` method
- **Data Integrity**: Strict type validation for all event payloads

## 3. Rework the Architecture for Reliability

I introduced the `EventKernel` class as a hardened replacement for the legacy EventEmitter:

**Key Components:**
- **Schema Registry**: Map-based storage for event type validators
- **Listener Registry**: Organized listener storage with circuit breaker metadata
- **Middleware Stack**: Array-based pipeline for event transformations
- **Dead Letter Queue**: Array storage for failed events with error context
- **Circuit Breaker State**: Per-listener failure tracking with cooldown periods

This architecture separates concerns and provides clear extension points.

## 4. Rebuild Event Processing as an Async Pipeline

The new pipeline follows this flow:

1. **Validation Phase**: Check schema registration and validate payload
2. **Middleware Phase**: Transform event through middleware stack
3. **Async Dispatch**: Use `setImmediate()` for non-blocking listener execution
4. **Resiliency Phase**: Wrap each listener in try-catch with DLQ and circuit breaker logic

This ensures the `emit()` call returns immediately while listeners execute asynchronously.

## 5. Implement Schema-Based Validation (Server-Side)

All event types now require explicit schema registration:

```javascript
kernel.registerSchema('ORDER_CREATED', (payload) => {
    if (!payload.id) throw new Error('Missing required field: id');
    if (typeof payload.total !== 'number' || payload.total <= 0) {
        throw new Error('Invalid field: total must be a positive number');
    }
    if (!Array.isArray(payload.items)) {
        throw new Error('Invalid field: items must be an array');
    }
});
```

This moves validation to the entry point, preventing invalid data from propagating.

## 6. Use Middleware Instead of Inline Side-Effects

Replaced inline PII scrubbing with composable middleware:

```javascript
kernel.use((event) => {
    if (event.type === 'USER_AUTH_ATTEMPT') {
        if (event.payload.password) delete event.payload.password;
    }
    return event;
});
```

Middleware can modify payloads, inject metadata, or halt propagation—all without coupling to specific listeners.

## 7. Asynchronous Dispatch + Circuit Breaker Pattern

Implemented non-blocking dispatch with fault tolerance:

- Events dispatched via `setImmediate()` to prevent blocking
- Each listener wrapped in try-catch
- Failed listeners tracked with failure count
- After 3 consecutive failures, listener is "tripped" for 30 seconds
- DLQ captures failed events with full error context

## 8. Eliminate Error Swallowing with DLQ

The Dead Letter Queue provides:

- **Event Preservation**: Failed events stored with original payload
- **Error Context**: Full error message and stack trace captured
- **Timestamp**: ISO 8601 timestamp for debugging
- **Manual Inspection**: DLQ accessible via `getDLQ()` method

This ensures no event is silently lost.

## 9. Add Observability for Production Monitoring

Implemented `getStats()` method returning:

```javascript
{
    successfulDispatches: <count>,
    dlqSize: <count>,
    trippedCircuitBreakers: [<listener_ids>]
}
```

This enables monitoring, alerting, and capacity planning.

## 10. Result: Measurable Reliability Gains + Predictable Behavior

The refactored system provides:

- **Non-blocking**: `emit()` returns in < 10ms regardless of listener complexity
- **Type Safety**: Schema violations caught at emission time
- **Fault Tolerance**: Listener failures don't crash the process
- **Self-Healing**: Circuit breakers automatically recover after cooldown
- **Observability**: Real-time metrics for monitoring
- **Extensibility**: Middleware pipeline for cross-cutting concerns

## Trajectory Transferability

This refactoring trajectory follows the **Audit → Contract → Design → Execute → Verify** pattern, which is transferable to other categories:

### Refactoring → Full-Stack Development
- Code audit becomes system & product flow audit
- Performance contract becomes API, UX, and data contracts
- Schema validation extends to DTOs and frontend state shape
- Async dispatch maps to API payload shaping
- Add API schemas, frontend data flow, and latency budgets

### Refactoring → Performance Optimization
- Code audit becomes runtime profiling & bottleneck detection
- Performance contract expands to SLOs, SLAs, latency budgets
- Async patterns focus on hot paths
- Verification uses metrics, benchmarks, and load tests
- Add observability tools and before/after measurements

### Refactoring → Testing
- Code audit becomes test coverage & risk audit
- Performance contract becomes test strategy & guarantees
- Schema validation converts to fixtures and factories
- Async dispatch maps to deterministic tests
- Final verification becomes assertions & invariants

## Core Principle (Applies to All)
- The trajectory structure stays the same
- Only the focus and artifacts change
- **Audit → Contract → Design → Execute → Verify** remains constant
