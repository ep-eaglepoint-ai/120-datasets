# Trajectory: IoT event pipeline performance optimization

## Phase 1: Audit / requirements

The pipeline was OOMing after sustained load and capping at low DB throughput. Root causes: repository_before used a new pg Client per request in database.ts and closed it every time, so no connection reuse. Queue added events one-by-one with add() and had no backpressure, so the queue could grow unbounded and events dropped silently. WebSocket clients and EventEmitter listeners were not cleaned up on disconnect/error, so we saw leaks and MaxListenersExceededWarning. Large batch JSON was parsed on the main thread, causing CPU spikes. There was no graceful shutdown, so in-flight work was lost on SIGTERM.

## Phase 2: Question assumptions

We didn’t need a full rewrite. The shape of the API (POST /events, POST /events/batch, GET /stats) and the event model could stay. The fix was targeted: add pooling, batch inserts, backpressure, cleanup, and a circuit breaker so we fail fast when the DB is down. Keeping repository_before as-is (with a small compatibility layer for tests) let us run the same test suite against both and show fail-to-pass.

## Phase 3: Success criteria

Database: move from Client per call to a Pool in repository_after/src/database.ts; add insertEventsBatch with chunked INSERT and ON CONFLICT (event_id) DO NOTHING; expose closePool and isDatabaseHealthy. Queue: use addBulk and jobId per event in repository_after/src/queue.ts; add getQueueDepth and canAcceptJob and throw QueueOverloadedError when over threshold. App: add /health and /metrics (queue depth, circuit breaker, in-memory metrics from repository_after/src/metrics.ts), request timeout via timeoutMiddleware, and offload large JSON parsing to a worker (parseLargeJson.ts). WebSocket: clean up clients on close/error and cap EventEmitter listeners; broadcast with a single stringify per event. Shutdown: repository_after/src/shutdown.ts coordinates closing server, WebSocket, worker, and pool on SIGTERM/SIGINT.

## Phase 4: Validation

The same tests live under tests/ and import from repository_after/src when TEST_TARGET=after; with TEST_TARGET=before, Jest’s moduleNameMapper points those imports at repository_before so the suite runs against the old code. Most tests fail on before and pass on after. evaluation/evaluation.ts runs Jest twice (before and after), writes evaluation/date/time/report.json, and exits with success only if the after run passes. Root package.json has test:before, test:after, and evaluate; Docker is documented in README with three commands only.

## Phase 5: Scope

Changes are in repository_after: database.ts (Pool, insertEventsBatch, closePool, isDatabaseHealthy), queue.ts (addBulk, jobId, getQueueDepth, canAcceptJob, QueueOverloadedError, worker error handling), websocket.ts (cleanup, getBroadcastFn), app.ts (health, metrics, timeout, large-payload path). New modules: circuitBreaker.ts, metrics.ts, timeoutMiddleware.ts, shutdown.ts, parseLargeJson.ts, largePayloadHandler.ts. repository_before got a thin compatibility layer (same export names, stub or buggy behavior) so the same test files load. tests/jest.config.js and tests/jest.setup.js live under tests/; evaluation.ts and report output stay in evaluation/.

## Phase 6: Data / control flow

Before: HTTP request → validate → add() per event (or loop); worker → insertEvent (new Client, query, end). No backpressure, no batching, no circuit breaker. After: request → optional worker-thread parse if body is large → validate → canAcceptJob check → addBulk (or single add with jobId). Worker → insertEventsBatch (through circuit breaker); circuit breaker wraps all DB calls. Health checks read queue depth and circuit state. Shutdown closes HTTP, WebSocket, worker, and pool in order.

## Phase 7: Objections

More moving parts (circuit breaker, metrics, worker thread) add code. Counter: they address real failure modes and observability; without them we can’t hit the throughput target or debug in production. Another concern: repository_before now has stub exports (e.g. circuitBreaker, metrics) that don’t “do” much. That’s intentional so the same test suite can run against both without changing imports; the tests assert behavior that only repository_after implements.

## Phase 8: Invariants

We had to preserve the public API: same routes, same event shape, same response codes for success and validation errors. We added 503 when the queue is over threshold or the circuit is open, and we added /health and /metrics. Docker and the three documented commands (test:before, test:after, evaluate) stay the only supported way to run tests and evaluation.

## Phase 9: Execution order

Implement DB first (Pool, insertEventsBatch, circuit breaker wrapper, closePool, isDatabaseHealthy), then queue (addBulk, jobId, getQueueDepth, canAcceptJob, worker error handling), then WebSocket and EventEmitter cleanup and broadcast optimization, then app (health, metrics, timeout middleware, large-payload handling), then shutdown. After that, wire tests and evaluation (jest.config.js under tests/, evaluation.ts calling Jest with TEST_TARGET). Compatibility layer in repository_before can be added when switching the test suite to run against both targets.

## Phase 10: Measure

We know it’s better because: the after suite passes and the before suite fails when run with TEST_TARGET=after and TEST_TARGET=before; evaluation/evaluation.ts produces a report.json with both runs; /health and /metrics expose queue depth and circuit state; and the same API contract is preserved so existing callers don’t break.

## Phase 11: Document the decision

Problem: the pipeline was unstable under load (OOM, low throughput, silent drops, leaks) because of per-request DB connections, no batching or backpressure, and no cleanup or graceful shutdown. Solution: connection pooling, batched inserts with idempotency, queue backpressure, circuit breaker, request timeout, offloaded large-JSON parsing, WebSocket/EventEmitter cleanup, and coordinated shutdown. Trade-off: more modules and config for better reliability and observability. Revisit if scale or stack changes (e.g. different queue or DB) or if we need different SLOs.
