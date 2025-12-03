import { describe, it, expect, beforeEach } from 'vitest';
import { Bassline, ref } from '../src/bassline.js';
import { mountRegistryMirror } from '../src/mirror/registry-mirror.js';
import { Cell } from '../src/mirror/cell.js';

describe('Bassline', () => {
  let bl;

  beforeEach(() => {
    bl = new Bassline();
  });

  describe('mounting', () => {
    it('should mount a handler at a path', () => {
      const cell = new Cell(42);
      bl.mount('/test', cell);
      expect(bl.listMounts()).toContain('/test');
    });

    it('should normalize paths', () => {
      bl.mount('foo', new Cell());
      bl.mount('/bar/', new Cell());
      expect(bl.listMounts()).toContain('/foo');
      expect(bl.listMounts()).toContain('/bar');
    });

    it('should unmount a path', () => {
      bl.mount('/test', new Cell());
      bl.unmount('/test');
      expect(bl.listMounts()).not.toContain('/test');
    });

    it('should notify on mount changes', () => {
      const changes = [];
      bl.onMountChange((change) => changes.push(change));

      bl.mount('/test', new Cell());
      bl.unmount('/test');

      expect(changes).toHaveLength(2);
      expect(changes[0].type).toBe('mount');
      expect(changes[1].type).toBe('unmount');
    });
  });

  describe('resolution', () => {
    it('should resolve exact path matches', () => {
      const cell = new Cell(42);
      bl.mount('/cell/counter', cell);

      const resolved = bl.resolve(ref('bl:///cell/counter'));
      expect(resolved.handler).toBe(cell);
      expect(resolved.subpath).toBe('');
    });

    it('should use longest prefix match', () => {
      const parentCell = new Cell('parent');
      const childCell = new Cell('child');
      bl.mount('/a', parentCell);
      bl.mount('/a/b', childCell);

      const resolved1 = bl.resolve(ref('bl:///a/b/c'));
      expect(resolved1.handler).toBe(childCell);
      expect(resolved1.subpath).toBe('c');

      const resolved2 = bl.resolve(ref('bl:///a/x'));
      expect(resolved2.handler).toBe(parentCell);
      expect(resolved2.subpath).toBe('x');
    });

    it('should handle root mount', () => {
      const rootHandler = new Cell('root');
      bl.mount('/', rootHandler);

      const resolved = bl.resolve(ref('bl:///anything/here'));
      expect(resolved.handler).toBe(rootHandler);
      expect(resolved.subpath).toBe('anything/here');
    });

    it('should return undefined for non-bl schemes', () => {
      bl.mount('/test', new Cell());
      const resolved = bl.resolve(ref('ws://localhost/test'));
      expect(resolved).toBeUndefined();
    });
  });

  describe('read/write/watch', () => {
    it('should read from a mirror', () => {
      bl.mount('/cell/counter', new Cell(42));
      const value = bl.read(ref('bl:///cell/counter'));
      expect(value).toBe(42);
    });

    it('should write to a mirror', () => {
      bl.mount('/cell/counter', new Cell(0));
      bl.write(ref('bl:///cell/counter'), 100);
      expect(bl.read(ref('bl:///cell/counter'))).toBe(100);
    });

    it('should watch a mirror', () => {
      bl.mount('/cell/counter', new Cell(0));
      const values = [];
      bl.watch(ref('bl:///cell/counter'), (v) => values.push(v));

      bl.write(ref('bl:///cell/counter'), 1);
      bl.write(ref('bl:///cell/counter'), 2);

      expect(values).toEqual([1, 2]);
    });

    it('should work with string refs', () => {
      bl.mount('/cell/counter', new Cell(42));
      expect(bl.read('bl:///cell/counter')).toBe(42);
    });

    it('should throw for unknown paths', () => {
      expect(() => bl.read(ref('bl:///unknown'))).toThrow('No handler');
    });
  });

  describe('handler functions', () => {
    it('should call handler function with subpath', () => {
      const store = new Map();

      // Handler function that creates cells on demand
      const cellHandler = (subpath, ref, bassline) => {
        if (!store.has(subpath)) {
          const initial = ref.searchParams.get('initial');
          store.set(subpath, new Cell(initial ? Number(initial) : 0));
        }
        return store.get(subpath);
      };

      bl.mount('/cell', cellHandler);

      // Should create and access cells by subpath
      bl.write(ref('bl:///cell/counter'), 42);
      expect(bl.read(ref('bl:///cell/counter'))).toBe(42);

      // Different subpath = different cell
      bl.write(ref('bl:///cell/other'), 100);
      expect(bl.read(ref('bl:///cell/other'))).toBe(100);
      expect(bl.read(ref('bl:///cell/counter'))).toBe(42);
    });

    it('should pass query params to handler', () => {
      let receivedRef;
      const handler = (subpath, ref) => {
        receivedRef = ref;
        return new Cell(ref.searchParams.get('value'));
      };

      bl.mount('/test', handler);
      bl.read(ref('bl:///test/foo?value=hello'));

      expect(receivedRef.searchParams.get('value')).toBe('hello');
    });
  });

  describe('stores', () => {
    it('should provide named stores', () => {
      const store1 = bl.getStore('test');
      const store2 = bl.getStore('test');
      expect(store1).toBe(store2);

      store1.set('key', 'value');
      expect(store2.get('key')).toBe('value');
    });
  });
});

describe('RegistryMirror', () => {
  let bl;

  beforeEach(() => {
    bl = new Bassline();
    mountRegistryMirror(bl);
  });

  describe('reading', () => {
    it('should list mounts', () => {
      bl.mount('/test', new Cell());
      const mounts = bl.read(ref('bl:///registry/mounts'));

      expect(mounts['/registry']).toBeDefined();
      expect(mounts['/test']).toBeDefined();
    });

    it('should describe mount at specific path', () => {
      bl.mount('/cell/counter', new Cell(42));
      const info = bl.read(ref('bl:///registry/mount/cell/counter'));

      expect(info.type).toBe('Cell');
      expect(info.readable).toBe(true);
      expect(info.writable).toBe(true);
    });

    it('should describe function handlers', () => {
      bl.mount('/test', function testHandler() {});
      const info = bl.read(ref('bl:///registry/mount/test'));

      expect(info.type).toBe('function');
      expect(info.name).toBe('testHandler');
    });

    it('should list stores', () => {
      bl.getStore('cells').set('counter', new Cell());
      bl.getStore('other').set('x', 1);

      const stores = bl.read(ref('bl:///registry/stores'));

      expect(stores.cells.size).toBe(1);
      expect(stores.cells.keys).toContain('counter');
      expect(stores.other.size).toBe(1);
    });
  });

  describe('writing', () => {
    it('should mount via registry', () => {
      const cell = new Cell(99);
      bl.write(ref('bl:///registry/mount'), { path: '/new', handler: cell });

      expect(bl.listMounts()).toContain('/new');
      expect(bl.read(ref('bl:///new'))).toBe(99);
    });

    it('should unmount via registry', () => {
      bl.mount('/temp', new Cell());
      bl.write(ref('bl:///registry/unmount'), '/temp');

      expect(bl.listMounts()).not.toContain('/temp');
    });

    it('should unmount via registry with object', () => {
      bl.mount('/temp', new Cell());
      bl.write(ref('bl:///registry/unmount'), { path: '/temp' });

      expect(bl.listMounts()).not.toContain('/temp');
    });
  });

  describe('watching', () => {
    it('should watch mount changes', () => {
      const changes = [];
      bl.watch(ref('bl:///registry/mounts'), (change) => changes.push(change));

      bl.mount('/new', new Cell());

      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('mount');
      expect(changes[0].path).toBe('/new');
    });
  });
});
