import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { config } from './config';
import { SensorEvent, BatchPayload } from './types';
import { addEventToQueue, addEventsToQueue, getQueueStats, startWorker } from './queue';
import { setupWebSocket, getConnectedClients } from './websocket';
import { getEventStats } from './database';

const app = express();
app.use(express.json({ limit: '10mb' }));

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
        
        res.status(202).json({ status: 'accepted', event_id: event.event_id });
    } catch (error) {
        next(error);
    }
});

app.post('/events/batch', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payload: BatchPayload = req.body;
        
        if (!Array.isArray(payload.events)) {
            return res.status(400).json({ error: 'Invalid batch format' });
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
        
        res.status(202).json({
            status: 'accepted',
            accepted: validEvents.length,
            rejected: invalidIndexes.length,
            invalid_indexes: invalidIndexes,
        });
    } catch (error) {
        next(error);
    }
});

app.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const queueStats = await getQueueStats();
        const dbStats = await getEventStats();
        
        res.json({
            queue: queueStats,
            database: dbStats,
            websocket_clients: getConnectedClients(),
        });
    } catch (error) {
        next(error);
    }
});

app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'healthy' });
});

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

const server = createServer(app);

const wss = setupWebSocket(server);

startWorker();

export function getServer(): ReturnType<typeof createServer> {
    return server;
}

if (require.main === module) {
    server.listen(config.port, () => {
        console.log(`Server running on port ${config.port}`);
    });
    
    process.on('SIGTERM', () => {
        console.log('Shutting down...');
        process.exit(0);
    });
}
