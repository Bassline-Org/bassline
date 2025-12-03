import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  Cell,
  RefRegistry,
  createRegistry,
  registerAction,
  ref
} from '../src/mirror/index.js';

describe('bl:// Scheme', () => {
  let registry;

  beforeEach(() => {
    registry = createRegistry();
  });

  afterEach(() => {
    registry.dispose();
  });

  describe('bl:///cell/', () => {
    it('should create cells by path', () => {
      const m1 = registry.lookup(ref('bl:///cell/counter'));
      const m2 = registry.lookup(ref('bl:///cell/counter'));
      expect(m1).toBe(m2);
      expect(m1).toBeInstanceOf(Cell);
    });

    it('should support initial values', () => {
      const m = registry.lookup(ref('bl:///cell/counter?initial=42'));
      expect(m.read()).toBe(42);
    });

    it('should parse numeric initial values', () => {
      const m = registry.lookup(ref('bl:///cell/x?initial=3.14'));
      expect(m.read()).toBe(3.14);
    });

    it('should parse boolean initial values', () => {
      expect(registry.lookup(ref('bl:///cell/bool-true?initial=true')).read()).toBe(true);
      expect(registry.lookup(ref('bl:///cell/bool-false?initial=false')).read()).toBe(false);
    });

    it('should support nested paths', () => {
      const m1 = registry.lookup(ref('bl:///cell/user/profile/name'));
      const m2 = registry.lookup(ref('bl:///cell/user/profile/age'));
      m1.write('Alice');
      m2.write(30);
      expect(m1.read()).toBe('Alice');
      expect(m2.read()).toBe(30);
    });
  });

  describe('bl:///fold/', () => {
    it('should create folds from bl:// sources', () => {
      // Create source cells using bl:// scheme
      const a = registry.lookup(ref('bl:///cell/a?initial=10'));
      const b = registry.lookup(ref('bl:///cell/b?initial=20'));

      const m = registry.lookup(ref('bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b'));
      expect(m.read()).toBe(30);
    });

    it('should recompute when bl:// sources change', () => {
      const a = registry.lookup(ref('bl:///cell/x?initial=5'));
      const b = registry.lookup(ref('bl:///cell/y?initial=10'));

      const fold = registry.lookup(ref('bl:///fold/sum?sources=bl:///cell/x,bl:///cell/y'));
      expect(fold.read()).toBe(15);

      a.write(100);
      expect(fold.read()).toBe(110);
    });

    it('should support different reducers', () => {
      registry.lookup(ref('bl:///cell/v1?initial=5'));
      registry.lookup(ref('bl:///cell/v2?initial=10'));
      registry.lookup(ref('bl:///cell/v3?initial=3'));

      const sources = 'bl:///cell/v1,bl:///cell/v2,bl:///cell/v3';
      expect(registry.resolve(ref(`bl:///fold/max?sources=${sources}`))).toBe(10);
      expect(registry.resolve(ref(`bl:///fold/min?sources=${sources}`))).toBe(3);
      expect(registry.resolve(ref(`bl:///fold/avg?sources=${sources}`))).toBe(6);
    });

    it('should throw on unknown reducer', () => {
      expect(() => registry.lookup(ref('bl:///fold/unknown?sources=bl:///cell/a'))).toThrow(/Unknown fold reducer/);
    });

    it('should throw on missing sources', () => {
      expect(() => registry.lookup(ref('bl:///fold/sum'))).toThrow(/requires sources/);
    });
  });

  describe('bl:///remote/', () => {
    it('should create named peers', () => {
      const peer = registry.lookup(ref('bl:///remote/alice?address=ws://localhost:8080'));
      expect(peer).toBeDefined();
      // RemoteMirror is readable and writable (when connected)
      expect(peer.readable).toBe(true);
      expect(peer.writable).toBe(true);
    });

    it('should return same peer for same name', () => {
      const p1 = registry.lookup(ref('bl:///remote/bob?address=ws://localhost:9000'));
      const p2 = registry.lookup(ref('bl:///remote/bob'));
      expect(p1).toBe(p2);
    });
  });

  describe('bl:///action/', () => {
    it('should call registered action handlers', () => {
      const calls = [];
      registerAction(registry, 'test', (params) => {
        calls.push(params);
      });

      const action = registry.lookup(ref('bl:///action/test?foo=bar&count=42'));
      action.write({ direct: true });

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({ direct: true });
    });

    it('should throw on unknown action', () => {
      expect(() => registry.lookup(ref('bl:///action/nonexistent'))).toThrow(/Unknown action/);
    });

    it('should have built-in log action', () => {
      // Built-in log action should be installed
      const log = registry.lookup(ref('bl:///action/log?message=test'));
      expect(log).toBeDefined();
    });

    it('should have built-in noop action', () => {
      const noop = registry.lookup(ref('bl:///action/noop'));
      expect(noop).toBeDefined();
      // Should not throw
      noop.write({});
    });
  });

  describe('Type registry', () => {
    it('should list registered types', () => {
      const types = registry.listTypes();
      expect(types).toContain('cell');
      expect(types).toContain('fold');
      expect(types).toContain('remote');
      expect(types).toContain('action');
    });

    it('should support custom types', () => {
      registry.registerType('custom', (subpath, ref, reg) => {
        return new Cell(`custom:${subpath}`);
      });

      const m = registry.lookup(ref('bl:///custom/mypath'));
      expect(m.read()).toBe('custom:mypath');
    });

    it('should error on unknown type', () => {
      expect(() => registry.lookup(ref('bl:///unknown/path'))).toThrow(/Unknown bl:\/\/ type/);
    });
  });
});
