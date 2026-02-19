import {
    incrementReceived,
    incrementProcessed,
    incrementFailed,
    getTotalReceived,
    getTotalProcessed,
    getTotalFailed,
    getEventsPerSecond,
    getMemoryUsageMb,
    resetMetrics,
} from '../repository_after/src/metrics';

/** Metrics tests: Req-17 (/metrics endpoint: total_processed, total_failed, queue_depth, events_per_second, memory_usage_mb) */
describe('metrics', () => {
    beforeEach(() => {
        resetMetrics();
    });

    /** TC-01 | Req-13: Increment and return total_received */
    it('increments and returns total_received', () => {
        expect(getTotalReceived()).toBe(0);
        incrementReceived(1);
        incrementReceived(5);
        expect(getTotalReceived()).toBe(6);
    });

    /** TC-02 | Req-13: Increment and return total_processed */
    it('increments and returns total_processed', () => {
        expect(getTotalProcessed()).toBe(0);
        incrementProcessed(1);
        incrementProcessed(10);
        expect(getTotalProcessed()).toBe(11);
    });

    /** TC-03 | Req-13: Increment and return total_failed */
    it('increments and returns total_failed', () => {
        expect(getTotalFailed()).toBe(0);
        incrementFailed(1);
        incrementFailed(2);
        expect(getTotalFailed()).toBe(3);
    });

    /** TC-04 | Req-13: getEventsPerSecond returns number (rate) */
    it('getEventsPerSecond returns number', () => {
        incrementProcessed(60);
        const rate = getEventsPerSecond();
        expect(typeof rate).toBe('number');
        expect(rate).toBeGreaterThanOrEqual(0);
    });

    /** TC-05 | Req-13: getMemoryUsageMb returns positive number */
    it('getMemoryUsageMb returns positive number', () => {
        const mb = getMemoryUsageMb();
        expect(typeof mb).toBe('number');
        expect(mb).toBeGreaterThanOrEqual(0);
    });

    /** TC-06 | Req-13: resetMetrics zeros counters */
    it('resetMetrics zeros counters', () => {
        incrementReceived(10);
        incrementProcessed(5);
        incrementFailed(1);
        resetMetrics();
        expect(getTotalReceived()).toBe(0);
        expect(getTotalProcessed()).toBe(0);
        expect(getTotalFailed()).toBe(0);
    });
});
