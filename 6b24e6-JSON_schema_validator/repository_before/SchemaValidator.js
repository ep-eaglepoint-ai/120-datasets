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
    this._validate(data, schema, '', errors);
    return { valid: errors.length === 0, errors };
  }

  _validate(data, schema, path, errors) {
    if (schema.$ref) {
      const refSchema = this._resolveRef(schema.$ref, schema);
      if (!refSchema) {
        errors.push({ path, message: `Unresolved $ref: ${schema.$ref}` });
        return;
      }
      return this._validate(data, refSchema, path, errors);
    }

    if (schema.oneOf) {
      const validSchemas = schema.oneOf.filter(subSchema => {
        const subErrors = [];
        this._validate(data, subSchema, path, subErrors);
        return subErrors.length === 0;
      });
      if (validSchemas.length === 0) {
        errors.push({ path, message: 'Does not match any schema in oneOf' });
      }
    }

    if (schema.additionalProperties === false && schema.properties) {
      const allowedKeys = Object.keys(schema.properties);
      for (const key of Object.keys(data || {})) {
        if (!allowedKeys.includes(key)) {
          errors.push({ path: `${path}.${key}`, message: 'Additional property not allowed' });
        }
      }
    }

    if (Array.isArray(data) && schema.uniqueItems) {
      const seen = new Set();
      for (const item of data) {
        if (seen.has(item)) {
          errors.push({ path, message: 'Array items must be unique' });
          break;
        }
        seen.add(item);
      }
    }

    if (schema.type) {
      if (!this._checkType(data, schema.type)) {
        errors.push({ path, message: `Expected type ${schema.type}` });
        return;
      }
    }

    if (typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) {
        errors.push({ path, message: `Number below minimum ${schema.minimum}` });
      }
      if (schema.maximum !== undefined && data > schema.maximum) {
        errors.push({ path, message: `Number above maximum ${schema.maximum}` });
      }
    }

    if (schema.required && typeof data === 'object' && data !== null) {
      for (const key of schema.required) {
        if (!(key in data)) {
          errors.push({ path: `${path}.${key}`, message: 'Required property missing' });
        }
      }
    }

    if (schema.properties && typeof data === 'object' && data !== null) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          this._validate(data[key], propSchema, `${path}.${key}`, errors);
        }
      }
    }

    if (schema.items && Array.isArray(data)) {
      data.forEach((item, index) => {
        this._validate(item, schema.items, `${path}[${index}]`, errors);
      });
    }

    if (schema.allOf) {
      for (const subSchema of schema.allOf) {
        this._validate(data, subSchema, path, errors);
      }
    }

    if (schema.anyOf) {
      const anyValid = schema.anyOf.some(subSchema => {
        const subErrors = [];
        this._validate(data, subSchema, path, subErrors);
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
      case 'object': return typeof data === 'object';
      case 'null': return data === null;
      default: return true;
    }
  }

  _resolveRef(ref, schema) {
    if (ref.startsWith('#/')) {
      const parts = ref.slice(2).split('/');
      let current = schema;
      for (const part of parts) {
        current = current?.[part];
      }
      return current;
    }
    return this.schemas[ref];
  }
}

module.exports = SchemaValidator;

