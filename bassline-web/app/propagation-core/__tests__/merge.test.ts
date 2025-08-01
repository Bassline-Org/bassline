import { describe, it, expect } from 'vitest';
import { 
  SimpleContent, 
  NumericContent, 
  RangeContent, 
  Contradiction 
} from '../models/MergeableContent';

describe('Merge Semantics', () => {
  describe('SimpleContent', () => {
    it('should accept last value when merging', () => {
      const c1 = new SimpleContent('first');
      const c2 = new SimpleContent('second');
      const merged = c1.merge(c2);
      
      expect(merged).toBe(c2); // Last write wins
    });

    it('should propagate contradictions', () => {
      const c1 = new SimpleContent('value');
      const contradiction = new Contradiction('test error');
      const merged = c1.merge(contradiction);
      
      expect(merged).toBe(contradiction);
    });
  });

  describe('NumericContent', () => {
    it('should merge identical numbers without contradiction', () => {
      const n1 = new NumericContent(42);
      const n2 = new NumericContent(42);
      const merged = n1.merge(n2);
      
      expect(merged).toBe(n1); // Same value, returns first
      expect(merged).not.toBeInstanceOf(Contradiction);
    });

    it('should create contradiction for different numbers', () => {
      const n1 = new NumericContent(42);
      const n2 = new NumericContent(43);
      const merged = n1.merge(n2);
      
      expect(merged).toBeInstanceOf(Contradiction);
      expect((merged as Contradiction).reason).toContain('42 vs 43');
    });

    it('should create contradiction when merging with incompatible type', () => {
      const num = new NumericContent(42);
      const simple = new SimpleContent('text');
      const merged = num.merge(simple);
      
      expect(merged).toBeInstanceOf(Contradiction);
      expect((merged as Contradiction).reason).toContain('Cannot merge NumericContent with SimpleContent');
    });
  });

  describe('RangeContent', () => {
    it('should intersect overlapping ranges', () => {
      const r1 = new RangeContent(0, 10);
      const r2 = new RangeContent(5, 15);
      const merged = r1.merge(r2) as RangeContent;
      
      expect(merged).toBeInstanceOf(RangeContent);
      expect(merged.min).toBe(5);
      expect(merged.max).toBe(10);
    });

    it('should create contradiction for non-overlapping ranges', () => {
      const r1 = new RangeContent(0, 5);
      const r2 = new RangeContent(10, 15);
      const merged = r1.merge(r2);
      
      expect(merged).toBeInstanceOf(Contradiction);
      expect((merged as Contradiction).reason).toContain('Range intersection is empty');
    });

    it('should narrow to point when merging with compatible number', () => {
      const range = new RangeContent(0, 10);
      const num = new NumericContent(5);
      const merged = range.merge(num);
      
      expect(merged).toBe(num); // Point within range
    });

    it('should create contradiction when number is outside range', () => {
      const range = new RangeContent(0, 10);
      const num = new NumericContent(15);
      const merged = range.merge(num);
      
      expect(merged).toBeInstanceOf(Contradiction);
      expect((merged as Contradiction).reason).toContain('Value 15 outside range [0, 10]');
    });
  });

  describe('Contradiction', () => {
    it('should always return itself when merged', () => {
      const c1 = new Contradiction('error 1');
      const c2 = new NumericContent(42);
      const merged = c1.merge(c2);
      
      expect(merged).toBe(c1); // Contradiction is sticky
    });
  });
});