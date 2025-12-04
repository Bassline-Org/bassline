import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { serializeValue, reviveValue } from '../src/mirror/index.js';
import { word, ref, isWord, isRef } from '../src/types.js';
import { createBassline } from '../src/setup.js';

describe('Value Serialization', () => {
  describe('serializeValue', () => {
    it('should serialize primitives as-is', () => {
      expect(serializeValue(42)).toBe(42);
      expect(serializeValue('hello')).toBe('hello');
      expect(serializeValue(true)).toBe(true);
      expect(serializeValue(null)).toBe(null);
    });

    it('should serialize Words as tagged values', () => {
      const w = word('alice');
      const serialized = serializeValue(w);
      expect(serialized).toEqual({ $word: 'ALICE' });
    });

    it('should serialize Refs as URI strings', () => {
      const r = ref('bl:///cell/counter');
      const serialized = serializeValue(r);
      expect(serialized).toBe('bl:///cell/counter');
    });

    it('should serialize arrays recursively', () => {
      const arr = [42, word('test'), ref('bl:///cell/x')];
      const serialized = serializeValue(arr);
      expect(serialized).toEqual([42, { $word: 'TEST' }, 'bl:///cell/x']);
    });

    it('should serialize objects recursively', () => {
      const obj = {
        name: word('alice'),
        link: ref('bl:///cell/data'),
        count: 5
      };
      const serialized = serializeValue(obj);
      expect(serialized).toEqual({
        name: { $word: 'ALICE' },
        link: 'bl:///cell/data',
        count: 5
      });
    });
  });

  describe('reviveValue', () => {
    it('should revive primitives as-is', () => {
      expect(reviveValue(42)).toBe(42);
      expect(reviveValue('hello')).toBe('hello');
      expect(reviveValue(true)).toBe(true);
      expect(reviveValue(null)).toBe(null);
    });

    it('should revive tagged Words', () => {
      const revived = reviveValue({ $word: 'ALICE' });
      expect(isWord(revived)).toBe(true);
      expect(revived.spelling.description).toBe('ALICE');
    });

    it('should revive arrays recursively', () => {
      const revived = reviveValue([42, { $word: 'TEST' }]);
      expect(revived[0]).toBe(42);
      expect(isWord(revived[1])).toBe(true);
    });

    it('should revive objects recursively', () => {
      const revived = reviveValue({
        name: { $word: 'ALICE' },
        count: 5
      });
      expect(isWord(revived.name)).toBe(true);
      expect(revived.count).toBe(5);
    });

    it('should NOT automatically convert URI strings to Refs', () => {
      const revived = reviveValue('bl:///cell/x');
      expect(typeof revived).toBe('string');
      expect(isRef(revived)).toBe(false);
    });
  });
});

describe('Mirror Serialization via Middleware', () => {
  let bl;

  beforeEach(() => {
    bl = createBassline();
  });

  afterEach(() => {
    bl.dispose();
  });

  describe('Cell serialization', () => {
    it('should serialize cell with primitive value', () => {
      bl.write('bl:///cell/counter', 42);
      const cell = bl.resolve('bl:///cell/counter');
      const json = cell.toJSON();

      expect(json.$mirror).toBe('cell');
      expect(json.uri).toBe('bl:///cell/counter');
      expect(json.value).toBe(42);
    });

    it('should serialize cell with Word value', () => {
      bl.write('bl:///cell/name', word('alice'));
      const cell = bl.resolve('bl:///cell/name');
      const json = cell.toJSON();

      expect(json.value).toEqual({ $word: 'ALICE' });
    });

    it('should serialize cell with Ref value', () => {
      bl.write('bl:///cell/link', ref('bl:///other/thing'));
      const cell = bl.resolve('bl:///cell/link');
      const json = cell.toJSON();

      expect(json.value).toBe('bl:///other/thing');
    });

    it('should restore cell by resolving URI', () => {
      bl.write('bl:///cell/counter', 42);
      const original = bl.resolve('bl:///cell/counter');
      const json = original.toJSON();

      // Restore by resolving the URI
      const restored = bl.resolve(json.uri);
      expect(restored.read()).toBe(42);
    });
  });

  describe('Fold serialization', () => {
    it('should serialize fold with URI', () => {
      bl.write('bl:///cell/a', 10);
      bl.write('bl:///cell/b', 20);

      const fold = bl.resolve('bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b');
      const json = fold.toJSON();

      expect(json.$mirror).toBe('sum');
      expect(json.uri).toBe('bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b');
    });

    it('should restore fold by resolving URI', () => {
      bl.write('bl:///cell/a', 10);
      bl.write('bl:///cell/b', 20);

      const original = bl.resolve('bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b');
      const json = original.toJSON();

      const restored = bl.resolve(json.uri);
      expect(restored.read()).toBe(30);
    });
  });

  describe('Remote serialization', () => {
    it('should serialize remote with URI', () => {
      const remote = bl.resolve('bl:///remote/peer1?address=ws://localhost:8080');
      const json = remote.toJSON();

      expect(json.$mirror).toBe('remote');
      expect(json.uri).toBe('bl:///remote/peer1?address=ws://localhost:8080');

      remote.dispose();
    });
  });

  describe('nested structures', () => {
    it('should handle nested objects with mixed types', () => {
      bl.write('bl:///cell/data', {
        user: {
          name: word('alice'),
          profile: ref('bl:///cell/profile')
        },
        counts: [1, 2, 3]
      });

      const cell = bl.resolve('bl:///cell/data');
      const json = cell.toJSON();

      expect(json.value.user.name).toEqual({ $word: 'ALICE' });
      expect(json.value.user.profile).toBe('bl:///cell/profile');
      expect(json.value.counts).toEqual([1, 2, 3]);
    });
  });
});
