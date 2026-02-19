import { Pool } from 'pg';
import { getPool, initSchema } from '../repository_after/server/db';

export async function getTestPool(): Promise<Pool> {
  return getPool();
}

export async function initTestDb(): Promise<Pool> {
  const pool = getPool();
  await initSchema(pool);
  return pool;
}

export async function resetRaffle(pool: Pool): Promise<void> {
  await pool.query('TRUNCATE tickets RESTART IDENTITY');
  await pool.query(
    "UPDATE raffle_meta SET status = 'OPEN', winning_ticket_id = NULL, updated_at = now() WHERE id = 1"
  );
}
