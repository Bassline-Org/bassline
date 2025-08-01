/**
 * Content that can be merged with other content
 * In a real multiple dispatch system, we'd have different merge methods
 * for different type combinations. In TypeScript, we simulate this.
 */

export interface MergeableContent {
  merge(other: MergeableContent): MergeableContent | Contradiction;
}

/**
 * Represents a merge conflict/contradiction
 */
export class Contradiction implements MergeableContent {
  readonly reason: string;
  
  constructor(reason: string) {
    this.reason = reason;
  }
  
  merge(other: MergeableContent): Contradiction {
    return this; // Contradiction + anything = Contradiction
  }
  
  isContradiction(): boolean {
    return true;
  }
}

/**
 * Simple value wrapper that accepts any value (last-write-wins)
 */
export class SimpleContent implements MergeableContent {
  readonly value: any;
  
  constructor(value: any) {
    this.value = value;
  }
  
  merge(other: MergeableContent): MergeableContent {
    if (other instanceof Contradiction) {
      return other;
    }
    // Last write wins for simple content
    return other;
  }
  
  isContradiction(): boolean {
    return false;
  }
}

/**
 * Numeric content with merge rules
 */
export class NumericContent implements MergeableContent {
  readonly value: number;
  
  constructor(value: number) {
    this.value = value;
  }
  
  merge(other: MergeableContent): MergeableContent | Contradiction {
    if (other instanceof Contradiction) {
      return other;
    }
    if (other instanceof NumericContent) {
      // Numbers must be equal to merge
      if (this.value === other.value) {
        return this; // Same value, no contradiction
      }
      return new Contradiction(`Numeric values conflict: ${this.value} vs ${other.value}`);
    }
    // Type mismatch
    return new Contradiction(`Cannot merge NumericContent with ${other.constructor.name}`);
  }
  
  isContradiction(): boolean {
    return false;
  }
}

/**
 * Range content - demonstrates lattice merge
 */
export class RangeContent implements MergeableContent {
  readonly min: number;
  readonly max: number;
  
  constructor(min: number, max: number) {
    this.min = min;
    this.max = max;
  }
  
  merge(other: MergeableContent): MergeableContent | Contradiction {
    if (other instanceof Contradiction) {
      return other;
    }
    if (other instanceof RangeContent) {
      // Intersection of ranges
      const newMin = Math.max(this.min, other.min);
      const newMax = Math.min(this.max, other.max);
      
      if (newMin > newMax) {
        return new Contradiction(`Range intersection is empty: [${newMin}, ${newMax}]`);
      }
      
      return new RangeContent(newMin, newMax);
    }
    if (other instanceof NumericContent) {
      // Point must be within range
      if (other.value < this.min || other.value > this.max) {
        return new Contradiction(`Value ${other.value} outside range [${this.min}, ${this.max}]`);
      }
      return other;
    }
    return new Contradiction(`Cannot merge RangeContent with ${other.constructor.name}`);
  }
  
  isContradiction(): boolean {
    return false;
  }
}