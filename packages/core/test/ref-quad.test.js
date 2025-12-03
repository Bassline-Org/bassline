import { describe, it, expect } from 'vitest';
import { quad, Quad } from '../src/algebra/quad.js';
import { ref, word } from '../src/types.js';

describe('Refs in Quads', () => {
  describe('allowed positions', () => {
    it('should accept ref as value', () => {
      const q = quad(word('alice'), word('source'), ref('bl:///cell/data'));
      expect(q.value.href).toBe('bl:///cell/data');
    });

    it('should accept ref as context', () => {
      const q = quad(word('alice'), word('age'), 30, ref('bl:///remote/peer1'));
      expect(q.context.href).toBe('bl:///remote/peer1');
    });
  });

  describe('disallowed positions', () => {
    it('should reject ref as entity', () => {
      expect(() => {
        quad(ref('bl:///cell/alice'), word('age'), 30);
      }).toThrow(/Entity cannot be a Ref/);
    });

    it('should reject ref as attribute', () => {
      expect(() => {
        quad(word('alice'), ref('bl:///schema/age'), 30);
      }).toThrow(/Attribute cannot be a Ref/);
    });
  });

  describe('hashing', () => {
    it('should hash quads with refs consistently', () => {
      const group = word('test-group');
      const q1 = quad(word('a'), word('x'), ref('bl:///cell/data'), group);
      const q2 = quad(word('a'), word('x'), ref('bl:///cell/data'), group);
      expect(q1.hash()).toBe(q2.hash());
    });

    it('should produce different hashes for different refs', () => {
      const group = word('test-group');
      const q1 = quad(word('a'), word('x'), ref('bl:///cell/a'), group);
      const q2 = quad(word('a'), word('x'), ref('bl:///cell/b'), group);
      expect(q1.hash()).not.toBe(q2.hash());
    });
  });
});
