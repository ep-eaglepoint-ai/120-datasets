import { Request, Response, NextFunction } from 'express';
import { config } from './config';

export function requestTimeoutMiddleware(timeoutMs: number = config.requestTimeoutMs) {
    return (req: Request, res: Response, next: NextFunction) => {
        const timer = setTimeout(() => {
            if (!res.headersSent) {
                res.status(504).json({ error: 'Gateway Timeout' });
                res.end();
            }
        }, timeoutMs);

        const onFinish = () => {
            clearTimeout(timer);
            res.removeListener('finish', onFinish);
            res.removeListener('close', onFinish);
        };
        res.once('finish', onFinish);
        res.once('close', onFinish);
        next();
    };
}
