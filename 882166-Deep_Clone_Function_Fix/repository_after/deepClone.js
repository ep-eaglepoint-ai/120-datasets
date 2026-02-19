function deepClone(obj, visited = new WeakMap()) {
  // Handle primitives
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Check for circular references
  if (visited.has(obj)) {
    return visited.get(obj);
  }

  // Handle Date
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  // Handle RegExp
  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags);
  }

  // Handle Map
  if (obj instanceof Map) {
    const clone = new Map();
    visited.set(obj, clone);
    for (const [key, value] of obj) {
      clone.set(deepClone(key, visited), deepClone(value, visited));
    }
    return clone;
  }

  // Handle Set
  if (obj instanceof Set) {
    const clone = new Set();
    visited.set(obj, clone);
    for (const value of obj) {
      clone.add(deepClone(value, visited));
    }
    return clone;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    const clone = [];
    visited.set(obj, clone);
    for (let i = 0; i < obj.length; i++) {
      clone[i] = deepClone(obj[i], visited);
    }
    return clone;
  }

  // Handle plain objects
  const clone = {};
  visited.set(obj, clone);
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clone[key] = deepClone(obj[key], visited);
    }
  }

  return clone;
}

module.exports = { deepClone };
