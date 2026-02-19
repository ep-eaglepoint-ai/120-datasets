import { Pool } from 'pg';
import { getPool } from './db';
import { randomInt } from 'crypto';

const MAX_TICKETS = 100;
const MAX_TICKETS_PER_USER = 2;
const RAFFLE_META_ID = 1;

export type RaffleStatus = 'OPEN' | 'CLOSED';

export interface RaffleState {
  status: RaffleStatus;
  remainingTickets: number;
  userTicketCount?: number;
  winningTicketId?: number; // only when status === 'CLOSED'
}

export interface PurchaseResult {
  success: true;
  tickets: { id: number; userId: string; createdAt: Date }[];
  remaining: number;
}

export interface PurchaseError {
  success: false;
  error: 'Sold Out' | 'Limit Reached' | 'Raffle Closed' | 'Invalid request';
}

/**
 * Atomic purchase: PostgreSQL transaction with SELECT ... FOR UPDATE on raffle_meta
 * serializes purchase checks; total tickets and per-user limits are enforced atomically under concurrency.
 */
export async function purchaseTickets(
  userId: string,
  quantity: number,
  pgPool?: Pool
): Promise<PurchaseResult | PurchaseError> {
  const pool = pgPool || getPool();
  const qty = Math.min(Math.max(1, Math.floor(quantity)), 2); // clamp to 1 or 2

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock raffle_meta row so concurrent purchases serialize
    const metaResult = await client.query(
      'SELECT status FROM raffle_meta WHERE id = $1 FOR UPDATE',
      [RAFFLE_META_ID]
    );
    if (metaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Raffle Closed' };
    }
    const status = metaResult.rows[0].status as string;
    if (status !== 'OPEN') {
      await client.query('ROLLBACK');
      return { success: false, error: 'Raffle Closed' };
    }

    const totalResult = await client.query('SELECT COUNT(*)::int AS count FROM tickets');
    const total = totalResult.rows[0].count;
    if (total >= MAX_TICKETS) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Sold Out' };
    }

    const userResult = await client.query(
      'SELECT COUNT(*)::int AS count FROM tickets WHERE user_id = $1',
      [userId]
    );
    const userCount = userResult.rows[0].count;
    if (userCount >= MAX_TICKETS_PER_USER) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Limit Reached' };
    }
    const toInsert = Math.min(qty, MAX_TICKETS_PER_USER - userCount, MAX_TICKETS - total);
    if (toInsert <= 0) {
      await client.query('ROLLBACK');
      return { success: false, error: userCount >= MAX_TICKETS_PER_USER ? 'Limit Reached' : 'Sold Out' };
    }

    const inserted: { id: number; userId: string; createdAt: Date }[] = [];
    for (let i = 0; i < toInsert; i++) {
      const insertResult = await client.query(
        'INSERT INTO tickets (user_id) VALUES ($1) RETURNING id, user_id, created_at',
        [userId]
      );
      const row = insertResult.rows[0];
      inserted.push({
        id: row.id,
        userId: row.user_id,
        createdAt: row.created_at,
      });
    }

    await client.query('COMMIT');
    const newTotal = total + inserted.length;
    return {
      success: true,
      tickets: inserted,
      remaining: MAX_TICKETS - newTotal,
    };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function getRaffleState(userId?: string | null, pgPool?: Pool): Promise<RaffleState> {
  const pool = pgPool || getPool();
  const metaResult = await pool.query(
    'SELECT status, winning_ticket_id FROM raffle_meta WHERE id = $1',
    [RAFFLE_META_ID]
  );
  if (metaResult.rows.length === 0) {
    return { status: 'OPEN', remainingTickets: 100 };
  }
  const status = metaResult.rows[0].status as RaffleStatus;
  const winningTicketId = metaResult.rows[0].winning_ticket_id as number | null;

  const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM tickets');
  const total = countResult.rows[0].count;
  const remainingTickets = MAX_TICKETS - total;

  const state: RaffleState = { status, remainingTickets };
  if (status === 'CLOSED' && winningTicketId != null) {
    state.winningTicketId = winningTicketId;
  }
  if (userId) {
    const userResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM tickets WHERE user_id = $1',
      [userId]
    );
    state.userTicketCount = userResult.rows[0].count;
  }
  return state;
}

/**
 * Winner selection using Node.js cryptographically secure randomness (crypto.randomInt).
 * Persists winning ticket and sets raffle to CLOSED.
 */
export async function drawWinner(pgPool?: Pool): Promise<{ success: true; winningTicketId: number } | { success: false; error: string }> {
  const pool = pgPool || getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const metaResult = await client.query(
      'SELECT status FROM raffle_meta WHERE id = $1 FOR UPDATE',
      [RAFFLE_META_ID]
    );
    if (metaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Raffle not initialized' };
    }
    if (metaResult.rows[0].status !== 'OPEN') {
      await client.query('ROLLBACK');
      return { success: false, error: 'Raffle already closed' };
    }

    const idsResult = await client.query('SELECT id FROM tickets ORDER BY id');
    const ticketIds = idsResult.rows.map((r) => r.id as number);
    if (ticketIds.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'No tickets sold' };
    }

    const index = randomInt(0, ticketIds.length);
    const winningTicketId = ticketIds[index];

    await client.query(
      'UPDATE raffle_meta SET status = $1, winning_ticket_id = $2, updated_at = now() WHERE id = $3',
      ['CLOSED', winningTicketId, RAFFLE_META_ID]
    );
    await client.query('COMMIT');
    return { success: true, winningTicketId };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Pure function for winner selection from a pool of ticket IDs (for unit testing fairness).
 * Uses crypto.randomInt; never returns ID outside the pool.
 */
export function selectWinningTicketId(ticketIds: number[]): number {
  if (ticketIds.length === 0) throw new Error('Cannot draw from empty pool');
  const index = randomInt(0, ticketIds.length);
  return ticketIds[index];
}
