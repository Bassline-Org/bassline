/**
 * Tests for the Lattice system
 */

import * as fc from 'fast-check';
import { z } from 'zod';
import {
  Lattice,
  ValidatedLattice,
  PauseLattice,
  MaxIntLattice,
  BoolOrLattice,
  FenceLattice,
  RateLimitLattice
} from '../../core/lattice';

describe('Lattice System', () => {
  describe('ValidatedLattice', () => {
    it('should validate schema on join', () => {
      const lattice = new ValidatedLattice<number>(
        'TestInt',
        z.number().int(),
        {
          join: (a, b) => Math.max(a, b),
          bottom: () => 0,
          top: () => 100
        }
      );

      expect(lattice.join(5, 10)).toBe(10);
      expect(() => lattice.join('5' as any, 10)).toThrow();
      expect(() => lattice.join(5.5, 10)).toThrow();
    });

    it('should run property tests successfully', () => {
      const lattice = new ValidatedLattice<number>(
        'MaxInt',
        z.number().int(),
        {
          join: (a, b) => Math.max(a, b),
          bottom: () => Number.MIN_SAFE_INTEGER
        }
      );

      const tests = lattice.generatePropertyTests();
      
      // Run idempotent test
      const idempotentResult = fc.check(tests.idempotent, { 
        numRuns: 100,
        verbose: false 
      });
      expect(idempotentResult.failed).toBe(false);

      // Run commutative test
      const commutativeResult = fc.check(tests.commutative, { 
        numRuns: 100,
        verbose: false 
      });
      expect(commutativeResult.failed).toBe(false);

      // Run associative test
      const associativeResult = fc.check(tests.associative, { 
        numRuns: 100,
        verbose: false 
      });
      expect(associativeResult.failed).toBe(false);
    });
  });

  describe('PauseLattice', () => {
    it('should handle pause values correctly', () => {
      expect(PauseLattice.join(false, false)).toBe(false);
      expect(PauseLattice.join(false, true)).toBe(true);
      expect(PauseLattice.join(true, false)).toBe(true);
      expect(PauseLattice.join(true, true)).toBe(true);
    });

    it('should have correct bottom and top', () => {
      expect(PauseLattice.bottom()).toBe(false);
      expect(PauseLattice.top?.()).toBe(true);
    });

    it('should satisfy lattice laws', () => {
      const tests = PauseLattice.generatePropertyTests();
      
      const results = Object.entries(tests).map(([name, test]) => ({
        name,
        result: fc.check(test, { numRuns: 100, verbose: false })
      }));

      results.forEach(({ name, result }) => {
        expect(result.failed).toBe(false);
      });
    });
  });

  describe('MaxIntLattice', () => {
    it('should take maximum of integers', () => {
      expect(MaxIntLattice.join(5, 10)).toBe(10);
      expect(MaxIntLattice.join(10, 5)).toBe(10);
      expect(MaxIntLattice.join(-5, -10)).toBe(-5);
    });

    it('should handle edge cases', () => {
      const bottom = MaxIntLattice.bottom();
      expect(MaxIntLattice.join(bottom, 5)).toBe(5);
      expect(MaxIntLattice.join(5, bottom)).toBe(5);
    });

    it('should satisfy lattice laws', () => {
      const tests = MaxIntLattice.generatePropertyTests();
      
      const results = Object.entries(tests).map(([name, test]) => ({
        name,
        result: fc.check(test, { numRuns: 100, verbose: false })
      }));

      results.forEach(({ name, result }) => {
        expect(result.failed).toBe(false);
      });
    });
  });

  describe('BoolOrLattice', () => {
    it('should perform logical OR', () => {
      expect(BoolOrLattice.join(false, false)).toBe(false);
      expect(BoolOrLattice.join(false, true)).toBe(true);
      expect(BoolOrLattice.join(true, false)).toBe(true);
      expect(BoolOrLattice.join(true, true)).toBe(true);
    });

    it('should have correct bottom and top', () => {
      expect(BoolOrLattice.bottom()).toBe(false);
      expect(BoolOrLattice.top?.()).toBe(true);
    });
  });

  describe('FenceLattice', () => {
    it('should handle fence epochs correctly', () => {
      const f1 = { epoch: 1, isFenced: false };
      const f2 = { epoch: 2, isFenced: true };
      const f3 = { epoch: 3, isFenced: false };

      const result1 = FenceLattice.join(f1, f2);
      expect(result1?.epoch).toBe(2);
      expect(result1?.isFenced).toBe(true);

      const result2 = FenceLattice.join(f2, f3);
      expect(result2?.epoch).toBe(3);
      expect(result2?.isFenced).toBe(false);
    });

    it('should handle undefined values', () => {
      const f1 = { epoch: 1, isFenced: true };
      
      expect(FenceLattice.join(undefined, f1)).toEqual(f1);
      expect(FenceLattice.join(f1, undefined)).toEqual(f1);
      expect(FenceLattice.join(undefined, undefined)).toBeUndefined();
    });

    it('should have correct bottom', () => {
      expect(FenceLattice.bottom()).toBeUndefined();
    });
  });

  describe('RateLimitLattice', () => {
    it('should take minimum rate limit', () => {
      const r1 = { rps: 100, burst: 10 };
      const r2 = { rps: 50, burst: 20 };
      
      const result = RateLimitLattice.join(r1, r2);
      expect(result?.rps).toBe(50);
      expect(result?.burst).toBe(10);
    });

    it('should handle undefined burst', () => {
      const r1 = { rps: 100 };
      const r2 = { rps: 50, burst: 20 };
      
      const result = RateLimitLattice.join(r1, r2);
      expect(result?.rps).toBe(50);
      expect(result?.burst).toBe(20);
    });

    it('should handle undefined values', () => {
      const r1 = { rps: 100 };
      
      expect(RateLimitLattice.join(undefined, r1)).toEqual(r1);
      expect(RateLimitLattice.join(r1, undefined)).toEqual(r1);
      expect(RateLimitLattice.join(undefined, undefined)).toBeUndefined();
    });

    it('should have correct bottom', () => {
      expect(RateLimitLattice.bottom()).toBeUndefined();
    });

    it('should satisfy lattice laws', () => {
      const tests = RateLimitLattice.generatePropertyTests();
      
      const results = Object.entries(tests).map(([name, test]) => ({
        name,
        result: fc.check(test, { numRuns: 100, verbose: false })
      }));

      results.forEach(({ name, result }) => {
        expect(result.failed).toBe(false);
      });
    });
  });

  describe('Lattice Catalog', () => {
    it('should create a catalog of lattices', () => {
      const catalog = new Map<string, Lattice<any>>();
      
      catalog.set('Pause', PauseLattice);
      catalog.set('MaxInt', MaxIntLattice);
      catalog.set('BoolOr', BoolOrLattice);
      catalog.set('Fence', FenceLattice);
      catalog.set('RateLimit', RateLimitLattice);

      expect(catalog.size).toBe(5);
      expect(catalog.get('Pause')).toBe(PauseLattice);
      expect(catalog.get('MaxInt')).toBe(MaxIntLattice);
    });
  });

  describe('Custom Lattice', () => {
    it('should allow creating custom lattices', () => {
      interface StringSet {
        values: Set<string>;
      }

      const StringSetLattice = new ValidatedLattice<StringSet>(
        'StringSet',
        z.object({ values: z.instanceof(Set) }),
        {
          join: (a, b) => ({
            values: new Set([...a.values, ...b.values])
          }),
          bottom: () => ({ values: new Set() })
        }
      );

      const s1 = { values: new Set(['a', 'b']) };
      const s2 = { values: new Set(['b', 'c']) };
      
      const result = StringSetLattice.join(s1, s2);
      expect(result.values.size).toBe(3);
      expect(result.values.has('a')).toBe(true);
      expect(result.values.has('b')).toBe(true);
      expect(result.values.has('c')).toBe(true);
    });
  });
});