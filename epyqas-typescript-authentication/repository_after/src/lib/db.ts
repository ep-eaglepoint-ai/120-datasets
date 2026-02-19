import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'repository_after', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
}

interface DBSchema {
  users: User[];
}

/**
 * Reads the database from the JSON file.
 */
function readDB(): DBSchema {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return { users: [] };
    }
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { users: [] };
  }
}

/**
 * Writes the database to the JSON file.
 */
function writeDB(data: DBSchema) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

/**
 * Finds a user by either username or email.
 */
export function findUserByIdentifier(identifier: string): User | undefined {
  const db = readDB();
  const lowerIdentifier = identifier.toLowerCase();
  return db.users.find(u => 
    u.username.toLowerCase() === lowerIdentifier || 
    u.email.toLowerCase() === lowerIdentifier
  );
}

/**
 * Finds a user by email.
 */
export function findUserByEmail(email: string): User | undefined {
  const db = readDB();
  return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

/**
 * Finds a user by username.
 */
export function findUserByUsername(username: string): User | undefined {
  const db = readDB();
  return db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

/**
 * Creates a new user and persists to the database.
 */
export function createUser(user: Omit<User, 'id'>): User {
  const db = readDB();
  const newUser = { 
    ...user, 
    id: Math.random().toString(36).substring(2, 11) 
  };
  db.users.push(newUser);
  writeDB(db);
  return newUser;
}
