const assert = require('assert');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    testsPassed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    testsFailed++;
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
  }
}

function runTests(SchemaValidator, version) {
  console.log(`\n=== Testing ${version} Version ===\n`);
  
  test(`[${version}] Test 1: Basic type validation - string`, () => {
    const validator = new SchemaValidator();
    const schema = { type: 'string' };
    const result1 = validator.validate('hello', schema);
    const result2 = validator.validate(123, schema);
    assert.strictEqual(result1.valid, true);
    assert.strictEqual(result2.valid, false);
  });

  test(`[${version}] Test 2: Basic type validation - number`, () => {
    const validator = new SchemaValidator();
    const schema = { type: 'number' };
    const result1 = validator.validate(42, schema);
    const result2 = validator.validate('42', schema);
    assert.strictEqual(result1.valid, true);
    assert.strictEqual(result2.valid, false);
  });

  test(`[${version}] Test 3: Object with required properties`, () => {
    const validator = new SchemaValidator();
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' }
      },
      required: ['name']
    };
    const result1 = validator.validate({ name: 'John', age: 25 }, schema);
    const result2 = validator.validate({ age: 25 }, schema);
    assert.strictEqual(result1.valid, true);
    assert.strictEqual(result2.valid, false);
  });

  test(`[${version}] Test 4: Array with items schema`, () => {
    const validator = new SchemaValidator();
    const schema = {
      type: 'array',
      items: { type: 'number' }
    };
    const result1 = validator.validate([1, 2, 3], schema);
    const result2 = validator.validate([1, 'two', 3], schema);
    assert.strictEqual(result1.valid, true);
    assert.strictEqual(result2.valid, false);
  });

  test(`[${version}] Test 5: Number with minimum constraint`, () => {
    const validator = new SchemaValidator();
    const schema = {
      type: 'number',
      minimum: 10
    };
    const result1 = validator.validate(15, schema);
    const result2 = validator.validate(5, schema);
    assert.strictEqual(result1.valid, true);
    assert.strictEqual(result2.valid, false);
  });

  test(`[${version}] Test 6: Number with maximum constraint`, () => {
    const validator = new SchemaValidator();
    const schema = {
      type: 'number',
      maximum: 100
    };
    const result1 = validator.validate(50, schema);
    const result2 = validator.validate(150, schema);
    assert.strictEqual(result1.valid, true);
    assert.strictEqual(result2.valid, false);
  });

  test(`[${version}] Test 7: oneOf validation`, () => {
    const validator = new SchemaValidator();
    const schema = {
      oneOf: [
        { type: 'string', maxLength: 5 },
        { type: 'number' }
      ]
    };
    const result1 = validator.validate(42, schema);
    const result2 = validator.validate('hello', schema);
    assert.strictEqual(result1.valid, true);
    assert.strictEqual(result2.valid, true);
  });

  test(`[${version}] Test 8: anyOf validation`, () => {
    const validator = new SchemaValidator();
    const schema = {
      anyOf: [
        { type: 'string' },
        { type: 'number' }
      ]
    };
    const result1 = validator.validate('test', schema);
    const result2 = validator.validate(42, schema);
    const result3 = validator.validate(true, schema);
    assert.strictEqual(result1.valid, true);
    assert.strictEqual(result2.valid, true);
    assert.strictEqual(result3.valid, false);
  });

  test(`[${version}] Test 9: allOf validation`, () => {
    const validator = new SchemaValidator();
    const schema = {
      allOf: [
        { type: 'number' },
        { minimum: 10 },
        { maximum: 100 }
      ]
    };
    const result1 = validator.validate(50, schema);
    const result2 = validator.validate(5, schema);
    assert.strictEqual(result1.valid, true);
    assert.strictEqual(result2.valid, false);
  });

  test(`[${version}] Test 10: Nested object validation`, () => {
    const validator = new SchemaValidator();
    const schema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' }
          },
          required: ['email']
        }
      }
    };
    const result1 = validator.validate({ user: { name: 'John', email: 'john@test.com' } }, schema);
    const result2 = validator.validate({ user: { name: 'John' } }, schema);
    assert.strictEqual(result1.valid, true);
    assert.strictEqual(result2.valid, false);
  });

  test(`[${version}] Test 11: Array with uniqueItems`, () => {
    const validator = new SchemaValidator();
    const schema = {
      type: 'array',
      uniqueItems: true
    };
    const result1 = validator.validate([1, 2, 3], schema);
    const result2 = validator.validate([1, 2, 2], schema);
    assert.strictEqual(result1.valid, true);
    assert.strictEqual(result2.valid, false);
  });

  test(`[${version}] Test 12: Type object should reject null`, () => {
    const validator = new SchemaValidator();
    const schema = { type: 'object' };
    const result1 = validator.validate({}, schema);
    const result2 = validator.validate(null, schema);
    assert.strictEqual(result1.valid, true);
    assert.strictEqual(result2.valid, false);
  });
}

const mode = process.argv[2] || 'both';

if (mode === 'before' || mode === 'both') {
  const SchemaValidatorBefore = require('../repository_before/SchemaValidator');
  runTests(SchemaValidatorBefore, 'BEFORE');
}

if (mode === 'after' || mode === 'both') {
  const SchemaValidatorAfter = require('../repository_after/SchemaValidator');
  runTests(SchemaValidatorAfter, 'AFTER');
}

console.log('\n=== Test Results ===');
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log(`Total: ${testsPassed + testsFailed}`);

if (testsFailed > 0) {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}

