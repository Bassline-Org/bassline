import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBassline } from '../src/setup.js';
import { ref, isRef } from '../src/types.js';
import {
  isRefMarker,
  getPath,
  getRefAt,
  collectRefs,
  reviveRefs,
  setPath
} from '../src/compound.js';

describe('Compound Helper Utilities', () => {
  describe('isRefMarker', () => {
    it('should identify ref markers', () => {
      expect(isRefMarker({ $ref: 'bl:///cell/x' })).toBe(true);
      expect(isRefMarker({ $ref: 'https://example.com' })).toBe(true);
    });

    it('should reject non-ref values', () => {
      expect(isRefMarker({ name: 'alice' })).toBe(false);
      expect(isRefMarker('bl:///cell/x')).toBe(false);
      expect(isRefMarker(null)).toBe(false);
      expect(isRefMarker(undefined)).toBe(false);
      expect(isRefMarker(42)).toBe(false);
      expect(isRefMarker({ $ref: 123 })).toBe(false); // $ref must be string
    });
  });

  describe('getPath', () => {
    const structure = {
      user: {
        name: 'Alice',
        profile: { $ref: 'bl:///cell/profile' },
        contacts: [
          { $ref: 'bl:///cell/contact1' },
          { $ref: 'bl:///cell/contact2' }
        ]
      },
      count: 42
    };

    it('should navigate nested structures with string path', () => {
      expect(getPath(structure, 'user.name')).toBe('Alice');
      expect(getPath(structure, 'user.profile')).toEqual({ $ref: 'bl:///cell/profile' });
      expect(getPath(structure, 'count')).toBe(42);
    });

    it('should navigate with array path', () => {
      expect(getPath(structure, ['user', 'name'])).toBe('Alice');
    });

    it('should return undefined for missing paths', () => {
      expect(getPath(structure, 'user.missing')).toBe(undefined);
      expect(getPath(structure, 'nonexistent')).toBe(undefined);
      expect(getPath(structure, 'user.name.deep')).toBe(undefined);
    });

    it('should handle null/undefined structures', () => {
      expect(getPath(null, 'any.path')).toBe(undefined);
      expect(getPath(undefined, 'any.path')).toBe(undefined);
    });
  });

  describe('getRefAt', () => {
    const structure = {
      user: {
        profile: { $ref: 'bl:///cell/profile' },
        name: 'Alice'
      }
    };

    it('should return Ref at path with $ref marker', () => {
      const r = getRefAt(structure, 'user.profile');
      expect(r).not.toBeNull();
      expect(isRef(r)).toBe(true);
      expect(r.href).toBe('bl:///cell/profile');
    });

    it('should return null for non-ref values', () => {
      expect(getRefAt(structure, 'user.name')).toBeNull();
      expect(getRefAt(structure, 'missing')).toBeNull();
    });

    it('should handle Ref objects directly', () => {
      const withRef = { target: ref('bl:///cell/x') };
      const r = getRefAt(withRef, 'target');
      expect(r).not.toBeNull();
      expect(r.href).toBe('bl:///cell/x');
    });
  });

  describe('collectRefs', () => {
    it('should find all refs in structure', () => {
      const structure = {
        name: { $ref: 'bl:///cell/name' },
        contacts: [
          { $ref: 'bl:///cell/contact1' },
          { $ref: 'bl:///cell/contact2' }
        ],
        meta: {
          owner: { $ref: 'bl:///cell/owner' }
        }
      };

      const refs = collectRefs(structure);
      expect(refs).toHaveLength(4);
      expect(refs.map(r => r.href)).toContain('bl:///cell/name');
      expect(refs.map(r => r.href)).toContain('bl:///cell/contact1');
      expect(refs.map(r => r.href)).toContain('bl:///cell/contact2');
      expect(refs.map(r => r.href)).toContain('bl:///cell/owner');
    });

    it('should return empty array for no refs', () => {
      expect(collectRefs({ name: 'Alice', age: 30 })).toEqual([]);
      expect(collectRefs(null)).toEqual([]);
      expect(collectRefs(42)).toEqual([]);
    });

    it('should handle Ref objects directly', () => {
      const structure = {
        target: ref('bl:///cell/x')
      };
      const refs = collectRefs(structure);
      expect(refs).toHaveLength(1);
      expect(refs[0].href).toBe('bl:///cell/x');
    });
  });

  describe('reviveRefs', () => {
    it('should convert $ref markers to Ref objects', () => {
      const structure = {
        name: { $ref: 'bl:///cell/name' },
        nested: {
          target: { $ref: 'bl:///cell/target' }
        }
      };

      const revived = reviveRefs(structure);
      expect(isRef(revived.name)).toBe(true);
      expect(revived.name.href).toBe('bl:///cell/name');
      expect(isRef(revived.nested.target)).toBe(true);
    });

    it('should handle arrays', () => {
      const structure = [
        { $ref: 'bl:///cell/a' },
        { $ref: 'bl:///cell/b' }
      ];

      const revived = reviveRefs(structure);
      expect(Array.isArray(revived)).toBe(true);
      expect(isRef(revived[0])).toBe(true);
      expect(isRef(revived[1])).toBe(true);
    });

    it('should preserve non-ref values', () => {
      const structure = {
        name: 'Alice',
        age: 30,
        active: true
      };

      const revived = reviveRefs(structure);
      expect(revived).toEqual(structure);
    });
  });

  describe('setPath', () => {
    it('should set value at path immutably', () => {
      const original = { user: { name: 'Alice' } };
      const updated = setPath(original, 'user.name', 'Bob');

      expect(updated.user.name).toBe('Bob');
      expect(original.user.name).toBe('Alice'); // Original unchanged
    });

    it('should create nested structure if needed', () => {
      const result = setPath({}, 'user.profile.name', 'Alice');
      expect(result.user.profile.name).toBe('Alice');
    });

    it('should handle array paths', () => {
      const result = setPath({}, ['a', 'b', 'c'], 42);
      expect(result.a.b.c).toBe(42);
    });
  });
});

describe('CompoundMirror', () => {
  let bl;

  beforeEach(() => {
    bl = createBassline();
  });

  afterEach(() => {
    bl.dispose();
  });

  it('should store and retrieve compound definitions', () => {
    const definition = {
      name: { $ref: 'bl:///cell/alice-name' },
      email: { $ref: 'bl:///cell/alice-email' }
    };

    bl.write('bl:///compound/user-bundle', definition);
    const result = bl.read('bl:///compound/user-bundle');

    expect(result).toEqual(definition);
  });

  it('should keep refs as markers (not dereferenced)', () => {
    bl.write('bl:///cell/name', 'Alice');

    bl.write('bl:///compound/bundle', {
      name: { $ref: 'bl:///cell/name' }
    });

    const result = bl.read('bl:///compound/bundle');

    // Should be the marker, not 'Alice'
    expect(result.name).toEqual({ $ref: 'bl:///cell/name' });
    expect(result.name).not.toBe('Alice');
  });

  it('should support subscriptions', () => {
    const values = [];

    bl.watch('bl:///compound/test', v => values.push(v));

    bl.write('bl:///compound/test', { v: 1 });
    bl.write('bl:///compound/test', { v: 2 });

    // Subscriptions fire on writes (changes)
    expect(values).toEqual([{ v: 1 }, { v: 2 }]);
  });

  it('should have causal ordering', () => {
    const mirror = bl.resolve('bl:///compound/test');
    expect(mirror.ordering).toBe('causal');
  });

  it('should be readable and writable', () => {
    const mirror = bl.resolve('bl:///compound/test');
    expect(mirror.readable).toBe(true);
    expect(mirror.writable).toBe(true);
  });
});

describe('Compound Pattern Integration', () => {
  let bl;

  beforeEach(() => {
    bl = createBassline();
  });

  afterEach(() => {
    bl.dispose();
  });

  it('should support the full compound workflow', () => {
    // Set up some cells
    bl.write('bl:///cell/alice-name', 'Alice');
    bl.write('bl:///cell/alice-email', 'alice@example.com');

    // Create a compound that references them
    bl.write('bl:///compound/user', {
      name: { $ref: 'bl:///cell/alice-name' },
      email: { $ref: 'bl:///cell/alice-email' },
      role: 'admin'
    });

    // Read the compound
    const bundle = bl.read('bl:///compound/user');

    // Refs are preserved as markers
    expect(bundle.name.$ref).toBe('bl:///cell/alice-name');
    expect(bundle.email.$ref).toBe('bl:///cell/alice-email');
    expect(bundle.role).toBe('admin'); // Non-refs stay as-is

    // Explicitly follow refs
    const name = bl.read(bundle.name.$ref);
    const email = bl.read(bundle.email.$ref);

    expect(name).toBe('Alice');
    expect(email).toBe('alice@example.com');
  });

  it('should work with collectRefs for batch operations', () => {
    bl.write('bl:///cell/a', 10);
    bl.write('bl:///cell/b', 20);
    bl.write('bl:///cell/c', 30);

    bl.write('bl:///compound/numbers', {
      first: { $ref: 'bl:///cell/a' },
      second: { $ref: 'bl:///cell/b' },
      third: { $ref: 'bl:///cell/c' }
    });

    const bundle = bl.read('bl:///compound/numbers');
    const refs = collectRefs(bundle);

    // Batch read all values
    const values = refs.map(r => bl.read(r.href));
    const sum = values.reduce((a, b) => a + b, 0);

    expect(sum).toBe(60);
  });
});
