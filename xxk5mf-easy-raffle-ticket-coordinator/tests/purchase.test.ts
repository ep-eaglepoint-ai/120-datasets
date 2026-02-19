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
 * REQ-1: Atomic Inventory Management — purchase never exceeds 100 tickets.
 * REQ-2: Per-User Fairness Policy — server enforces max 2 tickets per UserID.
 */
describe('POST /api/purchase', () => {
  it('returns 400 when userId is missing', async () => {
    const res = await request(app)
      .post('/api/purchase')
      .send({ quantity: 1 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Invalid request');
  });

  it('purchases one ticket and returns success', async () => {
    const res = await request(app)
      .post('/api/purchase')
      .send({ userId: 'user-1', quantity: 1 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.tickets).toHaveLength(1);
    expect(res.body.tickets[0].userId).toBe('user-1');
    expect(res.body.remaining).toBe(99);
  });

  it('enforces per-user limit of 2 tickets (REQ-2)', async () => {
    await request(app).post('/api/purchase').send({ userId: 'user-1', quantity: 1 });
    await request(app).post('/api/purchase').send({ userId: 'user-1', quantity: 1 });
    const third = await request(app).post('/api/purchase').send({ userId: 'user-1', quantity: 1 });
    expect(third.status).toBe(409);
    expect(third.body.success).toBe(false);
    expect(third.body.error).toBe('Limit Reached');
  });

  it('rejects when total tickets would exceed 100 (REQ-1)', async () => {
    for (let i = 0; i < 100; i++) {
      const uid = `user-${i}`;
      await request(app).post('/api/purchase').send({ userId: uid, quantity: 1 });
    }
    const over = await request(app).post('/api/purchase').send({ userId: 'user-100', quantity: 1 });
    expect(over.status).toBe(409);
    expect(over.body.success).toBe(false);
    expect(over.body.error).toBe('Sold Out');
  });

  it('rejects purchase when raffle is closed (REQ-5: no purchases after draw)', async () => {
    await request(app).post('/api/purchase').send({ userId: 'u1', quantity: 1 });
    const adminSecret = process.env.ADMIN_SECRET || 'test-admin-secret';
    await request(app)
      .post('/api/admin/draw-winner')
      .set('Authorization', `Bearer ${adminSecret}`);
    const res = await request(app).post('/api/purchase').send({ userId: 'u2', quantity: 1 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Raffle Closed');
  });
});
