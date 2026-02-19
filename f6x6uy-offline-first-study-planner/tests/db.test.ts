/**
 * Database Module Tests
 *
 * Offline/DB recovery: getDatabase, closeDatabase, isDatabaseHealthy,
 * and recovery from disconnect (close then getDatabase reconnects).
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  getDatabase,
  closeDatabase,
  isDatabaseHealthy,
} from '../repository_after/src/lib/db';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: { version: '7.0.3' },
    instance: { launchTimeout: 60000 },
  });
  process.env.MONGODB_URI = mongoServer.getUri();
  process.env.DB_NAME = 'study_planner_test';
}, 120000);

afterAll(async () => {
  await closeDatabase();
  if (mongoServer) await mongoServer.stop();
});

describe('Database: getDatabase', () => {
  it('should return database and create indexes without throwing', async () => {
    const db = await getDatabase();
    expect(db).toBeDefined();
    expect(db.databaseName).toBe('study_planner_test');
    const collections = await db.listCollections().toArray();
    expect(Array.isArray(collections)).toBe(true);
  });
});

describe('Database: isDatabaseHealthy', () => {
  it('should return true when connected', async () => {
    const healthy = await isDatabaseHealthy();
    expect(healthy).toBe(true);
  });
});

describe('Database: closeDatabase and recovery', () => {
  it('should clear connection and allow reconnect on next getDatabase', async () => {
    const db1 = await getDatabase();
    expect(db1).toBeDefined();
    await closeDatabase();
    const db2 = await getDatabase();
    expect(db2).toBeDefined();
    expect(db2.databaseName).toBe('study_planner_test');
  });
});
