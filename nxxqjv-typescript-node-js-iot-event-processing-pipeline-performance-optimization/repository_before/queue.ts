import { Queue, Worker, Job } from 'bullmq';
import { EventEmitter } from 'events';
import { config } from './config';
import { SensorEvent, ProcessedEvent } from './types';
import { insertEvent } from './database';

export const eventEmitter = new EventEmitter();

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

export function startWorker(): Worker {
    const worker = new Worker(
        config.queue.name,
        async (job: Job<SensorEvent>) => {
            const event = job.data;
            
            const processedEvent: ProcessedEvent = {
                ...event,
                timestamp: new Date(event.timestamp).toISOString(),
                processed_at: new Date(),
                received_at: new Date(job.timestamp || Date.now()),
            };
            
            await insertEvent(processedEvent);
            
            eventEmitter.emit('event_processed', processedEvent);
        },
        {
            connection: config.redis,
        }
    );
    
    worker.on('completed', (job) => {
        console.log(`Job ${job.id} completed`);
    });
    
    worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} failed:`, err);
    });

    workerInstance = worker;
    return worker;
}

export function getWorker(): Worker | null {
    return workerInstance;
}

export async function addEventToQueue(event: SensorEvent): Promise<void> {
    await eventQueue.add('process-event', event);
}

export async function addEventsToQueue(events: SensorEvent[]): Promise<void> {
    for (const event of events) {
        await eventQueue.add('process-event', event);
    }
}

export async function getQueueStats(): Promise<{ waiting: number; active: number }> {
    const waiting = await eventQueue.getWaitingCount();
    const active = await eventQueue.getActiveCount();
    return { waiting, active };
}

export async function getQueueDepth(): Promise<number> {
    const waiting = await eventQueue.getWaitingCount();
    const active = await eventQueue.getActiveCount();
    return waiting + active;
}

export function canAcceptJob(): Promise<boolean> {
    return Promise.resolve(true);
}

export function subscribeToProcessedEvents(broadcastFn: (event: ProcessedEvent) => void): void {
    eventEmitter.on('event_processed', broadcastFn);
}

export function removeProcessedEventsListener(broadcastFn: (event: ProcessedEvent) => void): void {
    eventEmitter.removeListener('event_processed', broadcastFn);
}
