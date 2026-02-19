// Jest setup file - runs before each test file
process.env.NODE_ENV = 'test';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
process.env.DB_NAME = process.env.DB_NAME || 'events';

// Mock bullmq globally so repository_before/queue never creates a real Redis connection when
// loaded by websocket or app before queue.test.ts runs (avoids Jest "did not exit" open handle).
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: '1' }),
    addBulk: jest.fn().mockResolvedValue([]),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn(), close: jest.fn().mockResolvedValue(undefined) })),
}));
