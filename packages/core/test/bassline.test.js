import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Bassline, ref } from '../src/bassline.js';
import { Cell } from '../src/mirror/cell.js';
import { createBassline } from '../src/setup.js';

describe('Bassline', () => {
  let bl;

  beforeEach(() => {
    bl = new Bassline();
  });

  afterEach(() => {
    bl.dispose();
  });

  describe('middleware registration', () => {
    it('should register middleware with use()', () => {
      bl.use('/cell', (ref, bl) => new Cell(ref, bl));
      expect(bl.listResolvers()).toContain('/cell');
    });

    it('should normalize paths', () => {
      bl.use('foo', (ref, bl) => new Cell(ref, bl));
      bl.use('/bar/', (ref, bl) => new Cell(ref, bl));
      expect(bl.listResolvers()).toContain('/foo');
      expect(bl.listResolvers()).toContain('/bar');
    });
  });

  describe('resolution', () => {
    beforeEach(() => {
      bl.use('/cell', (ref, bl) => new Cell(ref, bl));
    });

    it('should resolve refs to mirrors', () => {
      const mirror = bl.resolve('bl:///cell/counter');
      expect(mirror).toBeDefined();
      expect(mirror.readable).toBe(true);
    });

    it('should cache resolved mirrors', () => {
      const mirror1 = bl.resolve('bl:///cell/counter');
      const mirror2 = bl.resolve('bl:///cell/counter');
      expect(mirror1).toBe(mirror2);
    });

    it('should use longest prefix match', () => {
      bl.use('/cell/special', (ref, bl) => {
        const c = new Cell(ref, bl);
        c._special = true;
        return c;
      });

      const regular = bl.resolve('bl:///cell/counter');
      const special = bl.resolve('bl:///cell/special/foo');

      expect(regular._special).toBeUndefined();
      expect(special._special).toBe(true);
    });

    it('should throw for unsupported schemes', () => {
      expect(() => bl.resolve('ws://localhost/test')).toThrow('Unsupported scheme');
    });

    it('should throw for unknown paths', () => {
      expect(() => bl.resolve('bl:///unknown')).toThrow('No resolver');
    });
  });

  describe('read/write/watch', () => {
    beforeEach(() => {
      bl.use('/cell', (ref, bl) => new Cell(ref, bl));
    });

    it('should read from a mirror', () => {
      bl.write('bl:///cell/counter', 42);
      expect(bl.read('bl:///cell/counter')).toBe(42);
    });

    it('should write to a mirror', () => {
      bl.write('bl:///cell/counter', 100);
      expect(bl.read('bl:///cell/counter')).toBe(100);
    });

    it('should watch a mirror', () => {
      const values = [];
      bl.watch('bl:///cell/counter', (v) => values.push(v));

      bl.write('bl:///cell/counter', 1);
      bl.write('bl:///cell/counter', 2);

      expect(values).toEqual([1, 2]);
    });

    it('should work with Ref objects', () => {
      bl.write(ref('bl:///cell/counter'), 42);
      expect(bl.read(ref('bl:///cell/counter'))).toBe(42);
    });

    it('should throw for non-readable mirrors', () => {
      bl.use('/writeonly', (r, bl) => ({
        readable: false,
        writable: true,
        read() { throw new Error('not readable'); },
        write() {},
        subscribe() { return () => {}; }
      }));
      expect(() => bl.read('bl:///writeonly/test')).toThrow('not readable');
    });

    it('should throw for non-writable mirrors', () => {
      bl.use('/readonly', (r, bl) => ({
        readable: true,
        writable: false,
        read() { return 42; },
        write() { throw new Error('not writable'); },
        subscribe() { return () => {}; }
      }));
      expect(() => bl.write('bl:///readonly/test', 1)).toThrow('not writable');
    });
  });

  describe('event listeners', () => {
    beforeEach(() => {
      bl.use('/cell', (ref, bl) => new Cell(ref, bl));
    });

    it('should notify write listeners', () => {
      const writes = [];
      bl.onWrite((ref, value, result, bassline) => {
        writes.push({ href: ref.href, value });
      });

      bl.write('bl:///cell/a', 10);
      bl.write('bl:///cell/b', 20);

      expect(writes).toHaveLength(2);
      expect(writes[0].value).toBe(10);
      expect(writes[1].value).toBe(20);
    });

    it('should notify read listeners', () => {
      const reads = [];
      bl.onRead((ref, result, bassline) => {
        reads.push({ href: ref.href, result });
      });

      bl.write('bl:///cell/counter', 42);
      bl.read('bl:///cell/counter');

      expect(reads).toHaveLength(1);
      expect(reads[0].result).toBe(42);
    });

    it('should allow unsubscribe from listeners', () => {
      const writes = [];
      const unsub = bl.onWrite((ref, value) => writes.push(value));

      bl.write('bl:///cell/a', 1);
      unsub();
      bl.write('bl:///cell/b', 2);

      expect(writes).toEqual([1]);
    });

    it('should support middleware with event listeners', () => {
      const logs = [];
      bl.use('/logged', {
        resolve: (ref, bl) => new Cell(ref, bl),
        onWrite: (ref, value) => logs.push(`write: ${value}`),
        onRead: (ref, result) => logs.push(`read: ${result}`)
      });

      bl.write('bl:///logged/test', 42);
      bl.read('bl:///logged/test');

      expect(logs).toContain('write: 42');
      expect(logs).toContain('read: 42');
    });
  });

  describe('introspection', () => {
    it('should list resolved mirrors', () => {
      bl.use('/cell', (ref, bl) => new Cell(ref, bl));

      bl.resolve('bl:///cell/a');
      bl.resolve('bl:///cell/b');

      const mirrors = bl.listMirrors();
      expect(mirrors).toContain('bl:///cell/a');
      expect(mirrors).toContain('bl:///cell/b');
    });

    it('should check if ref is resolved', () => {
      bl.use('/cell', (ref, bl) => new Cell(ref, bl));

      expect(bl.hasResolved('bl:///cell/test')).toBe(false);
      bl.resolve('bl:///cell/test');
      expect(bl.hasResolved('bl:///cell/test')).toBe(true);
    });
  });
});

describe('Registry introspection', () => {
  let bl;

  beforeEach(() => {
    bl = createBassline();
  });

  afterEach(() => {
    bl.dispose();
  });

  it('should list resolvers via registry', () => {
    const resolvers = bl.read('bl:///registry');
    expect(resolvers).toContain('/cell');
    expect(resolvers).toContain('/fold/sum');
    expect(resolvers).toContain('/registry');
  });

  it('should list mirrors via registry', () => {
    bl.write('bl:///cell/a', 1);
    bl.write('bl:///cell/b', 2);

    const mirrors = bl.read('bl:///registry/mirrors');
    expect(mirrors).toContain('bl:///cell/a');
    expect(mirrors).toContain('bl:///cell/b');
  });

  it('should get info about a specific mirror', () => {
    bl.write('bl:///cell/counter', 42);

    const info = bl.read('bl:///registry/info?ref=bl:///cell/counter');
    expect(info).toEqual({
      uri: 'bl:///cell/counter',
      type: 'cell',
      readable: true,
      writable: true,
      ordering: 'causal'
    });
  });

  it('should get info about a fold mirror', () => {
    bl.write('bl:///cell/a', 10);
    bl.write('bl:///cell/b', 20);
    bl.read('bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b');

    const info = bl.read('bl:///registry/info?ref=bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b');
    expect(info).toEqual({
      uri: 'bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b',
      type: 'sum',
      readable: true,
      writable: false,
      ordering: 'none'
    });
  });

  it('should return null for unresolved mirror', () => {
    const info = bl.read('bl:///registry/info?ref=bl:///cell/nonexistent');
    expect(info).toBeNull();
  });

  it('should throw error when ref parameter is missing', () => {
    expect(() => bl.read('bl:///registry/info')).toThrow('Missing ref parameter');
  });
});
