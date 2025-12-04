import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isMirror, BaseMirror, ref } from '../src/mirror/index.js';
import { createBassline } from '../src/setup.js';

describe('Cell', () => {
  let bl;

  beforeEach(() => {
    bl = createBassline();
  });

  afterEach(() => {
    bl.dispose();
  });

  it('should be readable and writable', () => {
    const c = bl.resolve('bl:///cell/test');
    expect(c.readable).toBe(true);
    expect(c.writable).toBe(true);
  });

  it('should store and retrieve values', () => {
    bl.write('bl:///cell/test', 42);
    expect(bl.read('bl:///cell/test')).toBe(42);
    bl.write('bl:///cell/test', 100);
    expect(bl.read('bl:///cell/test')).toBe(100);
  });

  it('should notify subscribers on write', () => {
    const values = [];
    bl.watch('bl:///cell/test', v => values.push(v));

    bl.write('bl:///cell/test', 1);
    bl.write('bl:///cell/test', 2);
    bl.write('bl:///cell/test', 3);

    expect(values).toEqual([1, 2, 3]);
  });

  it('should allow unsubscribe', () => {
    const values = [];
    const unsub = bl.watch('bl:///cell/test', v => values.push(v));

    bl.write('bl:///cell/test', 1);
    unsub();
    bl.write('bl:///cell/test', 2);

    expect(values).toEqual([1]);
  });

  it('should parse initial value from query param', () => {
    expect(bl.read('bl:///cell/num?initial=42')).toBe(42);
    expect(bl.read('bl:///cell/bool?initial=true')).toBe(true);
    expect(bl.read('bl:///cell/str?initial=hello')).toBe('hello');
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
    const f = bl.resolve('bl:///fold/sum');
    expect(f.readable).toBe(true);
    expect(f.writable).toBe(false);
  });

  it('should fold empty sources', () => {
    expect(bl.read('bl:///fold/sum')).toBe(0);
  });

  it('should fold multiple cell sources', () => {
    bl.write('bl:///cell/a', 10);
    bl.write('bl:///cell/b', 20);
    bl.write('bl:///cell/c', 30);

    const sources = 'bl:///cell/a,bl:///cell/b,bl:///cell/c';
    expect(bl.read(`bl:///fold/sum?sources=${sources}`)).toBe(60);
  });

  it('should recompute when sources change', () => {
    bl.write('bl:///cell/a', 10);
    bl.write('bl:///cell/b', 20);

    const sources = 'bl:///cell/a,bl:///cell/b';
    expect(bl.read(`bl:///fold/sum?sources=${sources}`)).toBe(30);

    bl.write('bl:///cell/a', 100);
    expect(bl.read(`bl:///fold/sum?sources=${sources}`)).toBe(120);
  });

  it('sum should add values', () => {
    bl.write('bl:///cell/a', 1);
    bl.write('bl:///cell/b', 2);
    bl.write('bl:///cell/c', 3);
    const sources = 'bl:///cell/a,bl:///cell/b,bl:///cell/c';
    expect(bl.read(`bl:///fold/sum?sources=${sources}`)).toBe(6);
  });

  it('max should find maximum', () => {
    bl.write('bl:///cell/a', 1);
    bl.write('bl:///cell/b', 5);
    bl.write('bl:///cell/c', 3);
    const sources = 'bl:///cell/a,bl:///cell/b,bl:///cell/c';
    expect(bl.read(`bl:///fold/max?sources=${sources}`)).toBe(5);
  });

  it('min should find minimum', () => {
    bl.write('bl:///cell/a', 1);
    bl.write('bl:///cell/b', 5);
    bl.write('bl:///cell/c', 3);
    const sources = 'bl:///cell/a,bl:///cell/b,bl:///cell/c';
    expect(bl.read(`bl:///fold/min?sources=${sources}`)).toBe(1);
  });

  it('avg should compute average', () => {
    bl.write('bl:///cell/a', 2);
    bl.write('bl:///cell/b', 4);
    bl.write('bl:///cell/c', 6);
    const sources = 'bl:///cell/a,bl:///cell/b,bl:///cell/c';
    expect(bl.read(`bl:///fold/avg?sources=${sources}`)).toBe(4);
  });

  it('count should count values', () => {
    bl.write('bl:///cell/a', 1);
    bl.write('bl:///cell/b', 2);
    bl.write('bl:///cell/c', 3);
    const sources = 'bl:///cell/a,bl:///cell/b,bl:///cell/c';
    expect(bl.read(`bl:///fold/count?sources=${sources}`)).toBe(3);
  });

  it('first should return first value', () => {
    bl.write('bl:///cell/a', 1);
    bl.write('bl:///cell/b', 2);
    bl.write('bl:///cell/c', 3);
    const sources = 'bl:///cell/a,bl:///cell/b,bl:///cell/c';
    expect(bl.read(`bl:///fold/first?sources=${sources}`)).toBe(1);
  });

  it('last should return last value', () => {
    bl.write('bl:///cell/a', 1);
    bl.write('bl:///cell/b', 2);
    bl.write('bl:///cell/c', 3);
    const sources = 'bl:///cell/a,bl:///cell/b,bl:///cell/c';
    expect(bl.read(`bl:///fold/last?sources=${sources}`)).toBe(3);
  });

  it('concat should join strings', () => {
    bl.write('bl:///cell/a', 'a');
    bl.write('bl:///cell/b', 'b');
    bl.write('bl:///cell/c', 'c');
    const sources = 'bl:///cell/a,bl:///cell/b,bl:///cell/c';
    expect(bl.read(`bl:///fold/concat?sources=${sources}`)).toBe('abc');
  });

  it('list should copy array', () => {
    bl.write('bl:///cell/a', 1);
    bl.write('bl:///cell/b', 2);
    bl.write('bl:///cell/c', 3);
    const sources = 'bl:///cell/a,bl:///cell/b,bl:///cell/c';
    expect(bl.read(`bl:///fold/list?sources=${sources}`)).toEqual([1, 2, 3]);
  });
});

describe('isMirror', () => {
  let bl;

  beforeEach(() => {
    bl = createBassline();
  });

  afterEach(() => {
    bl.dispose();
  });

  it('should identify mirrors', () => {
    const c = bl.resolve('bl:///cell/test');
    expect(isMirror(c)).toBe(true);
  });

  it('should reject non-mirrors', () => {
    expect(isMirror({})).toBe(false);
    expect(isMirror(null)).toBe(false);
    expect(isMirror({ readable: true })).toBe(false);
  });
});
