import { Client } from 'pg';
import { config } from './config';
import { ProcessedEvent } from './types';

export async function insertEvent(event: ProcessedEvent): Promise<void> {
    const client = new Client(config.database);
    await client.connect();
    
    try {
        await client.query(
            `INSERT INTO events (event_id, device_id, sensor_type, value, unit, timestamp, metadata, processed_at, received_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                event.event_id,
                event.device_id,
                event.sensor_type,
                event.value,
                event.unit,
                event.timestamp,
                JSON.stringify(event.metadata || {}),
                event.processed_at,
                event.received_at,
            ]
        );
    } finally {
        await client.end();
    }
}

export async function getEventStats(): Promise<{ total: number }> {
    const client = new Client(config.database);
    await client.connect();
    
    try {
        const result = await client.query('SELECT COUNT(*) as total FROM events');
        return { total: parseInt(result.rows[0].total) };
    } finally {
        await client.end();
    }
}

export async function insertEventsBatch(events: ProcessedEvent[]): Promise<void> {
    for (const event of events) {
        await insertEvent(event);
    }
}

export async function closePool(): Promise<void> {
    return Promise.resolve();
}

export async function isDatabaseHealthy(): Promise<boolean> {
    const client = new Client(config.database);
    try {
        await client.connect();
        await client.query('SELECT 1');
        return true;
    } catch {
        return false;
    } finally {
        await client.end();
    }
}
