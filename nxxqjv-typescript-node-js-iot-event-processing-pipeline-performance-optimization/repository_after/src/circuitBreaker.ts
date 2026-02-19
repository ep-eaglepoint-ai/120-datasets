/**
 * In-memory circuit breaker: after failureThreshold failures, open for cooldownMs.
 * State is per-instance so multiple breakers (e.g. in tests) do not interfere.
 */

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_COOLDOWN_MS = 30_000;

export class DatabaseUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DatabaseUnavailableError';
        Object.setPrototypeOf(this, DatabaseUnavailableError.prototype);
    }
}

export function createCircuitBreaker(options?: { failureThreshold?: number; cooldownMs?: number }) {
    const failureThreshold = options?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    const cooldownMs = options?.cooldownMs ?? DEFAULT_COOLDOWN_MS;

    let failureCount = 0;
    let openUntil = 0;
    let state: 'closed' | 'open' | 'half-open' = 'closed';

    return {
        async execute<T>(fn: () => Promise<T>): Promise<T> {
            const now = Date.now();
            if (state === 'open') {
                if (now < openUntil) {
                    throw new DatabaseUnavailableError('Circuit breaker is open');
                }
                state = 'half-open';
            }
            try {
                const result = await fn();
                if (state === 'half-open') {
                    state = 'closed';
                    failureCount = 0;
                } else {
                    failureCount = 0;
                }
                return result;
            } catch (err) {
                failureCount++;
                if (state === 'half-open' || failureCount >= failureThreshold) {
                    state = 'open';
                    openUntil = Date.now() + cooldownMs;
                }
                throw err;
            }
        },
        isOpen(): boolean {
            const now = Date.now();
            if (state === 'open' && now >= openUntil) {
                state = 'half-open';
            }
            return state === 'open';
        },
        getState(): 'closed' | 'open' | 'half-open' {
            const now = Date.now();
            if (state === 'open' && now >= openUntil) {
                state = 'half-open';
            }
            return state;
        },
        reset(): void {
            state = 'closed';
            failureCount = 0;
            openUntil = 0;
        },
    };
}

let defaultBreaker: ReturnType<typeof createCircuitBreaker> | null = null;

export function getCircuitBreaker(): ReturnType<typeof createCircuitBreaker> {
    if (!defaultBreaker) {
        defaultBreaker = createCircuitBreaker({ failureThreshold: 5, cooldownMs: 30_000 });
    }
    return defaultBreaker;
}
