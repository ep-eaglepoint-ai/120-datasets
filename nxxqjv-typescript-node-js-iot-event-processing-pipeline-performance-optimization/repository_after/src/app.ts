import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { config } from './config';
import { SensorEvent, BatchPayload } from './types';
import {
    addEventToQueue,
    addEventsToQueue,
    getQueueStats,
    getQueueDepth,
    startWorker,
    subscribeToProcessedEvents,
    QueueOverloadedError,
} from './queue';
import { setupWebSocket, getBroadcastFn, getConnectedClients } from './websocket';
import { getEventStats, isDatabaseHealthy } from './database';
import { getCircuitBreaker } from './circuitBreaker';
import { requestTimeoutMiddleware } from './timeoutMiddleware';
import { gracefulShutdown, ShutdownHandles } from './shutdown';
import { getTotalReceived, getTotalProcessed, getTotalFailed, getEventsPerSecond, getMemoryUsageMb, incrementReceived } from './metrics';
import { parseLargeJsonInWorker } from './parseLargeJson';

const app = express();

app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/events/batch' && req.method === 'POST') return next();
    return express.json({ limit: '10mb' })(req, res, next);
});
app.use(requestTimeoutMiddleware());

function validateEvent(event: unknown): event is SensorEvent {
    if (typeof event !== 'object' || event === null) return false;
    const e = event as Record<string, unknown>;
    return (
        typeof e.event_id === 'string' &&
        typeof e.device_id === 'string' &&
        typeof e.sensor_type === 'string' &&
        typeof e.value === 'number' &&
        typeof e.unit === 'string' &&
        typeof e.timestamp === 'string'
    );
}

app.post('/events', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const event = req.body;
        if (!validateEvent(event)) {
            return res.status(400).json({ error: 'Invalid event format' });
        }
        await addEventToQueue(event);
        incrementReceived(1);
        res.status(202).json({ status: 'accepted', event_id: event.event_id });
    } catch (error) {
        if (error instanceof QueueOverloadedError) {
            return res.status(503).json({ error: 'Service Unavailable', reason: 'Queue overloaded' });
        }
        next(error);
    }
});

const rawJsonParser = express.raw({ type: 'application/json', limit: '10mb' });

app.post('/events/batch', rawJsonParser, async (req: Request, res: Response, next: NextFunction) => {
    if (Buffer.isBuffer(req.body) && req.body.length > config.largePayloadThresholdBytes) {
        try {
            req.body = await parseLargeJsonInWorker(req.body);
        } catch (err) {
            return next(err);
        }
    } else if (Buffer.isBuffer(req.body)) {
        try {
            req.body = JSON.parse(req.body.toString('utf8'));
        } catch (err) {
            return next(err);
        }
    }
    next();
}, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payload = req.body as BatchPayload;
        if (!payload || !Array.isArray(payload.events)) {
            return res.status(400).json({ error: 'Invalid batch format' });
        }
        if (payload.events.length > config.maxEventsPerBatch) {
            return res.status(400).json({ error: 'Batch size exceeds maximum ' + config.maxEventsPerBatch });
        }
        const validEvents: SensorEvent[] = [];
        const invalidIndexes: number[] = [];
        for (let i = 0; i < payload.events.length; i++) {
            if (validateEvent(payload.events[i])) {
                validEvents.push(payload.events[i]);
            } else {
                invalidIndexes.push(i);
            }
        }
        await addEventsToQueue(validEvents);
        incrementReceived(validEvents.length);
        res.status(202).json({
            status: 'accepted',
            accepted: validEvents.length,
            rejected: invalidIndexes.length,
            invalid_indexes: invalidIndexes,
        });
    } catch (error) {
        if (error instanceof QueueOverloadedError) {
            return res.status(503).json({ error: 'Service Unavailable', reason: 'Queue overloaded' });
        }
        next(error);
    }
});

app.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const queueStats = await getQueueStats();
        const dbStats = await getEventStats();
        res.json({ queue: queueStats, database: dbStats, websocket_clients: getConnectedClients() });
    } catch (error) {
        next(error);
    }
});

app.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const queueDepth = await getQueueDepth();
        res.json({
            total_received: getTotalReceived(),
            total_processed: getTotalProcessed(),
            total_failed: getTotalFailed(),
            queue_depth: queueDepth,
            events_per_second: Math.round(getEventsPerSecond() * 100) / 100,
            memory_usage_mb: getMemoryUsageMb(),
            websocket_clients: getConnectedClients(),
        });
    } catch (error) {
        next(error);
    }
});

app.get('/health', async (req: Request, res: Response) => {
    if (getCircuitBreaker().isOpen()) {
        return res.status(503).json({ status: 'unhealthy', reason: 'Circuit breaker open' });
    }
    const depth = await getQueueDepth();
    if (depth >= config.queue.backpressureThreshold) {
        return res.status(503).json({ status: 'unhealthy', reason: 'Queue overloaded' });
    }
    if (!(await isDatabaseHealthy())) {
        return res.status(503).json({ status: 'unhealthy', reason: 'Database unreachable' });
    }
    res.json({ status: 'healthy' });
});

app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', error);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

const server = createServer(app);
const wss = setupWebSocket(server);
subscribeToProcessedEvents(getBroadcastFn());
startWorker();

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const handles: ShutdownHandles = { server, wss };
process.on('SIGTERM', () => gracefulShutdown(handles));
process.on('SIGINT', () => gracefulShutdown(handles));

export function getServer(): ReturnType<typeof createServer> {
    return server;
}

export function listen(callback?: () => void): void {
    server.listen(config.port, () => {
        console.log('Server running on port ' + config.port);
        callback?.();
    });
}

if (require.main === module) {
    listen();
}
