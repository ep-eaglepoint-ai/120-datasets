import { findUserByIdentifier, createUser, findUserByEmail, findUserByUsername } from '@/lib/db';
import fs from 'node:fs';
import path from 'node:path';

/**
 * REQ-03: Only support email, username and password (Make email and username interchangeable)
 * REQ-04: Handle session creation, persistence and validation
 */
describe('TC-02: Database and Identity Logic', () => {
  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: 'dummy-hash'
  };

  beforeAll(() => {
    // Clean up or ensure isolation if needed
  });

  test('should create and persist a user', () => {
    const user = createUser(testUser);
    expect(user.id).toBeDefined();
    expect(user.username).toBe(testUser.username);
  });

  test('REQ-03: should find user by username (interchangeable identifier)', () => {
    const user = findUserByIdentifier('testuser');
    expect(user).toBeDefined();
    expect(user?.email).toBe(testUser.email);
  });

  test('REQ-03: should find user by email (interchangeable identifier)', () => {
    const user = findUserByIdentifier('test@example.com');
    expect(user).toBeDefined();
    expect(user?.username).toBe(testUser.username);
  });

  test('should find user by case-insensitive identifier', () => {
    const user = findUserByIdentifier('TESTUSER');
    expect(user).toBeDefined();
    expect(user?.username).toBe(testUser.username);
  });
});
