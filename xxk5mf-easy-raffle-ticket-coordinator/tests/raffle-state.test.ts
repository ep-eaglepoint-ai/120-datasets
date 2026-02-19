import request from 'supertest';
import app from '../repository_after/server/index';
import { closePool } from '../repository_after/server/db';
import { initTestDb, resetRaffle, getTestPool } from './testDbHelper';

let pool: Awaited<ReturnType<typeof getTestPool>>;

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
 * REQ-5: Data Visibility Isolation — winning ticket identity only exposed when
 *        raffle status is CLOSED; not exposed when OPEN.
 */
describe('GET /api/raffle/state', () => {
  it('returns status OPEN and remaining 100 when no tickets', async () => {
    const res = await request(app).get('/api/raffle/state');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OPEN');
    expect(res.body.remainingTickets).toBe(100);
    expect(res.body.winningTicketId).toBeUndefined();
  });

  it('includes userTicketCount when userId query param is present', async () => {
    await request(app).post('/api/purchase').send({ userId: 'alice', quantity: 1 });
    const res = await request(app).get('/api/raffle/state?userId=alice');
    expect(res.status).toBe(200);
    expect(res.body.userTicketCount).toBe(1);
    expect(res.body.remainingTickets).toBe(99);
  });

  it('does not expose winningTicketId when status is OPEN (REQ-5: visibility isolation)', async () => {
    const res = await request(app).get('/api/raffle/state');
    expect(res.body.winningTicketId).toBeUndefined();
  });
});
