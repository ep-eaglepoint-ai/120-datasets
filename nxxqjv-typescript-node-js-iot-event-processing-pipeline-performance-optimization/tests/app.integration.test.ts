const mockAddEventToQueue = jest.fn().mockResolvedValue(undefined);
const mockAddEventsToQueue = jest.fn().mockResolvedValue(undefined);
const mockGetQueueDepth = jest.fn().mockResolvedValue(0);
const mockGetQueueStats = jest.fn().mockResolvedValue({ waiting: 0, active: 0 });

jest.mock('../repository_after/src/queue', () => ({
    addEventToQueue: (...args: unknown[]) => mockAddEventToQueue(...args),
    addEventsToQueue: (...args: unknown[]) => mockAddEventsToQueue(...args),
    getQueueDepth: () => mockGetQueueDepth(),
    getQueueStats: () => mockGetQueueStats(),
    startWorker: jest.fn(),
    subscribeToProcessedEvents: jest.fn(),
    removeProcessedEventsListener: jest.fn(),
    getWorker: jest.fn().mockReturnValue(null),
    eventQueue: { close: jest.fn().mockResolvedValue(undefined) },
    eventEmitter: { on: jest.fn(), removeListener: jest.fn(), setMaxListeners: jest.fn() },
    QueueOverloadedError: class QueueOverloadedError extends Error {
        constructor(m: string) { super(m); this.name = 'QueueOverloadedError'; }
    },
}));

jest.mock('../repository_after/src/database', () => ({
    getEventStats: jest.fn().mockResolvedValue({ total: 0 }),
    isDatabaseHealthy: jest.fn().mockResolvedValue(true),
    closePool: jest.fn().mockResolvedValue(undefined),
}));

const mockCircuitBreakerIsOpen = jest.fn().mockReturnValue(false);
jest.mock('../repository_after/src/circuitBreaker', () => ({
    getCircuitBreaker: () => ({ execute: (fn: () => unknown) => fn(), isOpen: mockCircuitBreakerIsOpen }),
}));

import request from 'supertest';
import { getServer } from '../repository_after/src/app';

/** API integration tests: Req-5/15 (queue, jobId), Req-6 (backpressure 503), Req-12 (health), Req-17 (metrics) */
describe('API integration', () => {
    const server = getServer();

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetQueueDepth.mockResolvedValue(0);
        mockGetQueueStats.mockResolvedValue({ waiting: 0, active: 0 });
        mockCircuitBreakerIsOpen.mockReturnValue(false);
        const db = require('../repository_after/src/database');
        db.isDatabaseHealthy.mockResolvedValue(true);
    });

    describe('POST /events', () => {
        /** TC-01 | Req-5: Accept valid event and return 202, event enqueued */
        it('accepts valid event and returns 202', async () => {
            const event = { event_id: 'e1', device_id: 'd1', sensor_type: 'temp', value: 25, unit: 'C', timestamp: '2024-01-01T00:00:00Z' };
            const res = await request(server).post('/events').send(event).expect(202);
            expect(res.body).toEqual({ status: 'accepted', event_id: 'e1' });
            expect(mockAddEventToQueue).toHaveBeenCalledWith(event);
        });
        /** TC-02 | Req-5: Reject invalid event with 400 */
        it('returns 400 for invalid event', async () => {
            await request(server).post('/events').send({ event_id: 'e1' }).expect(400);
            expect(mockAddEventToQueue).not.toHaveBeenCalled();
        });
        it('returns 503 when queue overloaded', async () => {
            const { QueueOverloadedError } = require('../repository_after/src/queue');
            mockAddEventToQueue.mockRejectedValueOnce(new QueueOverloadedError('overloaded'));
            const res = await request(server).post('/events').send({
                event_id: 'e1', device_id: 'd1', sensor_type: 'temp', value: 25, unit: 'C', timestamp: '2024-01-01T00:00:00Z',
            }).expect(503);
            expect(res.body.reason).toBe('Queue overloaded');
        });
    });

    describe('POST /events/batch', () => {
        /** TC-04 | Req-5: Accept valid batch and return 202, batch enqueued */
        it('accepts valid batch and returns 202', async () => {
            const payload = { events: [{ event_id: 'e1', device_id: 'd1', sensor_type: 'temp', value: 25, unit: 'C', timestamp: '2024-01-01T00:00:00Z' }] };
            const res = await request(server).post('/events/batch').send(payload).expect(202);
            expect(res.body.status).toBe('accepted');
            expect(res.body.accepted).toBe(1);
            expect(mockAddEventsToQueue).toHaveBeenCalled();
        });
        it('returns 400 for invalid batch format', async () => {
            await request(server).post('/events/batch').send({ not_events: [] }).expect(400);
        });
        /** Req-6: Batch returns 503 when queue overloaded */
        it('returns 503 when queue overloaded on batch', async () => {
            const { QueueOverloadedError } = require('../repository_after/src/queue');
            mockAddEventsToQueue.mockRejectedValueOnce(new QueueOverloadedError('overloaded'));
            const payload = { events: [{ event_id: 'e1', device_id: 'd1', sensor_type: 'temp', value: 25, unit: 'C', timestamp: '2024-01-01T00:00:00Z' }] };
            const res = await request(server).post('/events/batch').send(payload).expect(503);
            expect(res.body.reason).toBe('Queue overloaded');
        });
    });

    describe('GET /health', () => {
        /** TC-06 | Req-12: Return 200 when queue and DB healthy */
        it('returns 200 healthy when queue and DB ok', async () => {
            const res = await request(server).get('/health').expect(200);
            expect(res.body).toEqual({ status: 'healthy' });
        });
        /** TC-07 | Req-12: Return 503 when queue overloaded */
        it('returns 503 when queue overloaded', async () => {
            mockGetQueueDepth.mockResolvedValue(15000);
            const res = await request(server).get('/health').expect(503);
            expect(res.body.status).toBe('unhealthy');
            expect(res.body.reason).toMatch(/Queue/);
        });
        /** TC-08 | Req-12: Return 503 when database unhealthy */
        it('returns 503 when database unhealthy', async () => {
            const db = require('../repository_after/src/database');
            db.isDatabaseHealthy.mockResolvedValue(false);
            const res = await request(server).get('/health').expect(503);
            expect(res.body.status).toBe('unhealthy');
        });
        it('returns 503 when circuit breaker open', async () => {
            mockCircuitBreakerIsOpen.mockReturnValueOnce(true);
            const res = await request(server).get('/health').expect(503);
            expect(res.body.status).toBe('unhealthy');
            expect(res.body.reason).toMatch(/Circuit breaker/);
        });
    });

    describe('GET /metrics', () => {
        /** TC-10 | Req-17: Return metrics with queue_depth, events_per_second, memory, websocket_clients */
        it('returns metrics structure', async () => {
            const res = await request(server).get('/metrics').expect(200);
            expect(res.body).toHaveProperty('total_received');
            expect(res.body).toHaveProperty('total_processed');
            expect(res.body).toHaveProperty('total_failed');
            expect(res.body).toHaveProperty('queue_depth');
            expect(res.body).toHaveProperty('events_per_second');
            expect(res.body).toHaveProperty('memory_usage_mb');
            expect(res.body).toHaveProperty('websocket_clients');
        });
    });

    describe('GET /stats', () => {
        /** TC-11 | Req-12: Return stats with queue, database, websocket_clients */
        it('returns queue, database, websocket_clients', async () => {
            const res = await request(server).get('/stats').expect(200);
            expect(res.body).toHaveProperty('queue');
            expect(res.body).toHaveProperty('database');
            expect(res.body).toHaveProperty('websocket_clients');
        });
    });
});
