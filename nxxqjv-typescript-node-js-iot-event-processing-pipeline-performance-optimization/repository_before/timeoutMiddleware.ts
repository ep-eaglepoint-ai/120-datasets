import { Request, Response, NextFunction } from 'express';

export function requestTimeoutMiddleware(timeoutMs: number = 30000) {
    return (req: Request, res: Response, next: NextFunction) => {
        next();
    };
}

export function createTimeoutMiddleware(timeoutMs: number = 30000) {
    return requestTimeoutMiddleware(timeoutMs);
}
