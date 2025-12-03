import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  Cell,
  cell,
  Fold,
  fold,
  reducers,
  RefRegistry,
  getRegistry,
  resetRegistry,
  createRegistry,
  isMirror,
  BaseMirror,
  ref
} from '../src/mirror/index.js';

describe('Cell', () => {
  it('should be readable and writable', () => {
    const c = new Cell();
    expect(c.readable).toBe(true);
    expect(c.writable).toBe(true);
  });

  it('should store and retrieve values', () => {
    const c = new Cell(42);
    expect(c.read()).toBe(42);
    c.write(100);
    expect(c.read()).toBe(100);
  });

  it('should notify subscribers on write', () => {
    const c = new Cell(0);
    const values = [];
    c.subscribe(v => values.push(v));

    c.write(1);
    c.write(2);
    c.write(3);

    expect(values).toEqual([1, 2, 3]);
  });

  it('should allow unsubscribe', () => {
    const c = new Cell(0);
    const values = [];
    const unsub = c.subscribe(v => values.push(v));

    c.write(1);
    unsub();
    c.write(2);

    expect(values).toEqual([1]);
  });

  it('cell() factory should work', () => {
    const c = cell(99);
    expect(c.read()).toBe(99);
  });
});

describe('Fold', () => {
  let registry;

  beforeEach(() => {
    registry = createRegistry();
  });

  afterEach(() => {
    registry.dispose();
  });

  it('should be readable but not writable', () => {
    const f = new Fold([], reducers.sum, registry);
    expect(f.readable).toBe(true);
    expect(f.writable).toBe(false);
  });

  it('should fold empty sources', () => {
    const f = new Fold([], reducers.sum, registry);
    expect(f.read()).toBe(0);
  });

  it('should fold multiple cell sources', () => {
    // Create cells via bl:///cell/ scheme
    const a = registry.lookup(ref('bl:///cell/a?initial=10'));
    const b = registry.lookup(ref('bl:///cell/b?initial=20'));
    const c = registry.lookup(ref('bl:///cell/c?initial=30'));

    const f = new Fold(
      [ref('bl:///cell/a'), ref('bl:///cell/b'), ref('bl:///cell/c')],
      reducers.sum,
      registry
    );

    expect(f.read()).toBe(60);
  });

  it('should recompute when sources change', () => {
    const a = registry.lookup(ref('bl:///cell/a?initial=10'));
    const b = registry.lookup(ref('bl:///cell/b?initial=20'));

    const f = new Fold(
      [ref('bl:///cell/a'), ref('bl:///cell/b')],
      reducers.sum,
      registry
    );

    expect(f.read()).toBe(30);

    a.write(100);
    expect(f.read()).toBe(120);

    b.write(200);
    expect(f.read()).toBe(300);
  });

  it('should notify subscribers on recompute', () => {
    const a = registry.lookup(ref('bl:///cell/a?initial=10'));

    const f = new Fold([ref('bl:///cell/a')], reducers.sum, registry);
    const values = [];
    f.subscribe(v => values.push(v));

    a.write(20);
    a.write(30);

    expect(values).toContain(20);
    expect(values).toContain(30);
  });
});

describe('reducers', () => {
  it('sum should add values', () => {
    expect(reducers.sum([1, 2, 3])).toBe(6);
    expect(reducers.sum([])).toBe(0);
  });

  it('max should find maximum', () => {
    expect(reducers.max([1, 5, 3])).toBe(5);
    expect(reducers.max([])).toBe(undefined);
  });

  it('min should find minimum', () => {
    expect(reducers.min([1, 5, 3])).toBe(1);
    expect(reducers.min([])).toBe(undefined);
  });

  it('avg should compute average', () => {
    expect(reducers.avg([2, 4, 6])).toBe(4);
    expect(reducers.avg([])).toBe(undefined);
  });

  it('count should count values', () => {
    expect(reducers.count([1, 2, 3])).toBe(3);
    expect(reducers.count([])).toBe(0);
  });

  it('first should return first value', () => {
    expect(reducers.first([1, 2, 3])).toBe(1);
    expect(reducers.first([])).toBe(undefined);
  });

  it('last should return last value', () => {
    expect(reducers.last([1, 2, 3])).toBe(3);
    expect(reducers.last([])).toBe(undefined);
  });

  it('concat should join strings', () => {
    expect(reducers.concat(['a', 'b', 'c'])).toBe('abc');
    expect(reducers.concat([])).toBe('');
  });

  it('list should copy array', () => {
    const arr = [1, 2, 3];
    const result = reducers.list(arr);
    expect(result).toEqual([1, 2, 3]);
    expect(result).not.toBe(arr);
  });
});

describe('RefRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new RefRegistry();
  });

  afterEach(() => {
    registry.dispose();
  });

  it('should register scheme handlers', () => {
    registry.registerScheme('test', () => new Cell(42));
    expect(registry.hasScheme('test')).toBe(true);
    expect(registry.hasScheme('unknown')).toBe(false);
  });

  it('should lookup refs via scheme handlers', () => {
    registry.registerScheme('test', () => new Cell(42));
    const mirror = registry.lookup(ref('test://something'));
    expect(mirror.read()).toBe(42);
  });

  it('should memoize lookups', () => {
    let callCount = 0;
    registry.registerScheme('test', () => {
      callCount++;
      return new Cell(callCount);
    });

    const r = ref('test://something');
    const m1 = registry.lookup(r);
    const m2 = registry.lookup(r);

    expect(m1).toBe(m2);
    expect(callCount).toBe(1);
  });

  it('should resolve refs to values', () => {
    registry.registerScheme('test', () => new Cell(42));
    expect(registry.resolve(ref('test://something'))).toBe(42);
  });

  it('should return undefined for unknown schemes', () => {
    expect(registry.lookup(ref('unknown://x'))).toBe(undefined);
    expect(registry.resolve(ref('unknown://x'))).toBe(undefined);
  });

  it('should provide stores for scheme handlers', () => {
    const store1 = registry.getStore('test');
    const store2 = registry.getStore('test');
    expect(store1).toBe(store2);
    expect(store1).toBeInstanceOf(Map);
  });

  it('should clear cache', () => {
    let callCount = 0;
    registry.registerScheme('test', () => {
      callCount++;
      return new Cell(callCount);
    });

    registry.lookup(ref('test://x'));
    registry.clearCache();
    registry.lookup(ref('test://x'));

    expect(callCount).toBe(2);
  });
});


describe('isMirror', () => {
  it('should identify mirrors', () => {
    expect(isMirror(new Cell())).toBe(true);
    expect(isMirror(new BaseMirror())).toBe(true);
  });

  it('should reject non-mirrors', () => {
    expect(isMirror({})).toBe(false);
    expect(isMirror(null)).toBe(false);
    expect(isMirror({ readable: true })).toBe(false);
  });
});

describe('Global registry', () => {
  afterEach(() => {
    resetRegistry();
  });

  it('should provide a global registry', () => {
    const r1 = getRegistry();
    const r2 = getRegistry();
    expect(r1).toBe(r2);
  });

  it('should reset global registry', () => {
    const r1 = getRegistry();
    resetRegistry();
    const r2 = getRegistry();
    expect(r1).not.toBe(r2);
  });
});
