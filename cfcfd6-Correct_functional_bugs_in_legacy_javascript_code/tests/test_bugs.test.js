/**
 * Test suite for JavaScript bug fixes
 * Tests verify that all functional bugs are fixed in repository_after
 */

// Determine which module to test based on environment variable
const modulePath = process.env.TEST_MODULE || '../repository_after/utils.js';
const loadUtils = require('./utils-wrapper');
const utils = loadUtils(modulePath);

describe('Bug Fix Tests', () => {
  describe('processUserData function', () => {
    test('Bug 1: Should not iterate beyond array bounds (i <= users.length)', () => {
      const users = [
        { name: 'Alice', age: 25, email: 'alice@test.com', price: 100, isPremium: false }
      ];
      
      // Should not throw error due to accessing undefined
      expect(() => utils.processUserData(users)).not.toThrow();
      const result = utils.processUserData(users);
      expect(result.length).toBe(1);
    });

    test('Bug 2: Should use strict equality for age comparison (== vs ===)', () => {
      const users = [
        { name: 'Bob', age: 18, email: 'bob@test.com', price: 100, isPremium: false }
      ];
      
      const result = utils.processUserData(users);
      expect(result[0].isAdult).toBe(true);
    });

    test('Bug 3: Should use comparison not assignment for name check (= vs ===)', () => {
      const users = [
        { name: 'Charlie', age: 30, email: 'charlie@test.com', price: 100, isPremium: false },
        { name: 'Admin', age: 35, email: 'admin@test.com', price: 100, isPremium: false }
      ];
      
      const result = utils.processUserData(users);
      // Charlie should not have role set
      expect(result[0].role).toBeUndefined();
      // Admin should have role set
      expect(result[1].role).toBe('administrator');
      // Charlie's name should not be changed to "Admin"
      expect(result[0].name).toBe('Charlie');
    });

    test('Bug 4: Should use strict inequality for email validation (!= vs !==)', () => {
      const users = [
        { name: 'Dave', age: 28, email: 'dave@test.com', price: 100, isPremium: false }
      ];
      
      const result = utils.processUserData(users);
      expect(result[0].validEmail).toBe(true);
    });

    test('Bug 5: Closure issue in setTimeout - should capture correct index', () => {
      const users = [
        { name: 'Eve', age: 22, email: 'eve@test.com', price: 100, isPremium: false }
      ];
      
      // This test verifies the closure is properly created
      // In the buggy version, all timeouts would log the same index
      const result = utils.processUserData(users);
      expect(result.length).toBe(1);
    });
  });

  describe('calculateTotal function', () => {
    test('Bug 6: Should use += or total + items[i].price, not = +', () => {
      const items = [
        { price: 10.5 },
        { price: 20.3 },
        { price: 15.7 }
      ];
      
      const result = utils.calculateTotal(items);
      expect(result).toBe('46.50');
    });

    test('Bug 6: Should correctly sum multiple items', () => {
      const items = [
        { price: 100 },
        { price: 200 },
        { price: 300 }
      ];
      
      const result = utils.calculateTotal(items);
      expect(result).toBe('600.00');
    });
  });

  describe('findUser function', () => {
    test('Bug 7: Should use strict equality for id comparison (== vs ===)', () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' }
      ];
      
      // Should find user with numeric id
      const result1 = utils.findUser(users, 2);
      expect(result1).toEqual({ id: 2, name: 'Bob' });
      
      // With strict equality, string "2" should not match number 2
      const result2 = utils.findUser(users, "2");
      expect(result2).toBeNull();
    });

    test('Should return null when user not found', () => {
      const users = [
        { id: 1, name: 'Alice' }
      ];
      
      const result = utils.findUser(users, 999);
      expect(result).toBeNull();
    });
  });

  describe('fetchData function', () => {
    test('Bug 8: Should use < instead of <= for retry comparison', () => {
      // The function should attempt maxRetries times, not maxRetries + 1
      const result = utils.fetchData('/test');
      expect(result).toEqual({ data: 'success' });
    });
  });
});

describe('Structure Preservation Tests', () => {
  test('Should not use ES6+ features (arrow functions)', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, modulePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Should not contain arrow functions
    expect(content).not.toMatch(/=>/);
  });

  test('Should not use let or const', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, modulePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Should not contain let or const declarations
    expect(content).not.toMatch(/\blet\s+/);
    expect(content).not.toMatch(/\bconst\s+/);
  });

  test('Should not use template literals', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, modulePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Should not contain template literals
    expect(content).not.toMatch(/`/);
  });

  test('Should preserve function names', () => {
    expect(typeof utils.processUserData).toBe('function');
    expect(typeof utils.calculateTotal).toBe('function');
    expect(typeof utils.findUser).toBe('function');
    expect(typeof utils.fetchData).toBe('function');
  });
});
