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
      const r = new Ref('bl:///cell/counter');
      expect(r).toBeInstanceOf(Ref);
      expect(r.href).toBe('bl:///cell/counter');
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
      expect(new Ref('bl:///cell/counter').scheme).toBe('bl');
      expect(new Ref('ws://localhost:8080').scheme).toBe('ws');
      expect(new Ref('wss://secure.example.com').scheme).toBe('wss');
      expect(new Ref('file:///path/to/file').scheme).toBe('file');
      expect(new Ref('https://example.com').scheme).toBe('https');
    });

    it('should parse host', () => {
      expect(new Ref('ws://localhost:8080/path').host).toBe('localhost:8080');
      expect(new Ref('bl:///cell/counter').host).toBe('');
    });

    it('should parse hostname', () => {
      expect(new Ref('ws://localhost:8080/path').hostname).toBe('localhost');
    });

    it('should parse port', () => {
      expect(new Ref('ws://localhost:8080/path').port).toBe('8080');
      expect(new Ref('ws://localhost/path').port).toBe('');
    });

    it('should parse pathname', () => {
      expect(new Ref('bl:///cell/alice').pathname).toBe('/cell/alice');
      expect(new Ref('ws://localhost/path').pathname).toBe('/path');
      expect(new Ref('ws://localhost').pathname).toBe('/');
    });

    it('should parse search params', () => {
      const r = new Ref('bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b');
      expect(r.search).toBe('?sources=bl:///cell/a,bl:///cell/b');
      expect(r.searchParams.get('sources')).toBe('bl:///cell/a,bl:///cell/b');
    });
  });

  describe('ref() factory', () => {
    it('should create a Ref', () => {
      const r = ref('bl:///cell/counter');
      expect(r).toBeInstanceOf(Ref);
      expect(r.href).toBe('bl:///cell/counter');
    });
  });

  describe('isRef()', () => {
    it('should identify Refs', () => {
      expect(isRef(new Ref('bl:///cell/x'))).toBe(true);
      expect(isRef(ref('ws://localhost'))).toBe(true);
    });

    it('should reject non-Refs', () => {
      expect(isRef('bl:///cell/x')).toBe(false);
      expect(isRef({})).toBe(false);
      expect(isRef(null)).toBe(false);
      expect(isRef(undefined)).toBe(false);
    });
  });

  describe('isValidType()', () => {
    it('should accept Refs as valid types', () => {
      expect(isValidType(ref('bl:///cell/x'))).toBe(true);
    });
  });

  describe('valuesEqual()', () => {
    it('should compare Refs by href', () => {
      const a = ref('bl:///cell/counter');
      const b = ref('bl:///cell/counter');
      const c = ref('bl:///cell/other');

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
      expect(serialize(ref('bl:///cell/counter'))).toBe('<bl:///cell/counter>');
      expect(serialize(ref('bl:///fold/sum?sources=a'))).toBe('<bl:///fold/sum?sources=a>');
    });
  });

  describe('hash()', () => {
    it('should hash Refs', () => {
      const h = hash(ref('bl:///cell/counter'));
      expect(typeof h).toBe('number');
    });

    it('should produce same hash for equal Refs', () => {
      expect(hash(ref('bl:///cell/x'))).toBe(hash(ref('bl:///cell/x')));
    });

    it('should produce different hash for different Refs', () => {
      expect(hash(ref('bl:///cell/x'))).not.toBe(hash(ref('bl:///cell/y')));
    });
  });

  describe('toString()', () => {
    it('should return the href', () => {
      expect(ref('bl:///cell/counter').toString()).toBe('bl:///cell/counter');
    });
  });
});
