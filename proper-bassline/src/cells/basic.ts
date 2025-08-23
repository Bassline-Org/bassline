/**
 * Basic Cells - Core semi-lattice operations
 * 
 * These are all ACI (Associative, Commutative, Idempotent) operations.
 * They can handle any number of inputs from multiple writers.
 */

import { Cell } from '../cell'
import { LatticeValue, num, bool, set, nil, getValue, isNumber, isBool, isSet } from '../types'

// Max lattice for numbers (idempotent: max(a,a) = a)
export class MaxCell extends Cell {
  latticeOp(...values: LatticeValue[]): LatticeValue {
    const numbers = values
      .filter(isNumber)
      .map(v => v.value)  // TypeScript knows it's a number!
    
    if (numbers.length === 0) return nil()
    return num(Math.max(...numbers))
  }
}

// Min lattice for numbers (idempotent: min(a,a) = a)
export class MinCell extends Cell {
  latticeOp(...values: LatticeValue[]): LatticeValue {
    const numbers = values
      .filter(isNumber)
      .map(v => v.value)
    
    if (numbers.length === 0) return nil()
    return num(Math.min(...numbers))
  }
}

// OR lattice for booleans (idempotent: a ∨ a = a)
export class OrCell extends Cell {
  latticeOp(...values: LatticeValue[]): LatticeValue {
    const bools = values
      .filter(isBool)
      .map(v => v.value)
    
    if (bools.length === 0) return nil()
    return bool(bools.some(b => b))
  }
}

// AND lattice for booleans (idempotent: a ∧ a = a)
export class AndCell extends Cell {
  latticeOp(...values: LatticeValue[]): LatticeValue {
    const bools = values
      .filter(isBool)
      .map(v => v.value)
    
    if (bools.length === 0) return nil()
    return bool(bools.every(b => b))
  }
}

// Union lattice for sets (idempotent: A ∪ A = A)
export class UnionCell extends Cell {
  latticeOp(...values: LatticeValue[]): LatticeValue {
    const sets = values
      .filter(isSet)
      .map(v => v.value)
    
    if (sets.length === 0) return nil()
    
    const result = new Set<LatticeValue>()
    for (const s of sets) {
      for (const item of s) {
        result.add(item)
      }
    }
    return set(result)
  }
}

// Latest value cell - keeps the "most recent" value
// This is a pragmatic cell for handling updates
export class LatestCell extends Cell {
  private sequence = 0
  private valueMap = new Map<LatticeValue, number>()
  
  latticeOp(...values: LatticeValue[]): LatticeValue {
    // Track sequence for each value
    for (const v of values) {
      if (!this.valueMap.has(v)) {
        this.valueMap.set(v, this.sequence++)
      }
    }
    
    // Return the one with highest sequence
    let latest = values[0]
    let maxSeq = this.valueMap.get(latest) ?? 0
    
    for (const v of values) {
      const seq = this.valueMap.get(v) ?? 0
      if (seq > maxSeq) {
        maxSeq = seq
        latest = v
      }
    }
    
    return latest ?? nil()
  }
}