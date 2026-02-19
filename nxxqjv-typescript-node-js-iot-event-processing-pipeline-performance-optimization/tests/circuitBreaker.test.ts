import {
    createCircuitBreaker,
    DatabaseUnavailableError,
} from '../repository_after/src/circuitBreaker';

/** Circuit breaker tests: Req-16 (fail-fast on DB outage) */
describe('circuitBreaker', () => {
    describe('createCircuitBreaker', () => {
        /** TC-01 | Req-16: Execute runs fn and returns result when circuit closed */
        it('execute runs fn and returns result when closed', async () => {
            const breaker = createCircuitBreaker({ failureThreshold: 5, cooldownMs: 30_000 });
            const result = await breaker.execute(() => Promise.resolve(42));
            expect(result).toBe(42);
        });

        /** TC-02 | Req-16: Throw DatabaseUnavailableError when open after failureThreshold */
        it('execute throws DatabaseUnavailableError when open after failureThreshold failures', async () => {
            const breaker = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 60_000 });
            await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
            await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
            await expect(breaker.execute(() => Promise.resolve(1))).rejects.toThrow(DatabaseUnavailableError);
            expect(breaker.isOpen()).toBe(true);
        });

        /** TC-03 | Req-16: isOpen returns true when circuit is open */
        it('isOpen returns true when circuit is open', async () => {
            const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 60_000 });
            expect(breaker.isOpen()).toBe(false);
            await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
            expect(breaker.isOpen()).toBe(true);
        });

        /** TC-04 | Req-16: reset closes the circuit and allows execution again */
        it('reset closes the circuit', async () => {
            const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 60_000 });
            await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
            expect(breaker.isOpen()).toBe(true);
            breaker.reset();
            expect(breaker.isOpen()).toBe(false);
            const result = await breaker.execute(() => Promise.resolve(99));
            expect(result).toBe(99);
        });
    });

    describe('DatabaseUnavailableError', () => {
        /** TC-05 | Req-16: DatabaseUnavailableError has correct name and message */
        it('has correct name', () => {
            const err = new DatabaseUnavailableError('test');
            expect(err.name).toBe('DatabaseUnavailableError');
            expect(err.message).toBe('test');
        });
    });
});
