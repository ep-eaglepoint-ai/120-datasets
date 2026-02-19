/**
 * Socket.IO tests: join-poll and poll-updated emission on vote.
 * Requirement 4: Real-time results via Socket.IO when new votes come in.
 */
import mongoose from 'mongoose';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import pollsRouter from '../../repository_after/server/src/routes/polls';
import { attachSocket } from '../../repository_after/server/src/socket';

let httpServer: ReturnType<typeof createServer>;
let io: SocketServer;
let app: express.Express;

// Use Docker MongoDB service or fallback for local testing
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'poll_socket_test';

beforeAll(async () => {
  await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });

  app = express();
  app.use(express.json());
  httpServer = createServer(app);
  io = attachSocket(httpServer);
  app.use('/api/polls', (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { io?: SocketServer }).io = io;
    next();
  }, pollsRouter);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });
}, 30000);

afterAll(async () => {
  io.close();
  httpServer.close();
  await mongoose.disconnect();
});

beforeEach(async () => {
  const db = mongoose.connection.db;
  if (!db) return;
  const collections = await db.collections();
  for (const c of collections) {
    await c.deleteMany({});
  }
});

// Req 4: Real-time poll-updated emission when vote is recorded
it('emits poll-updated to room when vote is submitted', async () => {
  const createRes = await request(app)
    .post('/api/polls')
    .send({ question: 'Q?', options: ['A', 'B'], showResultsBeforeVote: false })
    .expect(201);
  const pollId = createRes.body.pollId;
  const optionId = createRes.body.options[0].id;

  const port = (httpServer.address() as { port: number }).port;
  const client = ioClient('http://localhost:' + port, { path: '/socket.io' });

  await new Promise<void>((resolve) => client.once('connect', resolve));

  const updatedPayload = await new Promise<Record<string, unknown>>((resolve) => {
    client.once('poll-updated', (data: Record<string, unknown>) => resolve(data));
    client.emit('join-poll', pollId);
    setTimeout(() => {
      request(app)
        .post('/api/polls/' + pollId + '/vote')
        .set('X-Vote-Token', 'token-socket-' + Date.now())
        .send({ optionId })
        .expect(200)
        .end(() => {});
    }, 20);
  });

  expect(updatedPayload.pollId).toBe(pollId);
  expect(updatedPayload.totalVotes).toBe(1);
  expect((updatedPayload.options as Array<{ votes: number }>)[0].votes).toBe(1);
  client.close();
});
