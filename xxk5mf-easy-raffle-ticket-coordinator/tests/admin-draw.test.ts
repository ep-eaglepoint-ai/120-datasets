import request from 'supertest';
import app from '../repository_after/server/index';
import { closePool } from '../repository_after/server/db';
import { initTestDb, resetRaffle, getTestPool } from './testDbHelper';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'test-admin-secret';

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
 * REQ-3: Cryptographic Admin Draw — protected endpoint, only admin can draw;
 *        selection uses Node crypto (crypto.randomInt) for fair outcome.
 * REQ-5: Data Visibility Isolation — winner exposed only after state is CLOSED.
 */
describe('POST /api/admin/draw-winner', () => {
  it('returns 401 without admin auth', async () => {
    const res = await request(app).post('/api/admin/draw-winner');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('returns 401 with wrong Bearer token', async () => {
    const res = await request(app)
      .post('/api/admin/draw-winner')
      .set('Authorization', 'Bearer wrong-secret');
    expect(res.status).toBe(401);
  });

  it('returns 200 and winning ticket with valid Bearer token (REQ-3: crypto fair draw)', async () => {
    await request(app).post('/api/purchase').send({ userId: 'u1', quantity: 1 });
    await request(app).post('/api/purchase').send({ userId: 'u2', quantity: 1 });
    const res = await request(app)
      .post('/api/admin/draw-winner')
      .set('Authorization', `Bearer ${ADMIN_SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.winningTicketId).toBe('number');
  });

  it('returns 400 when no tickets sold', async () => {
    const res = await request(app)
      .post('/api/admin/draw-winner')
      .set('Authorization', `Bearer ${ADMIN_SECRET}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no tickets|No tickets/i);
  });

  it('after draw, GET /api/raffle/state exposes winningTicketId when CLOSED (REQ-5)', async () => {
    await request(app).post('/api/purchase').send({ userId: 'u1', quantity: 1 });
    const drawRes = await request(app)
      .post('/api/admin/draw-winner')
      .set('Authorization', `Bearer ${ADMIN_SECRET}`);
    expect(drawRes.body.winningTicketId).toBeDefined();
    const stateRes = await request(app).get('/api/raffle/state');
    expect(stateRes.body.status).toBe('CLOSED');
    expect(stateRes.body.winningTicketId).toBe(drawRes.body.winningTicketId);
  });
});
