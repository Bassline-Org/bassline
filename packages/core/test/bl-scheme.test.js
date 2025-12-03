import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBassline, Cell, ref } from '../src/setup.js';
import { createActionHandler } from '../src/mirror/handlers.js';

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
      const m1 = bl.getMirror(ref('bl:///cell/counter'));
      const m2 = bl.getMirror(ref('bl:///cell/counter'));
      expect(m1).toBe(m2);
      expect(m1).toBeInstanceOf(Cell);
    });

    it('should support initial values', () => {
      const value = bl.read(ref('bl:///cell/counter?initial=42'));
      expect(value).toBe(42);
    });

    it('should parse numeric initial values', () => {
      const value = bl.read(ref('bl:///cell/x?initial=3.14'));
      expect(value).toBe(3.14);
    });

    it('should parse boolean initial values', () => {
      expect(bl.read(ref('bl:///cell/bool-true?initial=true'))).toBe(true);
      expect(bl.read(ref('bl:///cell/bool-false?initial=false'))).toBe(false);
    });

    it('should support nested paths', () => {
      bl.write(ref('bl:///cell/user/profile/name'), 'Alice');
      bl.write(ref('bl:///cell/user/profile/age'), 30);
      expect(bl.read(ref('bl:///cell/user/profile/name'))).toBe('Alice');
      expect(bl.read(ref('bl:///cell/user/profile/age'))).toBe(30);
    });
  });

  describe('bl:///fold/', () => {
    it('should create folds from bl:// sources', () => {
      // Create source cells
      bl.write(ref('bl:///cell/a?initial=10'), 10);
      bl.write(ref('bl:///cell/b?initial=20'), 20);

      const value = bl.read(ref('bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b'));
      expect(value).toBe(30);
    });

    it('should recompute when bl:// sources change', () => {
      bl.write(ref('bl:///cell/x'), 5);
      bl.write(ref('bl:///cell/y'), 10);

      const fold = bl.getMirror(ref('bl:///fold/sum?sources=bl:///cell/x,bl:///cell/y'));
      expect(fold.read()).toBe(15);

      bl.write(ref('bl:///cell/x'), 100);
      expect(fold.read()).toBe(110);
    });

    it('should support different reducers', () => {
      bl.write(ref('bl:///cell/v1'), 5);
      bl.write(ref('bl:///cell/v2'), 10);
      bl.write(ref('bl:///cell/v3'), 3);

      const sources = 'bl:///cell/v1,bl:///cell/v2,bl:///cell/v3';
      expect(bl.read(ref(`bl:///fold/max?sources=${sources}`))).toBe(10);
      expect(bl.read(ref(`bl:///fold/min?sources=${sources}`))).toBe(3);
      expect(bl.read(ref(`bl:///fold/avg?sources=${sources}`))).toBe(6);
    });

    it('should throw on unknown reducer', () => {
      expect(() => bl.read(ref('bl:///fold/unknown?sources=bl:///cell/a'))).toThrow(/Unknown fold reducer/);
    });

    it('should throw on missing sources', () => {
      expect(() => bl.read(ref('bl:///fold/sum'))).toThrow(/requires sources/);
    });
  });

  describe('bl:///remote/', () => {
    it('should create named peers', () => {
      const peer = bl.getMirror(ref('bl:///remote/alice?address=ws://localhost:8080'));
      expect(peer).toBeDefined();
      expect(peer.readable).toBe(true);
      expect(peer.writable).toBe(true);
    });

    it('should return same peer for same name', () => {
      const p1 = bl.getMirror(ref('bl:///remote/bob?address=ws://localhost:9000'));
      const p2 = bl.getMirror(ref('bl:///remote/bob'));
      expect(p1).toBe(p2);
    });
  });

  describe('bl:///action/', () => {
    it('should call registered action handlers', () => {
      const calls = [];

      // Create a new bassline with custom action
      const customBl = createBassline({
        actions: {
          test: (params) => calls.push(params)
        }
      });

      customBl.write(ref('bl:///action/test?foo=bar'), { direct: true });

      expect(calls).toHaveLength(1);
      expect(calls[0].foo).toBe('bar');
      expect(calls[0].direct).toBe(true);

      customBl.dispose();
    });

    it('should throw on unknown action', () => {
      expect(() => bl.write(ref('bl:///action/nonexistent'), {})).toThrow(/Unknown action/);
    });

    it('should have built-in log action', () => {
      // Built-in log action should be installed - should not throw
      expect(() => bl.write(ref('bl:///action/log?message=test'), {})).not.toThrow();
    });

    it('should have built-in noop action', () => {
      // Should not throw
      expect(() => bl.write(ref('bl:///action/noop'), {})).not.toThrow();
    });
  });

  describe('Custom mounts', () => {
    it('should support custom handlers', () => {
      bl.mount('/custom', (subpath, ref, bassline) => {
        return new Cell(`custom:${subpath}`);
      });

      expect(bl.read(ref('bl:///custom/mypath'))).toBe('custom:mypath');
    });

    it('should error on unknown paths', () => {
      expect(() => bl.read(ref('bl:///unknown/path'))).toThrow(/No handler/);
    });
  });
});
