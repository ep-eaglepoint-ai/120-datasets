import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { attachSocket } from './socket';
import pollsRouter from './routes/polls';

const app = express();
const httpServer = createServer(app);

app.use(cors());
app.use(express.json());

const io = attachSocket(httpServer);
app.set('io', io);

app.use('/api/polls', (req, _res, next) => {
  (req as express.Request & { io?: typeof io }).io = io;
  next();
}, pollsRouter);

async function start() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.DB_NAME || 'poll_creation';
  await mongoose.connect(mongoUri, { dbName });
  const port = Number(process.env.PORT) || 3001;
  httpServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

export { app, httpServer, io };
