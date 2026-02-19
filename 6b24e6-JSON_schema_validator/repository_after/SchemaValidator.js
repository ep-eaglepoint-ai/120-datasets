class SchemaValidator {
  constructor() {
    this.schemas = {};
  }

  addSchema(id, schema) {
    this.schemas[id] = schema;
    return this;
  }

  validate(data, schema) {
    const errors = [];
    this._validate(data, schema, '', errors, schema, new Set());
    return { valid: errors.length === 0, errors };
  }

  _validate(data, schema, path, errors, rootSchema = schema, visitedRefs = new Set()) {
    if (schema.$ref) {
      const ref = schema.$ref;
      if (visitedRefs.has(ref)) {
        errors.push({ path, message: `Circular $ref detected: ${ref}` });
        return;
      }
      const refSchema = this._resolveRef(ref, rootSchema);
      if (!refSchema) {
        errors.push({ path, message: `Unresolved $ref: ${ref}` });
        return;
      }
      const newVisited = new Set(visitedRefs);
      newVisited.add(ref);
      return this._validate(data, refSchema, path, errors, rootSchema, newVisited);
    }

    if (schema.if) {
      const ifErrors = [];
      this._validate(data, schema.if, path, ifErrors, rootSchema, new Set());
      const ifValid = ifErrors.length === 0;
      
      if (ifValid && schema.then) {
        this._validate(data, schema.then, path, errors, rootSchema, new Set());
      } else if (!ifValid && schema.else) {
        this._validate(data, schema.else, path, errors, rootSchema, new Set());
      }
    }

    if (schema.oneOf) {
      let validCount = 0;
      for (const subSchema of schema.oneOf) {
        const subErrors = [];
        this._validate(data, subSchema, path, subErrors, rootSchema, new Set());
        if (subErrors.length === 0) {
          validCount++;
        }
      }
      if (validCount !== 1) {
        errors.push({ path, message: `Must match exactly one schema in oneOf (matched ${validCount})` });
      }
    }

    if (schema.const !== undefined) {
      if (!this._deepEqual(data, schema.const)) {
        errors.push({ path, message: `Value must be ${JSON.stringify(schema.const)}` });
        return;
      }
    }

    if (schema.enum) {
      if (!schema.enum.some(enumVal => this._deepEqual(data, enumVal))) {
        errors.push({ path, message: `Value must be one of: ${schema.enum.map(v => JSON.stringify(v)).join(', ')}` });
      }
    }

    if (schema.type) {
      if (!this._checkType(data, schema.type)) {
        const typeMsg = Array.isArray(schema.type) ? schema.type.join(' or ') : schema.type;
        errors.push({ path, message: `Expected type ${typeMsg}` });
        return;
      }
    }

    if (typeof data === 'string') {
      if (schema.minLength !== undefined && data.length < schema.minLength) {
        errors.push({ path, message: `String too short (minimum ${schema.minLength} characters)` });
      }
      if (schema.maxLength !== undefined && data.length > schema.maxLength) {
        errors.push({ path, message: `String too long (maximum ${schema.maxLength} characters)` });
      }
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(data)) {
          errors.push({ path, message: `String does not match pattern ${schema.pattern}` });
        }
      }
    }

    if (typeof data === 'number') {
      if (schema.minimum !== undefined) {
        if (schema.exclusiveMinimum === true && data <= schema.minimum) {
          errors.push({ path, message: `Number must be greater than ${schema.minimum}` });
        } else if (schema.exclusiveMinimum !== true && data < schema.minimum) {
          errors.push({ path, message: `Number below minimum ${schema.minimum}` });
        }
      }
      
      if (typeof schema.exclusiveMinimum === 'number' && data <= schema.exclusiveMinimum) {
        errors.push({ path, message: `Number must be greater than ${schema.exclusiveMinimum}` });
      }
      
      if (schema.maximum !== undefined) {
        if (schema.exclusiveMaximum === true && data >= schema.maximum) {
          errors.push({ path, message: `Number must be less than ${schema.maximum}` });
        } else if (schema.exclusiveMaximum !== true && data > schema.maximum) {
          errors.push({ path, message: `Number above maximum ${schema.maximum}` });
        }
      }
      
      if (typeof schema.exclusiveMaximum === 'number' && data >= schema.exclusiveMaximum) {
        errors.push({ path, message: `Number must be less than ${schema.exclusiveMaximum}` });
      }
    }

    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      if (schema.required) {
        for (const key of schema.required) {
          if (!(key in data)) {
            errors.push({ path: `${path}.${key}`, message: 'Required property missing' });
          }
        }
      }

      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in data) {
            this._validate(data[key], propSchema, `${path}.${key}`, errors, rootSchema, new Set());
          }
        }
      }

      if (schema.patternProperties) {
        for (const [pattern, propSchema] of Object.entries(schema.patternProperties)) {
          const regex = new RegExp(pattern);
          for (const key of Object.keys(data)) {
            if (regex.test(key)) {
              this._validate(data[key], propSchema, `${path}.${key}`, errors, rootSchema, new Set());
            }
          }
        }
      }

      if (schema.additionalProperties !== undefined) {
        const allowedKeys = new Set(Object.keys(schema.properties || {}));
        const patternMatchedKeys = new Set();
        
        if (schema.patternProperties) {
          for (const key of Object.keys(data)) {
            for (const pattern of Object.keys(schema.patternProperties)) {
              if (new RegExp(pattern).test(key)) {
                patternMatchedKeys.add(key);
              }
            }
          }
        }
        
        for (const key of Object.keys(data)) {
          if (!allowedKeys.has(key) && !patternMatchedKeys.has(key)) {
            if (schema.additionalProperties === false) {
              errors.push({ path: `${path}.${key}`, message: 'Additional property not allowed' });
            } else if (typeof schema.additionalProperties === 'object') {
              this._validate(data[key], schema.additionalProperties, `${path}.${key}`, errors, rootSchema, new Set());
            }
          }
        }
      }
    }

    if (Array.isArray(data)) {
      if (schema.minItems !== undefined && data.length < schema.minItems) {
        errors.push({ path, message: `Array too short (minimum ${schema.minItems} items)` });
      }
      if (schema.maxItems !== undefined && data.length > schema.maxItems) {
        errors.push({ path, message: `Array too long (maximum ${schema.maxItems} items)` });
      }
      
      if (schema.uniqueItems) {
        const seen = [];
        for (const item of data) {
          for (const seenItem of seen) {
            if (this._deepEqual(item, seenItem)) {
              errors.push({ path, message: 'Array items must be unique' });
              break;
            }
          }
          if (errors.some(e => e.path === path && e.message === 'Array items must be unique')) {
            break;
          }
          seen.push(item);
        }
      }

      if (schema.items) {
        data.forEach((item, index) => {
          this._validate(item, schema.items, `${path}[${index}]`, errors, rootSchema, new Set());
        });
      }
    }

    if (schema.allOf) {
      for (const subSchema of schema.allOf) {
        this._validate(data, subSchema, path, errors, rootSchema, new Set());
      }
    }

    if (schema.anyOf) {
      const anyValid = schema.anyOf.some(subSchema => {
        const subErrors = [];
        this._validate(data, subSchema, path, subErrors, rootSchema, new Set());
        return subErrors.length === 0;
      });
      if (!anyValid) {
        errors.push({ path, message: 'Does not match any schema in anyOf' });
      }
    }
  }

  _checkType(data, type) {
    if (Array.isArray(type)) {
      return type.some(t => this._checkType(data, t));
    }
    switch (type) {
      case 'string': return typeof data === 'string';
      case 'number': return typeof data === 'number';
      case 'integer': return typeof data === 'number' && Number.isInteger(data);
      case 'boolean': return typeof data === 'boolean';
      case 'array': return Array.isArray(data);
      case 'object': return typeof data === 'object' && !Array.isArray(data) && data !== null;
      case 'null': return data === null;
      default: return false;
    }
  }

  _resolveRef(ref, rootSchema) {
    if (ref.startsWith('#/')) {
      const parts = ref.slice(2).split('/');
      let current = rootSchema;
      for (const part of parts) {
        if (current === undefined || current === null) {
          return null;
        }
        current = current[part];
      }
      return current || null;
    }
    return this.schemas[ref] || null;
  }

  _deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this._deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key) || !this._deepEqual(a[key], b[key])) return false;
    }
    
    return true;
  }
}

module.exports = SchemaValidator;

