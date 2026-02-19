/**
 * Before: queue baseline – Req-5 (jobId, addBulk). Assert fixed behavior so most fail on buggy code.
 */
const mockAdd = jest.fn().mockResolvedValue({ id: '1' });
const mockAddBulk = jest.fn().mockResolvedValue([{ id: '1' }]);
const mockGetWaitingCount = jest.fn().mockResolvedValue(0);
const mockGetActiveCount = jest.fn().mockResolvedValue(0);

jest.mock('bullmq', () => ({
    Queue: jest.fn().mockImplementation(() => ({
        add: mockAdd,
        addBulk: mockAddBulk,
        getWaitingCount: mockGetWaitingCount,
        getActiveCount: mockGetActiveCount,
        close: jest.fn().mockResolvedValue(undefined),
    })),
    Worker: jest.fn().mockImplementation(() => ({ on: jest.fn(), close: jest.fn().mockResolvedValue(undefined) })),
}));

jest.mock('../../repository_before/database', () => ({ insertEvent: jest.fn().mockResolvedValue(undefined) }));

import { addEventToQueue, addEventsToQueue } from '../../repository_before/queue';

describe('queue (repository_before)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetWaitingCount.mockResolvedValue(0);
        mockGetActiveCount.mockResolvedValue(0);
    });

    describe('addEventToQueue', () => {
        /** TC-01 | Req-5: addEventToQueue uses jobId equal to event.event_id */
        it('uses jobId equal to event.event_id for idempotent queueing', async () => {
            const event = { event_id: 'ev-123', device_id: 'd1', sensor_type: 'temp', value: 25, unit: 'C', timestamp: '2024-01-01T00:00:00Z' };
            await addEventToQueue(event);
            expect(mockAdd).toHaveBeenCalledWith('process-event', event, { jobId: 'ev-123' });
        });
    });

    describe('addEventsToQueue', () => {
        /** TC-02 | Req-5: addEventsToQueue uses addBulk instead of multiple add */
        it('uses addBulk instead of multiple add calls', async () => {
            const events = [
                { event_id: 'e1', device_id: 'd1', sensor_type: 'temp', value: 25, unit: 'C', timestamp: '2024-01-01T00:00:00Z' },
                { event_id: 'e2', device_id: 'd1', sensor_type: 'temp', value: 26, unit: 'C', timestamp: '2024-01-01T00:00:01Z' },
            ];
            await addEventsToQueue(events);
            expect(mockAddBulk).toHaveBeenCalled();
            expect(mockAdd).not.toHaveBeenCalled();
        });
    });
});
