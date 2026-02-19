import request from 'supertest';
import app from '../repository_after/server/index';
import { closePool } from '../repository_after/server/db';
import { initTestDb, resetRaffle, getTestPool } from './testDbHelper';
import { Pool } from 'pg';

let pool: Pool;

beforeAll(async () => {
  pool = await initTestDb();
}, 15000);

afterAll(async () => {
  await closePool();
});

beforeEach(async () => {
  await resetRaffle(pool);
});

/**
 * REQ-1: Atomic Inventory Management — transactional purchase under concurrency.
 * REQ-6: System integration test — 50 concurrent users, 3 tickets each (150 requests),
 *        100-ticket cap; verify exactly 100 ticket records and exactly 50 rejected
 *        responses (API uses "Sold Out" / "Limit Reached" per requirement).
 */
describe('Concurrency: 50 users, 3 purchase attempts each (150 requests)', () => {
  it('results in exactly 100 tickets and exactly 50 rejected outcomes', async () => {
    const numUsers = 50;
    const attemptsPerUser = 3;
    const requests: Promise<request.Response>[] = [];
    for (let u = 0; u < numUsers; u++) {
      const userId = `concurrent-user-${u}`;
      for (let a = 0; a < attemptsPerUser; a++) {
        requests.push(
          request(app)
            .post('/api/purchase')
            .send({ userId, quantity: 1 })
        );
      }
    }
    const results = await Promise.all(requests);

    const successful = results.filter((r) => r.status === 200 && r.body.success);
    const rejected = results.filter((r) => r.status === 409 || (r.body.success === false && (r.body.error === 'Sold Out' || r.body.error === 'Limit Reached')));

    const totalTicketsResult = await pool.query('SELECT COUNT(*)::int AS count FROM tickets');
    const totalTickets = totalTicketsResult.rows[0].count;
    expect(totalTickets).toBe(100); // REQ-6: exactly 100 ticket records

    const byUserResult = await pool.query(
      'SELECT user_id, COUNT(*)::int AS count FROM tickets GROUP BY user_id'
    );
    byUserResult.rows.forEach((row: { user_id: string; count: number }) => {
      expect(row.count).toBeLessThanOrEqual(2); // REQ-2: per-user cap enforced
    });

    expect(rejected.length).toBe(50); // REQ-6: exactly 50 rejected (Inventory Exhausted / Limit Reached)
  }, 60000);
});
