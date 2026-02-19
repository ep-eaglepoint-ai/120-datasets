// db.ts / mongo.ts
import { MongoClient, Db } from 'mongodb';

const DEFAULT_MONGODB_URI = 'mongodb://localhost:27017';
const DEFAULT_DB_NAME = 'study_planner';

const CLIENT_OPTIONS = {
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 15000,
  retryWrites: true,
  retryReads: true,
};

// Use a promise-based singleton (most popular pattern today)
let _clientPromise: Promise<MongoClient> | null = null;

function getMongoClientPromise(): Promise<MongoClient> {
  if (_clientPromise) return _clientPromise;

  const uri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
  const client = new MongoClient(uri, CLIENT_OPTIONS);

  _clientPromise = client
    .connect()
    .then((connectedClient) => {
      console.log('MongoDB connected successfully');
      // Optional: add process hooks for graceful shutdown
      process.on('SIGINT', () => closeDatabase());
      process.on('SIGTERM', () => closeDatabase());
      return connectedClient;
    })
    .catch((err) => {
      console.error('MongoDB initial connection failed:', err);
      _clientPromise = null; // allow retry on next call
      throw err;
    });

  return _clientPromise;
}

export async function getMongoClient(): Promise<MongoClient> {
  return getMongoClientPromise();
}

export async function getDatabase(): Promise<Db> {
  const client = await getMongoClientPromise();
  const dbName = process.env.DB_NAME || DEFAULT_DB_NAME;
  const db = client.db(dbName);

  // Run index creation only once (or on first access)
  // You can also move this to an init function called at startup
  await createIndexes(db).catch((err) => {
    console.warn('Index creation failed (non-critical):', err);
  });

  return db;
}

// Rest of your code remains almost the same...

async function createIndexes(database: Db): Promise<void> {
  try {
    // Subjects collection indexes
    await database.collection('subjects').createIndex(
      { name: 1 },
      { unique: true, name: 'unique_subject_name' }
    );
    await database.collection('subjects').createIndex(
      { createdAt: -1 },
      { name: 'subject_created_desc' }
    );

    // Study sessions collection indexes
    await database.collection('study_sessions').createIndex(
      { subjectId: 1, timestamp: -1 },
      { name: 'sessions_by_subject_time' }
    );
    await database.collection('study_sessions').createIndex(
      { timestamp: -1 },
      { name: 'sessions_by_time_desc' }
    );
    await database.collection('study_sessions').createIndex(
      { subjectId: 1 },
      { name: 'sessions_by_subject' }
    );

    // Reminders collection indexes
    await database.collection('reminders').createIndex(
      { triggerTime: 1 },
      { name: 'reminders_by_trigger_time' }
    );
    await database.collection('reminders').createIndex(
      { isActive: 1, triggerTime: 1 },
      { name: 'active_reminders_by_time' }
    );

    console.log('Database indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
}

export async function closeDatabase(): Promise<void> {
  if (_clientPromise) {
    const client = await _clientPromise.catch(() => null);
    if (client) {
      await client.close().catch(console.error);
      console.log('MongoDB connection closed');
    }
    _clientPromise = null;
  }
}

export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    const db = await getDatabase();
    await db.command({ ping: 1 });
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}