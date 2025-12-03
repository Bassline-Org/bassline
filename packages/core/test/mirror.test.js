import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  Cell,
  cell,
  Fold,
  fold,
  reducers,
  isMirror,
  BaseMirror,
  ref
} from '../src/mirror/index.js';
import { createBassline } from '../src/setup.js';

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
  let bl;

  beforeEach(() => {
    bl = createBassline();
  });

  afterEach(() => {
    bl.dispose();
  });

  it('should be readable but not writable', () => {
    const f = new Fold([], reducers.sum);
    expect(f.readable).toBe(true);
    expect(f.writable).toBe(false);
  });

  it('should fold empty sources', () => {
    const f = new Fold([], reducers.sum);
    f.setBassline(bl);
    expect(f.read()).toBe(0);
  });

  it('should fold multiple cell sources', () => {
    // Create cells via bl:///cell/ scheme
    bl.write(ref('bl:///cell/a'), 10);
    bl.write(ref('bl:///cell/b'), 20);
    bl.write(ref('bl:///cell/c'), 30);

    const f = new Fold(
      [ref('bl:///cell/a'), ref('bl:///cell/b'), ref('bl:///cell/c')],
      reducers.sum,
      { bassline: bl }
    );

    expect(f.read()).toBe(60);
  });

  it('should recompute when sources change', () => {
    bl.write(ref('bl:///cell/a'), 10);
    bl.write(ref('bl:///cell/b'), 20);

    const f = new Fold(
      [ref('bl:///cell/a'), ref('bl:///cell/b')],
      reducers.sum,
      { bassline: bl }
    );

    expect(f.read()).toBe(30);

    bl.write(ref('bl:///cell/a'), 100);
    expect(f.read()).toBe(120);

    bl.write(ref('bl:///cell/b'), 200);
    expect(f.read()).toBe(300);
  });

  it('should notify subscribers on recompute', () => {
    bl.write(ref('bl:///cell/a'), 10);

    const f = new Fold([ref('bl:///cell/a')], reducers.sum, { bassline: bl });
    const values = [];
    f.subscribe(v => values.push(v));

    bl.write(ref('bl:///cell/a'), 20);
    bl.write(ref('bl:///cell/a'), 30);

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

describe('Bassline stores', () => {
  let bl;

  beforeEach(() => {
    bl = createBassline();
  });

  afterEach(() => {
    bl.dispose();
  });

  it('should provide named stores', () => {
    const store1 = bl.getStore('test');
    const store2 = bl.getStore('test');
    expect(store1).toBe(store2);
    expect(store1).toBeInstanceOf(Map);
  });
});
