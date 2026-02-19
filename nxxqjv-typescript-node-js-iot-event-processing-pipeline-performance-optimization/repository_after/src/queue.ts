import { Queue, Worker, Job } from 'bullmq';
import { EventEmitter } from 'events';
import { config } from './config';
import { SensorEvent, ProcessedEvent } from './types';
import { insertEventsBatch } from './database';
import { incrementProcessed, incrementFailed } from './metrics';

export const eventEmitter = new EventEmitter();
eventEmitter.setMaxListeners(1000);

export class QueueOverloadedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'QueueOverloadedError';
        Object.setPrototypeOf(this, QueueOverloadedError.prototype);
    }
}

export const eventQueue = new Queue(config.queue.name, {
    connection: config.redis,
});

let workerInstance: Worker | null = null;

function toProcessedEvent(event: SensorEvent, receivedAt: number): ProcessedEvent {
    return {
        ...event,
        timestamp: new Date(event.timestamp).toISOString(),
        processed_at: new Date(),
        received_at: new Date(receivedAt),
    };
}

async function processSingleJob(job: Job<SensorEvent>): Promise<void> {
    const event = job.data;
    const processed = toProcessedEvent(event, job.timestamp || Date.now());
    await insertEventsBatch([processed]);
    eventEmitter.emit('event_processed', processed);
    incrementProcessed(1);
}

async function processBatchJob(job: Job<{ events: SensorEvent[] }>): Promise<void> {
    const { events } = job.data;
    const receivedAt = job.timestamp || Date.now();
    const processed: ProcessedEvent[] = events.map((e) => toProcessedEvent(e, receivedAt));
    await insertEventsBatch(processed);
    for (const p of processed) {
        eventEmitter.emit('event_processed', p);
    }
    incrementProcessed(processed.length);
}

export function startWorker(): Worker {
    const worker = new Worker(
        config.queue.name,
        async (job: Job<SensorEvent | { events: SensorEvent[] }>) => {
            try {
                if ('events' in job.data && Array.isArray(job.data.events)) {
                    await processBatchJob(job as Job<{ events: SensorEvent[] }>);
                } else {
                    await processSingleJob(job as Job<SensorEvent>);
                }
            } catch (err) {
                const count = 'events' in job.data && Array.isArray(job.data.events) ? (job.data as { events: SensorEvent[] }).events.length : 1;
                incrementFailed(count);
                const eventId = 'event_id' in job.data ? (job.data as SensorEvent).event_id : 'batch';
                const deviceId = 'device_id' in job.data ? (job.data as SensorEvent).device_id : 'n/a';
                console.error('Job ' + job.id + ' failed (event_id=' + eventId + ', device_id=' + deviceId + '):', err);
                throw err;
            }
        },
        {
            connection: config.redis,
            concurrency: config.queue.concurrency,
        }
    );

    worker.on('completed', (job) => {
        if (process.env.NODE_ENV !== 'test') {
            console.log('Job ' + job.id + ' completed');
        }
    });

    worker.on('failed', (job, err) => {
        console.error('Job ' + (job?.id ?? '') + ' failed:', err);
    });

    workerInstance = worker;
    return worker;
}

export function getWorker(): Worker | null {
    return workerInstance;
}

export async function getQueueDepth(): Promise<number> {
    const waiting = await eventQueue.getWaitingCount();
    const active = await eventQueue.getActiveCount();
    return waiting + active;
}

export function canAcceptJob(): Promise<boolean> {
    return getQueueDepth().then((depth) => depth < config.queue.backpressureThreshold);
}

export async function addEventToQueue(event: SensorEvent): Promise<void> {
    const depth = await getQueueDepth();
    if (depth >= config.queue.backpressureThreshold) {
        throw new QueueOverloadedError('Queue depth ' + depth + ' exceeds threshold ' + config.queue.backpressureThreshold);
    }
    await eventQueue.add('process-event', event, { jobId: event.event_id });
}

const BATCH_CHUNK_SIZE = 1000;

export async function addEventsToQueue(events: SensorEvent[]): Promise<void> {
    const depth = await getQueueDepth();
    if (depth >= config.queue.backpressureThreshold) {
        throw new QueueOverloadedError('Queue depth ' + depth + ' exceeds threshold ' + config.queue.backpressureThreshold);
    }
    if (events.length === 0) return;

    if (events.length <= BATCH_CHUNK_SIZE) {
        const jobs = events.map((event) => ({
            name: 'process-event' as const,
            data: event,
            opts: { jobId: event.event_id },
        }));
        await eventQueue.addBulk(jobs);
        return;
    }

    const jobs: { name: string; data: SensorEvent | { events: SensorEvent[] }; opts: { jobId: string } }[] = [];
    for (let i = 0; i < events.length; i += BATCH_CHUNK_SIZE) {
        const chunk = events.slice(i, i + BATCH_CHUNK_SIZE);
        const firstId = chunk[0].event_id;
        const jobId = 'batch-' + i + '-' + firstId + '-' + chunk.length;
        jobs.push({
            name: 'process-batch',
            data: { events: chunk },
            opts: { jobId },
        });
    }
    await eventQueue.addBulk(jobs);
}

export async function getQueueStats(): Promise<{ waiting: number; active: number }> {
    const waiting = await eventQueue.getWaitingCount();
    const active = await eventQueue.getActiveCount();
    return { waiting, active };
}

export function subscribeToProcessedEvents(broadcastFn: (event: ProcessedEvent) => void): void {
    eventEmitter.on('event_processed', broadcastFn);
}

export function removeProcessedEventsListener(broadcastFn: (event: ProcessedEvent) => void): void {
    eventEmitter.removeListener('event_processed', broadcastFn);
}
