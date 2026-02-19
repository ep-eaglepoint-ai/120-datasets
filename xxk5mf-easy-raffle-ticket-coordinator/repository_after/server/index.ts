import express from 'express';
import cors from 'cors';
import path from 'path';
import routes from './routes';
import { getPool, initSchema } from './db';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', routes);

// Optional: serve React build (only for non-API GET)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
const fs = require('fs');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;

async function start() {
  const pool = getPool();
  await initSchema(pool);
  app.listen(PORT, () => {
    console.log(`Raffle server listening on port ${PORT}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export default app;
export { initSchema, getPool };
