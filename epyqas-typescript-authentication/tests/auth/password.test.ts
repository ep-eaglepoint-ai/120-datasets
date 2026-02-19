import { hashPassword, verifyPassword } from '@/lib/auth/password';

/**
 * REQ-06: Implement password Hashing and verification MANUALLY
 */
describe('TC-01: Password Hashing and Verification', () => {
  const password = 'SecurePassword123!';

  test('should hash password manually using pbkdf2 and salt', () => {
    const hashedPassword = hashPassword(password);
    
    // Check format (salt:hash)
    expect(hashedPassword).toContain(':');
    const [salt, hash] = hashedPassword.split(':');
    
    expect(salt).toHaveLength(32); // 16 bytes hex
    expect(hash).toHaveLength(128); // 64 bytes (sha512) hex
  });

  test('should verify correct password', () => {
    const hashedPassword = hashPassword(password);
    const isValid = verifyPassword(password, hashedPassword);
    expect(isValid).toBe(true);
  });

  test('should fail with incorrect password', () => {
    const hashedPassword = hashPassword(password);
    const isValid = verifyPassword('WrongPassword', hashedPassword);
    expect(isValid).toBe(false);
  });

  test('should produce different salts/hashes for same password (determinism of salt generation)', () => {
    const hash1 = hashPassword(password);
    const hash2 = hashPassword(password);
    expect(hash1).not.toBe(hash2);
  });
});
