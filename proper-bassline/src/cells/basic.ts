/**
 * Basic Cells - Core semi-lattice operations
 * 
 * These are all ACI (Associative, Commutative, Idempotent) operations.
 * They can handle any number of inputs from multiple writers.
 */

import { Cell } from '../cell'
import { LatticeValue, Connection, num, bool, array, set, nil, getValue, isNumber, isBool, isArray, isSet, isDict, dict, ordinalValue, getOrdinal, deserialize as deserializeLattice} from '../types'

// Max lattice for numbers (idempotent: max(a,a) = a)
export class MaxCell extends Cell {
  latticeOp(...values: LatticeValue[]): LatticeValue {
    const numbers = values
      .filter(isNumber)
      .map(v => v.value)  // TypeScript knows it's a number!
    
    if (numbers.length === 0) return nil()
    return num(Math.max(...numbers))
  }
  
  static deserialize(data: any, registry: any): MaxCell {
    return registry.deserializeCell(data, MaxCell)
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
    if (current && isDict(current) && current.value.has("ordinal") && current.value.has("value")) {
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
      .filter(d => d.value.has("ordinal") && d.value.has("value"))
    
    if (dicts.length === 0) return nil()
    
    // Find the dict with the highest ordinal - this is "last write wins"
    let maxOrdinal = -Infinity
    let maxDict = dicts[0]
    
    for (const d of dicts) {
      const ordinal = d.value.get("ordinal")
      if (ordinal && isNumber(ordinal) && ordinal.value > maxOrdinal) {
        maxOrdinal = ordinal.value
        maxDict = d
      }
    }
    
    // Return the entire dict (preserves ordinal for future merges)
    const result = new Map<string, LatticeValue>()
    result.set("ordinal", maxDict.value.get("ordinal")!)
    result.set("value", maxDict.value.get("value")!)
    return dict(result)
  }
  
  static deserialize(data: any, registry: any): OrdinalCell {
    const cell = registry.deserializeCell(data, OrdinalCell)
    // Restore userOrdinal if present
    if (data.userOrdinal !== undefined) {
      cell.userOrdinal = data.userOrdinal
    }
    return cell
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
  
  static deserialize(data: any, registry: any): MinCell {
    return registry.deserializeCell(data, MinCell)
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

// SetCell - Grow-only set with automatic deduplication
// Uses union operation as the lattice operation
export class SetCell extends Cell {
  latticeOp(...values: LatticeValue[]): LatticeValue {
    const sets = values.filter(isSet)
    
    if (sets.length === 0) return set(new Set())
    
    // Union all sets together
    const result = new Set<LatticeValue>()
    for (const s of sets) {
      for (const item of s.value) {
        result.add(item)
      }
    }
    
    return set(result)
  }
  
  // Convenience method to add items to the set
  add(item: LatticeValue): void {
    const current = this.getOutput() || set(new Set())
    if (!isSet(current)) return
    
    const newSet = new Set(current.value)
    newSet.add(item)
    this.accept(set(newSet), this)
  }
  
  // Convenience method to check if set contains item
  has(item: LatticeValue): boolean {
    const current = this.getOutput()
    if (!current || !isSet(current)) return false
    
    // Check for deep equality
    for (const existing of current.value) {
      if (JSON.stringify(existing) === JSON.stringify(item)) {
        return true
      }
    }
    return false
  }
  
  // Get size of the set
  get size(): number {
    const current = this.getOutput()
    if (!current || !isSet(current)) return 0
    return current.value.size
  }
  
  static deserialize(data: any, registry: any): SetCell {
    return registry.deserializeCell(data, SetCell)
  }
}