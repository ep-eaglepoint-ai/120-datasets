import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/raffle_test';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function initSchema(pgPool: Pool): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pgPool.query(sql);
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
