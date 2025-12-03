import { describe, it, expect, beforeEach } from 'vitest';
import {
  Cell,
  Fold,
  ActionMirror,
  RemoteMirror,
  reducers,
  serializeValue,
  reviveValue,
  serializeMirror,
  deserializeMirror,
  toJSON,
  fromJSON,
  createRegistry,
  registerAction
} from '../src/mirror/index.js';
import { word, ref, isWord, isRef } from '../src/types.js';

describe('Mirror Serialization', () => {
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

  describe('Cell serialization', () => {
    it('should serialize cell with primitive value', () => {
      const cell = new Cell(42, 'bl:///cell/counter');
      const json = cell.toJSON();

      expect(json).toEqual({
        $mirror: 'cell',
        uri: 'bl:///cell/counter',
        value: 42
      });
    });

    it('should serialize cell with Word value', () => {
      const cell = new Cell(word('alice'), 'bl:///cell/name');
      const json = cell.toJSON();

      expect(json).toEqual({
        $mirror: 'cell',
        uri: 'bl:///cell/name',
        value: { $word: 'ALICE' }
      });
    });

    it('should serialize cell with Ref value', () => {
      const cell = new Cell(ref('bl:///other/thing'), 'bl:///cell/link');
      const json = cell.toJSON();

      expect(json).toEqual({
        $mirror: 'cell',
        uri: 'bl:///cell/link',
        value: 'bl:///other/thing'
      });
    });

    it('should round-trip cell with primitive', () => {
      const original = new Cell(42, 'bl:///cell/counter');
      const json = original.toJSON();
      const restored = Cell.fromJSON(json);

      expect(restored.read()).toBe(42);
      expect(restored._uri).toBe('bl:///cell/counter');
    });

    it('should round-trip cell with Word', () => {
      const original = new Cell(word('alice'), 'bl:///cell/name');
      const json = original.toJSON();
      const restored = Cell.fromJSON(json);

      expect(isWord(restored.read())).toBe(true);
      expect(restored.read().spelling.description).toBe('ALICE');
    });

    it('should merge data into existing cell', () => {
      const cell = new Cell(10);
      cell.merge({ value: 20 });
      expect(cell.read()).toBe(20);
    });

    it('should preserve subscribers on merge', () => {
      const cell = new Cell(10);
      let notified = false;
      cell.subscribe(() => { notified = true; });

      cell.merge({ value: 20 });
      expect(notified).toBe(true);
    });
  });

  describe('Fold serialization', () => {
    let registry;

    beforeEach(() => {
      registry = createRegistry();
    });

    it('should serialize fold with sources and reducer', () => {
      const sources = [ref('bl:///cell/a'), ref('bl:///cell/b')];
      const fold = new Fold(sources, reducers.sum, registry, 'bl:///fold/sum', 'sum');
      const json = fold.toJSON();

      expect(json).toEqual({
        $mirror: 'fold',
        uri: 'bl:///fold/sum',
        sources: ['bl:///cell/a', 'bl:///cell/b'],
        reducer: 'sum'
      });
    });

    it('should round-trip fold', () => {
      const sources = [ref('bl:///cell/a'), ref('bl:///cell/b')];
      const original = new Fold(sources, reducers.max, registry, 'bl:///fold/max', 'max');
      const json = original.toJSON();
      const restored = Fold.fromJSON(json, registry);

      expect(restored._uri).toBe('bl:///fold/max');
      expect(restored._reducerName).toBe('max');
      expect(restored._sources.length).toBe(2);
    });

    it('should throw on unknown reducer during deserialization', () => {
      const json = {
        $mirror: 'fold',
        uri: 'bl:///fold/unknown',
        sources: ['bl:///cell/a'],
        reducer: 'nonexistent'
      };

      expect(() => Fold.fromJSON(json, registry)).toThrow('Unknown reducer: nonexistent');
    });
  });

  describe('ActionMirror serialization', () => {
    it('should serialize action metadata', () => {
      const action = new ActionMirror(() => {}, { name: 'myaction', doc: 'Test action' });
      const json = action.toJSON();

      expect(json).toEqual({
        $mirror: 'action',
        name: 'myaction',
        doc: 'Test action'
      });
    });

    it('should deserialize to registered action', () => {
      const registry = createRegistry();
      let called = false;
      registerAction(registry, 'testaction', () => { called = true; });

      const json = { $mirror: 'action', name: 'testaction' };
      const restored = ActionMirror.fromJSON(json, registry);

      restored.write({});
      expect(called).toBe(true);
    });

    it('should create placeholder for unregistered action', () => {
      const json = { $mirror: 'action', name: 'unknown', doc: 'Some doc' };
      const restored = ActionMirror.fromJSON(json, null);

      expect(restored._name).toBe('unknown');
      expect(() => restored.write({})).toThrow("Action 'unknown' not registered");
    });
  });

  describe('RemoteMirror serialization', () => {
    it('should serialize remote config', () => {
      const remote = new RemoteMirror('ws://localhost:8080', {
        maxReconnectAttempts: 3,
        reconnectDelay: 500
      }, 'bl:///remote/peer1');
      const json = remote.toJSON();

      expect(json).toEqual({
        $mirror: 'remote',
        uri: 'bl:///remote/peer1',
        url: 'ws://localhost:8080',
        options: {
          maxReconnectAttempts: 3,
          reconnectDelay: 500
        }
      });

      remote.dispose();
    });

    it('should round-trip remote config', () => {
      const json = {
        $mirror: 'remote',
        uri: 'bl:///remote/peer2',
        url: 'ws://example.com:9000',
        options: {
          maxReconnectAttempts: 10,
          reconnectDelay: 2000
        }
      };

      const restored = RemoteMirror.fromJSON(json);

      expect(restored._uri).toBe('bl:///remote/peer2');
      expect(restored._url).toBe('ws://example.com:9000');
      expect(restored._maxReconnectAttempts).toBe(10);
      expect(restored._reconnectDelay).toBe(2000);

      restored.dispose();
    });
  });

  describe('deserializeMirror', () => {
    it('should dispatch to correct fromJSON based on $mirror type', () => {
      const cellJson = { $mirror: 'cell', uri: 'bl:///cell/x', value: 42 };
      const cell = deserializeMirror(cellJson);

      expect(cell).toBeInstanceOf(Cell);
      expect(cell.read()).toBe(42);
    });

    it('should throw on missing $mirror field', () => {
      expect(() => deserializeMirror({ value: 42 })).toThrow('$mirror type field');
    });

    it('should throw on unknown mirror type', () => {
      expect(() => deserializeMirror({ $mirror: 'unknown' })).toThrow('Unknown mirror type: unknown');
    });
  });

  describe('toJSON/fromJSON helpers', () => {
    it('should serialize mirror to JSON string', () => {
      const cell = new Cell(42, 'bl:///cell/test');
      const json = toJSON(cell);
      const parsed = JSON.parse(json);

      expect(parsed.$mirror).toBe('cell');
      expect(parsed.value).toBe(42);
    });

    it('should serialize value to JSON string', () => {
      const value = { name: word('alice'), count: 5 };
      const json = toJSON(value);
      const parsed = JSON.parse(json);

      expect(parsed.name).toEqual({ $word: 'ALICE' });
      expect(parsed.count).toBe(5);
    });

    it('should parse and revive JSON string', () => {
      const json = '{"$mirror":"cell","uri":"bl:///cell/x","value":100}';
      const cell = fromJSON(json);

      expect(cell).toBeInstanceOf(Cell);
      expect(cell.read()).toBe(100);
    });

    it('should support pretty printing', () => {
      const cell = new Cell(42);
      const json = toJSON(cell, true);

      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });
  });

  describe('nested structures', () => {
    it('should handle nested objects with mixed types', () => {
      const cell = new Cell({
        user: {
          name: word('alice'),
          profile: ref('bl:///cell/profile')
        },
        counts: [1, 2, 3]
      }, 'bl:///cell/data');

      const json = cell.toJSON();
      const restored = Cell.fromJSON(json);
      const value = restored.read();

      expect(isWord(value.user.name)).toBe(true);
      expect(value.user.profile).toBe('bl:///cell/profile'); // Refs become strings
      expect(value.counts).toEqual([1, 2, 3]);
    });
  });
});
