export class DatabaseUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DatabaseUnavailableError';
        Object.setPrototypeOf(this, DatabaseUnavailableError.prototype);
    }
}

export function createCircuitBreaker(_options?: { failureThreshold?: number; cooldownMs?: number }) {
    return {
        async execute<T>(fn: () => Promise<T>): Promise<T> {
            return fn();
        },
        isOpen(): boolean {
            return false;
        },
        getState(): 'closed' | 'open' | 'half-open' {
            return 'closed';
        },
        reset(): void {},
    };
}

let defaultBreaker: ReturnType<typeof createCircuitBreaker> | null = null;

export function getCircuitBreaker(): ReturnType<typeof createCircuitBreaker> {
    if (!defaultBreaker) {
        defaultBreaker = createCircuitBreaker();
    }
    return defaultBreaker;
}
