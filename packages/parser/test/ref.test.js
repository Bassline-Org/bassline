import { describe, it, expect } from 'vitest';
import {
  Ref,
  ref,
  isRef,
  isValidType,
  valuesEqual,
  serialize,
  hash
} from '../src/types.js';

describe('Ref', () => {
  describe('construction', () => {
    it('should create a ref from a valid URI', () => {
      const r = new Ref('local://counter');
      expect(r).toBeInstanceOf(Ref);
      expect(r.href).toBe('local://counter');
    });

    it('should throw on invalid URI', () => {
      expect(() => new Ref('not a uri')).toThrow(/Invalid URI/);
    });

    it('should throw on non-string', () => {
      expect(() => new Ref(123)).toThrow(/requires string/);
    });

    it('should normalize URIs', () => {
      const r = new Ref('HTTP://Example.COM/path');
      expect(r.scheme).toBe('http');
      expect(r.hostname).toBe('example.com');
    });
  });

  describe('properties', () => {
    it('should parse scheme', () => {
      expect(new Ref('local://counter').scheme).toBe('local');
      expect(new Ref('fold://sum').scheme).toBe('fold');
      expect(new Ref('ws://localhost:8080').scheme).toBe('ws');
      expect(new Ref('wss://secure.example.com').scheme).toBe('wss');
      expect(new Ref('file:///path/to/file').scheme).toBe('file');
    });

    it('should parse host', () => {
      expect(new Ref('ws://localhost:8080/path').host).toBe('localhost:8080');
      expect(new Ref('local://counter').host).toBe('counter');
    });

    it('should parse hostname', () => {
      expect(new Ref('ws://localhost:8080/path').hostname).toBe('localhost');
    });

    it('should parse port', () => {
      expect(new Ref('ws://localhost:8080/path').port).toBe('8080');
      expect(new Ref('ws://localhost/path').port).toBe('');
    });

    it('should parse pathname', () => {
      expect(new Ref('local://counter/alice').pathname).toBe('/alice');
      expect(new Ref('fold://sum').pathname).toBe('');
    });

    it('should parse search params', () => {
      const r = new Ref('fold://sum?sources=local://a,local://b');
      expect(r.search).toBe('?sources=local://a,local://b');
      expect(r.searchParams.get('sources')).toBe('local://a,local://b');
    });
  });

  describe('ref() factory', () => {
    it('should create a Ref', () => {
      const r = ref('local://counter');
      expect(r).toBeInstanceOf(Ref);
      expect(r.href).toBe('local://counter');
    });
  });

  describe('isRef()', () => {
    it('should identify Refs', () => {
      expect(isRef(new Ref('local://x'))).toBe(true);
      expect(isRef(ref('local://x'))).toBe(true);
    });

    it('should reject non-Refs', () => {
      expect(isRef('local://x')).toBe(false);
      expect(isRef({})).toBe(false);
      expect(isRef(null)).toBe(false);
      expect(isRef(undefined)).toBe(false);
    });
  });

  describe('isValidType()', () => {
    it('should accept Refs as valid types', () => {
      expect(isValidType(ref('local://x'))).toBe(true);
    });
  });

  describe('valuesEqual()', () => {
    it('should compare Refs by href', () => {
      const a = ref('local://counter');
      const b = ref('local://counter');
      const c = ref('local://other');

      expect(valuesEqual(a, b)).toBe(true);
      expect(valuesEqual(a, c)).toBe(false);
    });

    it('should normalize for comparison', () => {
      const a = ref('HTTP://Example.COM/path');
      const b = ref('http://example.com/path');
      expect(valuesEqual(a, b)).toBe(true);
    });
  });

  describe('serialize()', () => {
    it('should serialize Refs as angle-bracket URIs', () => {
      expect(serialize(ref('local://counter'))).toBe('<local://counter>');
      expect(serialize(ref('fold://sum?sources=a'))).toBe('<fold://sum?sources=a>');
    });
  });

  describe('hash()', () => {
    it('should hash Refs', () => {
      const h = hash(ref('local://counter'));
      expect(typeof h).toBe('number');
    });

    it('should produce same hash for equal Refs', () => {
      expect(hash(ref('local://x'))).toBe(hash(ref('local://x')));
    });

    it('should produce different hash for different Refs', () => {
      expect(hash(ref('local://x'))).not.toBe(hash(ref('local://y')));
    });
  });

  describe('toString()', () => {
    it('should return the href', () => {
      expect(ref('local://counter').toString()).toBe('local://counter');
    });
  });
});
