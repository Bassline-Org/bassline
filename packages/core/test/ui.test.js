import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBassline } from '../src/setup.js';

describe('UIMirror', () => {
  let bl;

  beforeEach(() => {
    bl = createBassline();
  });

  afterEach(() => {
    bl.dispose();
  });

  it('should store and retrieve UI definitions', () => {
    const definition = {
      type: 'form',
      title: 'User Profile',
      fields: [
        { path: 'name', label: 'Name', widget: 'text' },
        { path: 'email', label: 'Email', widget: 'text' }
      ]
    };

    bl.write('bl:///ui/user-profile', definition);
    const result = bl.read('bl:///ui/user-profile');

    expect(result).toEqual(definition);
  });

  it('should require type field', () => {
    expect(() => {
      bl.write('bl:///ui/invalid', { title: 'No type' });
    }).toThrow('UI definition must have a type');
  });

  it('should allow null values', () => {
    bl.write('bl:///ui/test', { type: 'form' });
    bl.write('bl:///ui/test', null);
    expect(bl.read('bl:///ui/test')).toBeNull();
  });

  it('should support subscriptions', () => {
    const values = [];

    bl.watch('bl:///ui/test', v => values.push(v));

    bl.write('bl:///ui/test', { type: 'form', v: 1 });
    bl.write('bl:///ui/test', { type: 'form', v: 2 });

    expect(values).toEqual([
      { type: 'form', v: 1 },
      { type: 'form', v: 2 }
    ]);
  });

  it('should have causal ordering', () => {
    const mirror = bl.resolve('bl:///ui/test');
    expect(mirror.ordering).toBe('causal');
  });

  it('should be readable and writable', () => {
    const mirror = bl.resolve('bl:///ui/test');
    expect(mirror.readable).toBe(true);
    expect(mirror.writable).toBe(true);
  });

  it('should have correct mirror type', () => {
    const mirror = bl.resolve('bl:///ui/test');
    expect(mirror.constructor.mirrorType).toBe('ui');
  });

  it('should serialize to JSON', () => {
    bl.write('bl:///ui/test', { type: 'form', title: 'Test' });
    const mirror = bl.resolve('bl:///ui/test');
    const json = mirror.toJSON();

    expect(json.$mirror).toBe('ui');
    expect(json.uri).toBe('bl:///ui/test');
    expect(json.definition).toEqual({ type: 'form', title: 'Test' });
  });

  it('should support $ref markers in definitions', () => {
    bl.write('bl:///ui/user-form', {
      type: 'form',
      data: { $ref: 'bl:///cell/user' },
      schema: { $ref: 'bl:///schema/user' },
      fields: [
        { path: 'name', label: 'Name' }
      ]
    });

    const def = bl.read('bl:///ui/user-form');
    expect(def.data.$ref).toBe('bl:///cell/user');
    expect(def.schema.$ref).toBe('bl:///schema/user');
  });
});

describe('SchemaMirror', () => {
  let bl;

  beforeEach(() => {
    bl = createBassline();
  });

  afterEach(() => {
    bl.dispose();
  });

  it('should store and retrieve schema definitions', () => {
    const definition = {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        email: { type: 'string', format: 'email' }
      },
      required: ['name', 'email']
    };

    bl.write('bl:///schema/user', definition);
    const result = bl.read('bl:///schema/user');

    expect(result).toEqual(definition);
  });

  it('should require type field', () => {
    expect(() => {
      bl.write('bl:///schema/invalid', { properties: {} });
    }).toThrow('Schema definition must have a type');
  });

  it('should allow null values', () => {
    bl.write('bl:///schema/test', { type: 'string' });
    bl.write('bl:///schema/test', null);
    expect(bl.read('bl:///schema/test')).toBeNull();
  });

  it('should support subscriptions', () => {
    const values = [];

    bl.watch('bl:///schema/test', v => values.push(v));

    bl.write('bl:///schema/test', { type: 'string' });
    bl.write('bl:///schema/test', { type: 'number' });

    expect(values).toEqual([
      { type: 'string' },
      { type: 'number' }
    ]);
  });

  it('should have causal ordering', () => {
    const mirror = bl.resolve('bl:///schema/test');
    expect(mirror.ordering).toBe('causal');
  });

  it('should be readable and writable', () => {
    const mirror = bl.resolve('bl:///schema/test');
    expect(mirror.readable).toBe(true);
    expect(mirror.writable).toBe(true);
  });

  it('should have correct mirror type', () => {
    const mirror = bl.resolve('bl:///schema/test');
    expect(mirror.constructor.mirrorType).toBe('schema');
  });

  it('should serialize to JSON', () => {
    bl.write('bl:///schema/test', { type: 'string', minLength: 1 });
    const mirror = bl.resolve('bl:///schema/test');
    const json = mirror.toJSON();

    expect(json.$mirror).toBe('schema');
    expect(json.uri).toBe('bl:///schema/test');
    expect(json.definition).toEqual({ type: 'string', minLength: 1 });
  });

  it('should support JSON Schema types', () => {
    // String
    bl.write('bl:///schema/str', { type: 'string', minLength: 0, maxLength: 100 });
    expect(bl.read('bl:///schema/str').type).toBe('string');

    // Number
    bl.write('bl:///schema/num', { type: 'number', minimum: 0, maximum: 100 });
    expect(bl.read('bl:///schema/num').type).toBe('number');

    // Boolean
    bl.write('bl:///schema/bool', { type: 'boolean' });
    expect(bl.read('bl:///schema/bool').type).toBe('boolean');

    // Array
    bl.write('bl:///schema/arr', { type: 'array', items: { type: 'string' } });
    expect(bl.read('bl:///schema/arr').type).toBe('array');

    // Object
    bl.write('bl:///schema/obj', { type: 'object', properties: {} });
    expect(bl.read('bl:///schema/obj').type).toBe('object');
  });
});

describe('UI + Schema Integration', () => {
  let bl;

  beforeEach(() => {
    bl = createBassline();
  });

  afterEach(() => {
    bl.dispose();
  });

  it('should support linking UI to schema via refs', () => {
    // Create schema
    bl.write('bl:///schema/user', {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' }
      }
    });

    // Create data
    bl.write('bl:///cell/user', {
      name: 'Alice',
      email: 'alice@example.com'
    });

    // Create UI linking to both
    bl.write('bl:///ui/user-form', {
      type: 'form',
      title: 'Edit User',
      data: { $ref: 'bl:///cell/user' },
      schema: { $ref: 'bl:///schema/user' },
      fields: [
        { path: 'name', label: 'Name', widget: 'text' },
        { path: 'email', label: 'Email', widget: 'text' }
      ]
    });

    // Read UI definition
    const ui = bl.read('bl:///ui/user-form');

    // Follow refs to get schema and data
    const schema = bl.read(ui.schema.$ref);
    const data = bl.read(ui.data.$ref);

    expect(schema.type).toBe('object');
    expect(data.name).toBe('Alice');
  });

  it('should support the full self-describing UI pattern', () => {
    // Bootstrap pattern: UI definitions describe themselves
    bl.write('bl:///ui/_bootstrap', {
      type: 'panel',
      title: 'Bassline Explorer',
      sections: [
        { id: 'resolvers', label: 'Resolvers' },
        { id: 'mirrors', label: 'Mirrors' }
      ]
    });

    const bootstrap = bl.read('bl:///ui/_bootstrap');
    expect(bootstrap.type).toBe('panel');
    expect(bootstrap.sections).toHaveLength(2);
  });
});
