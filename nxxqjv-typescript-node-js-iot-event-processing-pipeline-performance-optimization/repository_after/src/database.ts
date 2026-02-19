import { Pool, PoolClient } from 'pg';
import { config } from './config';
import { ProcessedEvent } from './types';
import { getCircuitBreaker } from './circuitBreaker';

const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
    max: config.database.max,
});

const BATCH_SIZE = 1000;

export async function query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }> {
    const result = await getCircuitBreaker().execute(() => pool.query(text, params || []));
    return { rows: result.rows };
}

export async function withClient<T>(cb: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
        return await cb(client);
    } finally {
        client.release();
    }
}

function rowToParams(event: ProcessedEvent): unknown[] {
    return [
        event.event_id,
        event.device_id,
        event.sensor_type,
        event.value,
        event.unit,
        event.timestamp,
        JSON.stringify(event.metadata || {}),
        event.processed_at,
        event.received_at,
    ];
}

export async function insertEvent(event: ProcessedEvent): Promise<void> {
    await insertEventsBatch([event]);
}

export async function insertEventsBatch(events: ProcessedEvent[]): Promise<void> {
    if (events.length === 0) return;

    for (let i = 0; i < events.length; i += BATCH_SIZE) {
        const chunk = events.slice(i, i + BATCH_SIZE);
        const placeholders: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;
        for (const event of chunk) {
            placeholders.push(
                `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8})`
            );
            values.push(...rowToParams(event));
            paramIndex += 9;
        }
        const sql =
            `INSERT INTO events (event_id, device_id, sensor_type, value, unit, timestamp, metadata, processed_at, received_at) VALUES ${placeholders.join(', ')} ON CONFLICT (event_id) DO NOTHING`;
        await getCircuitBreaker().execute(() => pool.query(sql, values));
    }
}

export async function getEventStats(): Promise<{ total: number }> {
    const result = await getCircuitBreaker().execute(() => pool.query('SELECT COUNT(*) as total FROM events'));
    return { total: parseInt(String(result.rows[0]?.total ?? 0), 10) };
}

export async function isDatabaseHealthy(): Promise<boolean> {
    try {
        await getCircuitBreaker().execute(() => pool.query('SELECT 1'));
        return true;
    } catch {
        return false;
    }
}

export async function closePool(): Promise<void> {
    await pool.end();
}
