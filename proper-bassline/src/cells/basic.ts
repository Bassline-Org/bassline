/**
 * Basic Cells - Core semi-lattice operations
 * 
 * These are all ACI (Associative, Commutative, Idempotent) operations.
 * They can handle any number of inputs from multiple writers.
 */

import { Cell } from '../cell'
import { LatticeValue, Connection, num, bool, array, nil, getValue, isNumber, isBool, isArray, isDict, dict, ordinalValue, getOrdinal} from '../types'

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

// Ordinal Lattice for sequences of inputs, like user input etc  
export class OrdinalCell extends Cell {
  private userOrdinal = 0
  
  // Override setOutput to only emit when ordinal increases
  protected setOutput(name: string, value: LatticeValue, autoEmit: boolean = true): void {
    const current = this.outputs.get(name) || nil()
    const currentOrdinal = getOrdinal(current) || -1
    const newOrdinal = getOrdinal(value) || -1
    
    // Only update if ordinal increased (moved up in lattice)
    if (newOrdinal > currentOrdinal) {
      super.setOutput(name, value, autoEmit)
    }
  }
  
  /**
   * UI convenience method for user input with auto-incrementing ordinal
   * Wraps the value in an ordinal map and sends through accept
   */
  userInput(value: LatticeValue): void {
    // Get current ordinal and increment from there
    const current = this.outputs.get('default') || nil()
    const currentOrdinal = getOrdinal(current) || 0
    this.userOrdinal = Math.max(this.userOrdinal, currentOrdinal)
    
    const ordinalVal = ordinalValue(++this.userOrdinal, value)
    // Just use accept - it will handle the latticeOp
    this.accept(ordinalVal, this)
  }
  
  // Override compute to preserve current value when no inputs
  compute(): void {
    // Collect values from all live connections
    const values: LatticeValue[] = []
    const deadConnections: Connection[] = []
    
    for (const conn of this.inputs) {
      const source = conn.source.deref()
      if (source) {
        values.push(source.getOutput(conn.outputName))
      } else {
        deadConnections.push(conn)
      }
    }
    
    // Clean up dead connections
    for (const conn of deadConnections) {
      this.inputs.delete(conn)
    }
    
    // Include current value if it's an ordinal dict
    const current = this.outputs.get('default')
    if (current && isDict(current) && current.value.ordinal && current.value.value) {
      values.push(current)
    }
    
    // Apply lattice operation
    if (values.length === 0) {
      this.setOutput("default", nil())
    } else {
      // Always use latticeOp to handle merging
      this.setOutput("default", this.latticeOp(...values))
    }
  }
  
  latticeOp(...values: LatticeValue[]): LatticeValue {
    const dicts = values
      .filter(isDict)
      .filter(d => d.value.ordinal && d.value.value)
      .map(v => v.value);
    
    if (dicts.length === 0) return nil()
    
    // Find the dict with the highest ordinal - this is "last write wins"
    let maxOrdinal = -Infinity
    let maxDict = dicts[0]
    
    for (const d of dicts) {
      const ordinal = d.ordinal
      if (isNumber(ordinal) && ordinal.value > maxOrdinal) {
        maxOrdinal = ordinal.value
        maxDict = d
      }
    }
    
    // Return the entire dict (preserves ordinal for future merges)
    return dict({ 
      ordinal: maxDict.ordinal!, 
      value: maxDict.value!
    })
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

// Union lattice for arrays (treats arrays as sets - deduplicates)
export class UnionCell extends Cell {
  latticeOp(...values: LatticeValue[]): LatticeValue {
    const arrays = values
      .filter(isArray)
      .map(v => v.value)
    
    if (arrays.length === 0) return nil()
    
    // Use JSON.stringify for deep equality when deduplicating
    const seen = new Set<string>()
    const result: LatticeValue[] = []
    
    for (const arr of arrays) {
      for (const item of arr) {
        const key = JSON.stringify(item)
        if (!seen.has(key)) {
          seen.add(key)
          result.push(item)
        }
      }
    }
    return array(result)
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