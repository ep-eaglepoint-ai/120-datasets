/**
 * Backend API tests for polls: create, get, vote, close.
 * Requirement mapping: Req 2 (nanoid, GET poll), Req 3 (vote, duplicate prevention), Req 5 (close).
 */
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import pollsRouter from '../../repository_after/server/src/routes/polls';

const mockIo = {
  to: (room: string) => ({
    emit: (_event: string, _data: unknown) => {},
  }),
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/polls', (req: express.Request, _res, next) => {
    (req as express.Request & { io?: typeof mockIo }).io = mockIo;
    next();
  }, pollsRouter);
  return app;
}

const app = createApp();

// Use Docker MongoDB service or fallback for local testing
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'poll_creation_test';

beforeAll(async () => {
  await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  const db = mongoose.connection.db;
  const collections = db ? await db.collections() : [];
  for (const c of collections) {
    await c.deleteMany({});
  }
});

describe('POST /api/polls', () => {
  it('creates poll with nanoid pollId and 2-10 options', async () => {
    const res = await request(app)
      .post('/api/polls')
      .send({
        question: 'Best color?',
        options: ['Red', 'Blue'],
        showResultsBeforeVote: false,
      })
      .expect(201);
    expect(res.body.pollId).toBeDefined();
    expect(res.body.pollId).toMatch(/^[A-Za-z0-9_-]{10}$/);
    expect(res.body.question).toBe('Best color?');
    expect(res.body.options).toHaveLength(2);
    expect(res.body.options[0]).toMatchObject({ text: 'Red', votes: 0 });
    expect(res.body.options[1]).toMatchObject({ text: 'Blue', votes: 0 });
    expect(res.body.totalVotes).toBe(0);
    expect(res.body.isClosed).toBe(false);
  });

  it('rejects fewer than 2 options', async () => {
    await request(app)
      .post('/api/polls')
      .send({ question: 'Q?', options: ['A'], showResultsBeforeVote: false })
      .expect(400);
  });

  it('rejects more than 10 options', async () => {
    await request(app)
      .post('/api/polls')
      .send({
        question: 'Q?',
        options: Array(11).fill('x'),
        showResultsBeforeVote: false,
      })
      .expect(400);
  });

  it('accepts optional expiresAt and showResultsBeforeVote', async () => {
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    const res = await request(app)
      .post('/api/polls')
      .send({
        question: 'When?',
        options: ['A', 'B'],
        showResultsBeforeVote: true,
        expiresAt,
      })
      .expect(201);
    expect(res.body.showResultsBeforeVote).toBe(true);
    expect(res.body.expiresAt).toBeDefined();
  });
});

describe('GET /api/polls/:pollId', () => {
  it('returns poll by pollId', async () => {
    const createRes = await request(app)
      .post('/api/polls')
      .send({ question: 'Q?', options: ['A', 'B'], showResultsBeforeVote: false })
      .expect(201);
    const pollId = createRes.body.pollId;
    const getRes = await request(app).get('/api/polls/' + pollId).expect(200);
    expect(getRes.body.pollId).toBe(pollId);
    expect(getRes.body.question).toBe('Q?');
    expect(getRes.body.options).toHaveLength(2);
  });

  it('returns 404 for unknown pollId', async () => {
    await request(app).get('/api/polls/nonexistent123').expect(404);
  });
});

describe('POST /api/polls/:pollId/vote', () => {
  it('records vote and returns updated poll', async () => {
    const createRes = await request(app)
      .post('/api/polls')
      .send({ question: 'Q?', options: ['A', 'B'], showResultsBeforeVote: false })
      .expect(201);
    const pollId = createRes.body.pollId;
    const optionId = createRes.body.options[0].id;
    const voteRes = await request(app)
      .post('/api/polls/' + pollId + '/vote')
      .set('X-Vote-Token', 'token1')
      .send({ optionId })
      .expect(200);
    expect(voteRes.body.options[0].votes).toBe(1);
    expect(voteRes.body.totalVotes).toBe(1);
  });

  it('rejects duplicate vote with same token', async () => {
    const createRes = await request(app)
      .post('/api/polls')
      .send({ question: 'Q?', options: ['A', 'B'], showResultsBeforeVote: false })
      .expect(201);
    const pollId = createRes.body.pollId;
    const optionId = createRes.body.options[0].id;
    await request(app)
      .post('/api/polls/' + pollId + '/vote')
      .set('X-Vote-Token', 'token-dup')
      .send({ optionId })
      .expect(200);
    await request(app)
      .post('/api/polls/' + pollId + '/vote')
      .set('X-Vote-Token', 'token-dup')
      .send({ optionId: createRes.body.options[1].id })
      .expect(409);
  });

  it('rejects vote when poll is closed', async () => {
    const createRes = await request(app)
      .post('/api/polls')
      .send({ question: 'Q?', options: ['A', 'B'], showResultsBeforeVote: false })
      .expect(201);
    const pollId = createRes.body.pollId;
    await request(app).patch('/api/polls/' + pollId + '/close').expect(200);
    await request(app)
      .post('/api/polls/' + pollId + '/vote')
      .set('X-Vote-Token', 'token-closed')
      .send({ optionId: createRes.body.options[0].id })
      .expect(410);
  });
});

describe('PATCH /api/polls/:pollId/close', () => {
  it('closes poll and stops accepting votes', async () => {
    const createRes = await request(app)
      .post('/api/polls')
      .send({ question: 'Q?', options: ['A', 'B'], showResultsBeforeVote: false })
      .expect(201);
    const pollId = createRes.body.pollId;
    const closeRes = await request(app).patch('/api/polls/' + pollId + '/close').expect(200);
    expect(closeRes.body.isClosed).toBe(true);
  });

  it('returns 404 for unknown pollId', async () => {
    await request(app).patch('/api/polls/nonexistent123/close').expect(404);
  });
});

describe('GET /api/polls/:pollId - Expiration', () => {
  it('returns 410 for expired poll', async () => {
    const expiredDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
    const createRes = await request(app)
      .post('/api/polls')
      .send({
        question: 'Expired?',
        options: ['A', 'B'],
        showResultsBeforeVote: false,
        expiresAt: expiredDate,
      })
      .expect(201);
    const pollId = createRes.body.pollId;
    await request(app).get('/api/polls/' + pollId).expect(410);
  });
});

describe('POST /api/polls/:pollId/vote - Expiration', () => {
  it('rejects vote when poll is expired', async () => {
    const expiredDate = new Date(Date.now() - 86400000).toISOString();
    const createRes = await request(app)
      .post('/api/polls')
      .send({
        question: 'Expired?',
        options: ['A', 'B'],
        showResultsBeforeVote: false,
        expiresAt: expiredDate,
      })
      .expect(201);
    const pollId = createRes.body.pollId;
    await request(app)
      .post('/api/polls/' + pollId + '/vote')
      .set('X-Vote-Token', 'token-expired')
      .send({ optionId: createRes.body.options[0].id })
      .expect(410);
  });
});

describe('POST /api/polls - Edge Cases', () => {
  it('rejects empty question', async () => {
    await request(app)
      .post('/api/polls')
      .send({ question: '', options: ['A', 'B'], showResultsBeforeVote: false })
      .expect(400);
  });

  it('rejects whitespace-only question', async () => {
    await request(app)
      .post('/api/polls')
      .send({ question: '   ', options: ['A', 'B'], showResultsBeforeVote: false })
      .expect(400);
  });

  it('trims whitespace from options and rejects if fewer than 2 remain', async () => {
    await request(app)
      .post('/api/polls')
      .send({ question: 'Q?', options: ['A', '   '], showResultsBeforeVote: false })
      .expect(400);
  });

  it('rejects invalid optionId on vote', async () => {
    const createRes = await request(app)
      .post('/api/polls')
      .send({ question: 'Q?', options: ['A', 'B'], showResultsBeforeVote: false })
      .expect(201);
    await request(app)
      .post('/api/polls/' + createRes.body.pollId + '/vote')
      .send({ optionId: 'nonexistent' })
      .expect(400);
  });

  it('allows vote without token but still records it', async () => {
    const createRes = await request(app)
      .post('/api/polls')
      .send({ question: 'Q?', options: ['A', 'B'], showResultsBeforeVote: false })
      .expect(201);
    const voteRes = await request(app)
      .post('/api/polls/' + createRes.body.pollId + '/vote')
      .send({ optionId: createRes.body.options[0].id })
      .expect(200);
    expect(voteRes.body.totalVotes).toBe(1);
  });

  it('rejects missing optionId on vote', async () => {
    const createRes = await request(app)
      .post('/api/polls')
      .send({ question: 'Q?', options: ['A', 'B'], showResultsBeforeVote: false })
      .expect(201);
    await request(app)
      .post('/api/polls/' + createRes.body.pollId + '/vote')
      .send({})
      .expect(400);
  });

  it('rejects vote on non-existent poll', async () => {
    await request(app)
      .post('/api/polls/nonexistent123/vote')
      .send({ optionId: 'opt1' })
      .expect(404);
  });
});
