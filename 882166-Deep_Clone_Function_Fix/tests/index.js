const path = require('path');

const repoPath = process.env.REPO_PATH;
if (!repoPath) {
  throw new Error('REPO_PATH environment variable is not set');
}

const { deepClone } = require(path.join(__dirname, '..', repoPath, 'index.js'));

describe('deepClone', () => {
  test('returns primitives as-is', () => {
    expect(deepClone(1)).toBe(1);
    expect(deepClone(null)).toBe(null);
    expect(deepClone('test')).toBe('test');
  });

  test('clones plain objects without shared reference', () => {
    const obj = { a: 1 };
    const clone = deepClone(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);
  });

  test('clones Date objects correctly', () => {
    const d = new Date();
    const clone = deepClone(d);
    expect(clone).toBeInstanceOf(Date);
    expect(clone.getTime()).toBe(d.getTime());
    expect(clone).not.toBe(d);
  });

  test('clones RegExp objects correctly', () => {
    const r = /test/gi;
    const clone = deepClone(r);
    expect(clone).toBeInstanceOf(RegExp);
    expect(clone.source).toBe(r.source);
    expect(clone.flags).toBe(r.flags);
  });

  test('clones Map objects with contents', () => {
    const m = new Map([['a', { x: 1 }]]);
    const clone = deepClone(m);
    expect(clone).toBeInstanceOf(Map);
    expect(clone.get('a')).toEqual({ x: 1 });
    expect(clone.get('a')).not.toBe(m.get('a'));
  });

  test('clones Set objects with contents', () => {
    const s = new Set([1, 2, 3]);
    const clone = deepClone(s);
    expect(clone).toBeInstanceOf(Set);
    expect([...clone]).toEqual([1, 2, 3]);
  });

  test('handles circular references correctly', () => {
    const obj = {};
    obj.self = obj;

    const clone = deepClone(obj);
    expect(clone).not.toBe(obj);
    expect(clone.self).toBe(clone);
  });

  test('deep modifications do not affect original', () => {
    const obj = { nested: { value: 1 } };
    const clone = deepClone(obj);
    clone.nested.value = 99;
    expect(obj.nested.value).toBe(1);
  });
});
