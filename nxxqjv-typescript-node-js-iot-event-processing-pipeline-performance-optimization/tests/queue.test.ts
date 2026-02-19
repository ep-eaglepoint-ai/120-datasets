const mockAdd = jest.fn().mockResolvedValue({ id: '1' });
const mockAddBulk = jest.fn().mockResolvedValue([{ id: '1' }]);
const mockGetWaitingCount = jest.fn().mockResolvedValue(0);
const mockGetActiveCount = jest.fn().mockResolvedValue(0);

jest.mock('bullmq', () => ({
    Queue: jest.fn().mockImplementation(() => ({
        add: mockAdd, addBulk: mockAddBulk,
        getWaitingCount: mockGetWaitingCount, getActiveCount: mockGetActiveCount,
        close: jest.fn().mockResolvedValue(undefined),
    })),
    Worker: jest.fn().mockImplementation(() => ({ on: jest.fn(), close: jest.fn().mockResolvedValue(undefined) })),
}));

jest.mock('../repository_after/src/database', () => ({ insertEventsBatch: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../repository_after/src/metrics', () => ({ incrementProcessed: jest.fn(), incrementFailed: jest.fn() }));

import { addEventToQueue, addEventsToQueue, getQueueDepth, canAcceptJob, QueueOverloadedError, startWorker } from '../repository_after/src/queue';

/** Queue module tests: Req-5 (addBulk, jobId), Req-6 (backpressure, QueueOverloadedError) */
describe('queue', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetWaitingCount.mockResolvedValue(0);
        mockGetActiveCount.mockResolvedValue(0);
    });

    describe('addEventToQueue', () => {
        /** TC-01 | Req-5: Use jobId equal to event_id for idempotency */
        it('uses jobId equal to event_id', async () => {
            const event = { event_id: 'ev-123', device_id: 'd1', sensor_type: 'temp', value: 25, unit: 'C', timestamp: '2024-01-01T00:00:00Z' };
            await addEventToQueue(event);
            expect(mockAdd).toHaveBeenCalledWith('process-event', event, { jobId: 'ev-123' });
        });
        it('throws QueueOverloadedError when queue depth exceeds threshold', async () => {
            mockGetWaitingCount.mockResolvedValue(5000);
            mockGetActiveCount.mockResolvedValue(5001);
            const event = { event_id: 'ev-1', device_id: 'd1', sensor_type: 'temp', value: 25, unit: 'C', timestamp: '2024-01-01T00:00:00Z' };
            await expect(addEventToQueue(event)).rejects.toThrow(QueueOverloadedError);
            expect(mockAdd).not.toHaveBeenCalled();
        });
    });

    describe('addEventsToQueue', () => {
        /** TC-03 | Req-5: Use addBulk with jobId per event */
        it('uses addBulk with jobId per event for small batches', async () => {
            const events = [
                { event_id: 'e1', device_id: 'd1', sensor_type: 'temp', value: 25, unit: 'C', timestamp: '2024-01-01T00:00:00Z' },
                { event_id: 'e2', device_id: 'd1', sensor_type: 'temp', value: 26, unit: 'C', timestamp: '2024-01-01T00:00:01Z' },
            ];
            await addEventsToQueue(events);
            expect(mockAddBulk).toHaveBeenCalled();
            const jobs = mockAddBulk.mock.calls[0][0];
            expect(jobs).toHaveLength(2);
            expect(jobs[0]).toEqual({ name: 'process-event', data: events[0], opts: { jobId: 'e1' } });
            expect(jobs[1]).toEqual({ name: 'process-event', data: events[1], opts: { jobId: 'e2' } });
        });
        /** TC-04 | Req-6: Throw QueueOverloadedError on addEventsToQueue when overloaded */
        it('throws QueueOverloadedError when queue depth exceeds threshold', async () => {
            mockGetWaitingCount.mockResolvedValue(10000);
            mockGetActiveCount.mockResolvedValue(0);
            await expect(addEventsToQueue([{ event_id: 'e1', device_id: 'd1', sensor_type: 'temp', value: 25, unit: 'C', timestamp: '2024-01-01T00:00:00Z' }])).rejects.toThrow(QueueOverloadedError);
            expect(mockAddBulk).not.toHaveBeenCalled();
        });
        /** TC-04b | Req-7: Use addBulk with process-batch jobs for batches larger than 1000 */
        it('uses addBulk with process-batch jobs for batches larger than 1000', async () => {
            const events = Array.from({ length: 2500 }, (_, i) => ({
                event_id: 'e' + i,
                device_id: 'd1',
                sensor_type: 'temp',
                value: i,
                unit: 'C',
                timestamp: '2024-01-01T00:00:00Z',
            }));
            await addEventsToQueue(events);
            expect(mockAddBulk).toHaveBeenCalledTimes(1);
            const jobs = mockAddBulk.mock.calls[0][0];
            expect(jobs).toHaveLength(3); // 1000 + 1000 + 500
            expect(jobs[0].name).toBe('process-batch');
            expect(jobs[0].data).toEqual({ events: events.slice(0, 1000) });
            expect(jobs[0].opts.jobId).toMatch(/^batch-0-/);
            expect(jobs[1].data).toEqual({ events: events.slice(1000, 2000) });
            expect(jobs[2].data).toEqual({ events: events.slice(2000, 2500) });
        });
    });

    describe('getQueueDepth', () => {
        /** TC-05 | Req-6: Return waiting + active count for backpressure check */
        it('returns waiting + active count', async () => {
            mockGetWaitingCount.mockResolvedValue(100);
            mockGetActiveCount.mockResolvedValue(5);
            expect(await getQueueDepth()).toBe(105);
        });
    });

    describe('canAcceptJob', () => {
        /** TC-06 | Req-6: Return true when depth below threshold */
        it('returns true when depth below threshold', async () => {
            mockGetWaitingCount.mockResolvedValue(100);
            mockGetActiveCount.mockResolvedValue(0);
            expect(await canAcceptJob()).toBe(true);
        });
        /** TC-07 | Req-6: Return false when depth at or above threshold */
        it('returns false when depth at or above threshold', async () => {
            mockGetWaitingCount.mockResolvedValue(10000);
            mockGetActiveCount.mockResolvedValue(0);
            expect(await canAcceptJob()).toBe(false);
        });
    });

    /** Req-8: Worker created with concurrency option */
    describe('startWorker', () => {
        it('creates Worker with concurrency from config', () => {
            const bullmq = require('bullmq') as { Worker: jest.Mock };
            bullmq.Worker.mockClear();
            startWorker();
            expect(bullmq.Worker).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(Function),
                expect.objectContaining({ concurrency: 20 })
            );
        });
    });
});
