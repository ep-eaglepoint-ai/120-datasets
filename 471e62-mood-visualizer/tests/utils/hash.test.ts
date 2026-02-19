import { hashString } from '../hash';

describe('hashString', () => {
  test('produces consistent hash for same input', () => {
    const hash1 = hashString('test');
    const hash2 = hashString('test');
    expect(hash1).toBe(hash2);
  });

  test('produces different hash for different input', () => {
    const hash1 = hashString('test1');
    const hash2 = hashString('test2');
    expect(hash1).not.toBe(hash2);
  });

  test('produces positive number', () => {
    const hash = hashString('anything');
    expect(hash).toBeGreaterThanOrEqual(0);
  });

  test('handles empty string', () => {
    const hash = hashString('');
    expect(typeof hash).toBe('number');
  });

  test('handles unicode', () => {
    const hash = hashString('你好世界');
    expect(typeof hash).toBe('number');
    expect(hash).toBeGreaterThanOrEqual(0);
  });
});
