import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBassline, Cell, ref } from '../src/setup.js';

describe('bl:// Scheme', () => {
  let bl;

  beforeEach(() => {
    bl = createBassline();
  });

  afterEach(() => {
    bl.dispose();
  });

  describe('bl:///cell/', () => {
    it('should create cells by path', () => {
      const m1 = bl.resolve('bl:///cell/counter');
      const m2 = bl.resolve('bl:///cell/counter');
      expect(m1).toBe(m2);
      expect(m1).toBeInstanceOf(Cell);
    });

    it('should support initial values', () => {
      const value = bl.read('bl:///cell/counter?initial=42');
      expect(value).toBe(42);
    });

    it('should parse numeric initial values', () => {
      const value = bl.read('bl:///cell/x?initial=3.14');
      expect(value).toBe(3.14);
    });

    it('should parse boolean initial values', () => {
      expect(bl.read('bl:///cell/bool-true?initial=true')).toBe(true);
      expect(bl.read('bl:///cell/bool-false?initial=false')).toBe(false);
    });

    it('should support nested paths', () => {
      bl.write('bl:///cell/user/profile/name', 'Alice');
      bl.write('bl:///cell/user/profile/age', 30);
      expect(bl.read('bl:///cell/user/profile/name')).toBe('Alice');
      expect(bl.read('bl:///cell/user/profile/age')).toBe(30);
    });
  });

  describe('bl:///fold/', () => {
    it('should create folds from bl:// sources', () => {
      bl.write('bl:///cell/a', 10);
      bl.write('bl:///cell/b', 20);

      const value = bl.read('bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b');
      expect(value).toBe(30);
    });

    it('should recompute when bl:// sources change', () => {
      bl.write('bl:///cell/x', 5);
      bl.write('bl:///cell/y', 10);

      const fold = bl.resolve('bl:///fold/sum?sources=bl:///cell/x,bl:///cell/y');
      expect(fold.read()).toBe(15);

      bl.write('bl:///cell/x', 100);
      expect(fold.read()).toBe(110);
    });

    it('should support different reducers', () => {
      bl.write('bl:///cell/v1', 5);
      bl.write('bl:///cell/v2', 10);
      bl.write('bl:///cell/v3', 3);

      const sources = 'bl:///cell/v1,bl:///cell/v2,bl:///cell/v3';
      expect(bl.read(`bl:///fold/max?sources=${sources}`)).toBe(10);
      expect(bl.read(`bl:///fold/min?sources=${sources}`)).toBe(3);
      expect(bl.read(`bl:///fold/avg?sources=${sources}`)).toBe(6);
    });

    it('should throw on unknown fold type', () => {
      bl.write('bl:///cell/a', 1);
      expect(() => bl.read('bl:///fold/unknown?sources=bl:///cell/a')).toThrow('No resolver');
    });
  });

  describe('bl:///remote/', () => {
    it('should create named peers', () => {
      const peer = bl.resolve('bl:///remote/alice?address=ws://localhost:8080');
      expect(peer).toBeDefined();
      expect(peer.readable).toBe(true);
      expect(peer.writable).toBe(true);
    });

    it('should return same peer for same ref', () => {
      const p1 = bl.resolve('bl:///remote/bob?address=ws://localhost:9000');
      const p2 = bl.resolve('bl:///remote/bob?address=ws://localhost:9000');
      expect(p1).toBe(p2);
    });
  });

  describe('Custom middleware', () => {
    it('should support custom resolvers', () => {
      bl.use('/custom', (r, bl) => {
        const c = new Cell(r, bl);
        c._value = `custom:${r.pathname.slice(8)}`; // remove /custom/
        return c;
      });

      expect(bl.read('bl:///custom/mypath')).toBe('custom:mypath');
    });

    it('should error on unknown paths', () => {
      expect(() => bl.read('bl:///unknown/path')).toThrow('No resolver');
    });
  });
});
