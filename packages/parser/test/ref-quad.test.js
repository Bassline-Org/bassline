import { describe, it, expect } from 'vitest';
import { quad, Quad } from '../src/algebra/quad.js';
import { ref, word } from '../src/types.js';

describe('Refs in Quads', () => {
  it('should accept ref as entity', () => {
    const q = quad(ref('local://alice'), word('age'), 30);
    expect(q.entity.href).toBe('local://alice');
  });

  it('should accept ref as attribute', () => {
    const q = quad(word('alice'), ref('schema://age'), 30);
    expect(q.attribute.href).toBe('schema://age');
  });

  it('should accept ref as value', () => {
    const q = quad(word('alice'), word('source'), ref('ws://remote:8080/data'));
    expect(q.value.href).toBe('ws://remote:8080/data');
  });

  it('should accept ref as context', () => {
    const q = quad(word('alice'), word('age'), 30, ref('local://context'));
    expect(q.context.href).toBe('local://context');
  });

  it('should hash quads with refs consistently', () => {
    // Use same explicit group so hashes match
    const group = word('test-group');
    const q1 = quad(ref('local://a'), word('x'), 1, group);
    const q2 = quad(ref('local://a'), word('x'), 1, group);
    expect(q1.hash()).toBe(q2.hash());
  });

  it('should produce different hashes for different refs', () => {
    const q1 = quad(ref('local://a'), word('x'), 1);
    const q2 = quad(ref('local://b'), word('x'), 1);
    expect(q1.hash()).not.toBe(q2.hash());
  });
});
