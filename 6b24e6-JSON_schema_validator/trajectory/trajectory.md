# Trajectory: Fixing JSON Schema Validator

**Engineer:** Senior Backend Developer  
**Task:** Fix 10 bugs in JSON Schema validator while maintaining exact public API  
**Date:** 2026-01-12  
**Estimated Time:** 4-6 hours

---

## Phase 1: Initial Analysis

### 1.1 Understanding the Codebase

I started by reading the buggy implementation:
- **Lines of Code:** 145 lines
- **Public API Methods:** 3 (`constructor`, `addSchema`, `validate`)
- **Private Methods:** 3 (`_validate`, `_checkType`, `_resolveRef`)
- **External Dependencies:** None (pure Node.js)

### 1.2 Running the Demo

```bash
node demo.js
```

**Key Observation:** The demo shows Bug #6 in action - `null` is accepted as type `object`.

```javascript
Test: Null as object (Bug 6)
Data: null
Valid: true  // WRONG! Should be false
```

### 1.3 Research Phase

I reviewed the JSON Schema specification (Draft 7) to understand correct behavior:
- **Spec URL:** https://json-schema.org/specification-links.html#draft-7
- **Key Sections:** 
  - `$ref` resolution (Section 8.3)
  - `oneOf` semantics (Section 6.7.3)
  - Type validation (Section 6.1.1)
  - Pattern properties (Section 6.5.5)

---

## Phase 2: Bug-by-Bug Analysis

### Bug #1: $ref Resolution Uses Current Schema Instead of Root

**Location:** Lines 16-23

**Problem:**
```javascript
const refSchema = this._resolveRef(schema.$ref, schema);
```

The code passes `schema` (current schema context) to `_resolveRef`, but JSON Schema `$ref` should always resolve from the **root document**.

**Example Failure:**
```javascript
const rootSchema = {
  definitions: {
    Address: { type: 'object' }
  },
  properties: {
    home: { $ref: '#/definitions/Address' }  // This will fail!
  }
};
```

When validating `properties.home`, the current schema is `{ $ref: '...' }` which doesn't have `definitions`.

**Solution Approach:**
- Add `rootSchema` parameter to `_validate` method
- Pass root schema through all recursive calls
- Use `rootSchema` in `_resolveRef` instead of current schema

**Edge Cases to Handle:**
- Nested $refs (ref → ref → actual schema)
- External refs (stored via `addSchema()`)
- Invalid refs (return null, add error)

---

### Bug #2: oneOf Accepts Multiple Matches

**Location:** Lines 25-34

**Problem:**
```javascript
if (validSchemas.length === 0) {
  errors.push({ path, message: 'Does not match any schema in oneOf' });
}
```

Per JSON Schema spec, `oneOf` requires **exactly one** schema match, not "at least one".

**Example Failure:**
```javascript
const schema = {
  oneOf: [
    { type: 'string' },
    { type: 'string', minLength: 5 }
  ]
};
validator.validate('hello', schema);  // Matches BOTH! Should fail.
```

**Solution Approach:**
```javascript
if (validSchemas.length !== 1) {
  errors.push({ 
    path, 
    message: `Must match exactly one schema in oneOf (matched ${validSchemas.length})` 
  });
}
```

**Research Finding:**
- `anyOf` = at least one match (already correct)
- `oneOf` = exactly one match (broken)
- `allOf` = all must match (already correct)

---

### Bug #3: additionalProperties Ignores patternProperties

**Location:** Lines 36-43

**Problem:**
```javascript
if (schema.additionalProperties === false && schema.properties) {
  const allowedKeys = Object.keys(schema.properties);
  for (const key of Object.keys(data || {})) {
    if (!allowedKeys.includes(key)) {
      errors.push(...);  // This is wrong!
    }
  }
}
```

The code only checks `schema.properties` but ignores `schema.patternProperties`.

**Example Failure:**
```javascript
const schema = {
  properties: { name: { type: 'string' } },
  patternProperties: {
    '^meta_': { type: 'string' }  // Allow any key starting with "meta_"
  },
  additionalProperties: false
};
validator.validate({ name: 'John', meta_foo: 'bar' }, schema);
// WRONG: Rejects meta_foo as additional property!
```

**Solution Approach:**
1. Check if key is in `properties` → allowed
2. Check if key matches any pattern in `patternProperties` → allowed
3. Otherwise, check `additionalProperties` rule

**Implementation:**
```javascript
const isKnownKey = (key) => {
  if (schema.properties?.hasOwnProperty(key)) return true;
  if (schema.patternProperties) {
    return Object.keys(schema.patternProperties).some(pattern => 
      new RegExp(pattern).test(key)
    );
  }
  return false;
};
```

---

### Bug #4: uniqueItems Uses === for Objects/Arrays

**Location:** Lines 45-54

**Problem:**
```javascript
const seen = new Set();
for (const item of data) {
  if (seen.has(item)) {  // Uses === comparison
    errors.push(...);
  }
  seen.add(item);
}
```

JavaScript `===` doesn't work for deep object comparison:
```javascript
{a:1} === {a:1}  // false in JavaScript!
```

**Example Failure:**
```javascript
validator.validate([{a:1}, {a:1}], { type: 'array', uniqueItems: true });
// WRONG: Passes because Set sees them as different objects!
```

**Solution Approach:**
Use JSON.stringify for comparison or implement deep equality.

```javascript
const seenKeys = new Set();
for (const item of data) {
  const itemKey = JSON.stringify(item);
  if (seenKeys.has(itemKey)) {
    errors.push({ path, message: 'Array items must be unique' });
    break;
  }
  seenKeys.add(itemKey);
}
```

**Edge Case:** Circular objects will throw on `JSON.stringify`. Need try-catch.

---

### Bug #5: Circular $ref Causes Infinite Recursion

**Location:** Lines 16-23 (no visited tracking)

**Problem:**
```javascript
if (schema.$ref) {
  const refSchema = this._resolveRef(schema.$ref, schema);
  return this._validate(data, refSchema, path, errors);  // No cycle detection!
}
```

**Example Failure:**
```javascript
const schema = {
  definitions: {
    Person: {
      type: 'object',
      properties: {
        friend: { $ref: '#/definitions/Person' }  // Circular!
      }
    }
  },
  $ref: '#/definitions/Person'
};
// Stack overflow!
```

**Solution Approach:**
Track visited $refs using a Set:

```javascript
_validate(data, schema, path, errors, rootSchema = schema, visitedRefs = new Set()) {
  if (schema.$ref) {
    if (visitedRefs.has(schema.$ref)) {
      errors.push({ path, message: `Circular $ref detected: ${schema.$ref}` });
      return;
    }
    const newVisited = new Set(visitedRefs);
    newVisited.add(schema.$ref);
    return this._validate(data, refSchema, path, errors, rootSchema, newVisited);
  }
}
```

**Important:** Create **new Set** for each branch to avoid false positives across siblings.

---

### Bug #6: type: "object" Accepts null

**Location:** Line 127

**Problem:**
```javascript
case 'object': return typeof data === 'object';
```

In JavaScript, `typeof null === 'object'` due to a historical bug in the language.

**Example Failure:**
```javascript
validator.validate(null, { type: 'object' });  // WRONG: Passes!
```

**Solution:**
```javascript
case 'object': return typeof data === 'object' && !Array.isArray(data) && data !== null;
```

**Note:** Also need to exclude arrays since `typeof [] === 'object'`.

---

### Bug #7: exclusiveMinimum/exclusiveMaximum Not Implemented

**Location:** Lines 68-74 (missing logic)

**Current Code:**
```javascript
if (schema.minimum !== undefined && data < schema.minimum) {
  errors.push(...);
}
```

**Missing:** `exclusiveMinimum` and `exclusiveMaximum` keywords.

**JSON Schema Semantics:**
- `minimum: 5` → `data >= 5` (inclusive)
- `exclusiveMinimum: 5` → `data > 5` (exclusive)

**Solution:**
```javascript
if (schema.minimum !== undefined) {
  if (schema.exclusiveMinimum) {
    if (data <= schema.minimum) {
      errors.push({ path, message: `Number must be greater than ${schema.minimum}` });
    }
  } else {
    if (data < schema.minimum) {
      errors.push({ path, message: `Number below minimum ${schema.minimum}` });
    }
  }
}
```

---

### Bug #8: patternProperties Not Implemented

**Location:** Missing entirely

**JSON Schema Spec:**
`patternProperties` validates object properties whose keys match regex patterns.

**Example:**
```javascript
{
  patternProperties: {
    '^S_': { type: 'string' },
    '^I_': { type: 'integer' }
  }
}
// S_foo must be string, I_count must be integer
```

**Solution Approach:**
```javascript
if (schema.patternProperties) {
  for (const [pattern, propSchema] of Object.entries(schema.patternProperties)) {
    const regex = new RegExp(pattern);
    for (const [key, value] of Object.entries(data)) {
      if (regex.test(key)) {
        this._validate(value, propSchema, `${path}.${key}`, errors, rootSchema, visitedRefs);
      }
    }
  }
}
```

**Edge Case:** Same key might match multiple patterns - validate against all.

---

### Bug #9: if/then/else Not Implemented

**Location:** Missing entirely

**JSON Schema Spec:**
Conditional validation: if data matches `if` schema, apply `then`; otherwise apply `else`.

**Example:**
```javascript
{
  if: { properties: { country: { const: 'USA' } } },
  then: { properties: { zipCode: { pattern: '^[0-9]{5}$' } } },
  else: { properties: { zipCode: { type: 'string' } } }
}
```

**Solution Approach:**
```javascript
if (schema.if) {
  const ifErrors = [];
  this._validate(data, schema.if, path, ifErrors, rootSchema, new Set(visitedRefs));
  const ifValid = ifErrors.length === 0;
  
  if (ifValid && schema.then) {
    this._validate(data, schema.then, path, errors, rootSchema, new Set(visitedRefs));
  } else if (!ifValid && schema.else) {
    this._validate(data, schema.else, path, errors, rootSchema, new Set(visitedRefs));
  }
}
```

**Important:** Don't add `if` errors to main errors array - it's just a condition check.

---

### Bug #10: Unknown Type Returns true

**Location:** Line 130

**Problem:**
```javascript
default: return true;  // WRONG!
```

**Example Failure:**
```javascript
validator.validate('hello', { type: 'xyz' });  // WRONG: Passes!
```

**Solution:**
```javascript
default: return false;  // Reject unknown types
```

---

## Phase 3: Implementation Strategy

### 3.1 Prioritization

1. **Critical (Breaks Security):** Bug #3, #6, #10
2. **High (Common Use):** Bug #1, #2, #4
3. **Medium (Advanced Features):** Bug #7, #8, #9
4. **High (Stability):** Bug #5

### 3.2 Testing Strategy

For each bug, I'll write:
1. **Positive Test:** Correct data passes
2. **Negative Test:** Incorrect data fails
3. **Edge Case Test:** Boundary conditions

### 3.3 Performance Considerations

- **Bug #4:** `JSON.stringify` is O(n) per item → O(n²) total. Acceptable for validation use case.
- **Bug #8:** Multiple regex tests → Could be slow. Document performance characteristics.

---

## Phase 4: Key Insights Discovered

### 4.1 The Importance of Root Schema

Many bugs stem from losing track of the root schema during recursion. The fix requires threading `rootSchema` through all recursive calls.

### 4.2 Creating New Sets vs Mutating

For Bug #5 (circular refs), creating a **new Set** for each branch is critical:
```javascript
new Set(visitedRefs)  // ✓ Correct - each branch independent
visitedRefs.add(ref)  // ✗ Wrong - siblings see each other's refs
```

### 4.3 JavaScript Type System Quirks

- `typeof null === 'object'` (Bug #6)
- `typeof [] === 'object'` (Bug #6)
- `{} === {}` is false (Bug #4)

These quirks make JSON Schema validation in JS non-trivial.

---

## Phase 5: Validation Approach

Before writing the fix, I'll:
1. ✅ Write comprehensive test suite (30+ test cases)
2. ✅ Run tests against buggy version (expect failures)
3. ✅ Implement fixes in `repository_after/`
4. ✅ Run tests against fixed version (expect all pass)
5. ✅ Generate diff patch

---

## Summary

**Total Bugs:** 10  
**Categories:**
- Missing features: 3 (patternProperties, if/then/else, exclusiveMin/Max)
- Logic errors: 5 ($ref, oneOf, additionalProperties, uniqueItems, type:object)
- Stability: 1 (circular refs)
- Safety: 1 (unknown types)

**Estimated Fix Time:** 2-3 hours  
**Testing Time:** 1-2 hours  
**Documentation Time:** 1 hour

**Next Step:** Create comprehensive test suite in `tests/` directory.

