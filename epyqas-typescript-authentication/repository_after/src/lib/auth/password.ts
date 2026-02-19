import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const ITERATIONS = 100000;
const KEY_LEN = 64;
const DIGEST = 'sha512';

/**
 * Hashes a password using PBKDF2 with a random salt.
 * Returns a string in the format salt:hash
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a stored format (salt:hash).
 * Uses timingSafeEqual to prevent timing attacks.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;

    const hashToVerify = pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
    
    const hashBuffer = Buffer.from(hash, 'hex');
    const verifyBuffer = Buffer.from(hashToVerify, 'hex');

    if (hashBuffer.length !== verifyBuffer.length) {
      return false;
    }

    return timingSafeEqual(hashBuffer, verifyBuffer);
  } catch (error) {
    console.error('Password verification failed:', error);
    return false;
  }
}
