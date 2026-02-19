// Jest setup file (tests subfolder) — runs before each test file
require('@testing-library/jest-dom');

process.env.NODE_ENV = 'test';
// Tests use PostgreSQL; when run locally use DATABASE_URL or default below
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/raffle_test';
}
if (!process.env.ADMIN_SECRET) {
  process.env.ADMIN_SECRET = 'test-admin-secret';
}
