/**
 * Cell - Semi-lattice gadget
 * 
 * Cells implement lattice join operations.
 * They can accept any number of inputs (many writers).
 * The operation must be Associative, Commutative, and Idempotent (ACI).
 * 
 * Uses WeakRefs for connections to prevent memory leaks.
 */

import { Gadget } from './gadget'
import { Connection, LatticeValue, nil } from './types'
import type { GadgetBase } from './gadget-base'

export abstract class Cell extends Gadget {
  // Multiple inputs allowed (many-to-one)
  inputs: Set<Connection> = new Set()
  
  // Boundary marker - indicates this cell is part of a module's public interface
  boundary: boolean = false
  
  // The lattice join operation - must be ACI
  abstract latticeOp(...values: LatticeValue[]): LatticeValue
  
  /**
   * Accept information from upstream
   * Cells join all inputs via latticeOp
   */
  accept(value: LatticeValue, source: GadgetBase, inputName?: string): void {
    // Join the incoming value with current output
    const current = this.outputs.get('default')
    const result = current ? this.latticeOp(current, value) : value
    
    // Set the result (will auto-emit if changed)
    this.setOutput('default', result)
  }
  
  // Mark this cell as a boundary (monotonic - can't be undone)
  makeBoundary(): void {
    this.boundary = true
  }
  
  // Check if this is a boundary cell
  isBoundary(): boolean {
    return this.boundary
  }
  
  // Connect from another gadget (creates WeakRef)
  connectFrom(source: GadgetBase, outputName: string = "default"): void {
    this.inputs.add({
      source: new WeakRef(source),
      outputName
    })
    
    // Register for downstream emissions (source will send to us)
    source.addDownstream(this)
    
    // Register as upstream (we receive from source)
    this.addUpstream(source, outputName)
    
    // Pull initial value - source should eagerly send its current value
    this.accept(source.getOutput(outputName), source)
  }
  
  // Chainable version that returns this
  from(...sources: GadgetBase[]): this {
    for (const source of sources) {
      this.connectFrom(source)
    }
    return this
  }
  
  // Disconnect from a source
  disconnectFrom(source: GadgetBase, outputName: string = "default"): void {
    // Find and remove the connection from inputs
    for (const conn of this.inputs) {
      const src = conn.source.deref()
      if (src === source && conn.outputName === outputName) {
        this.inputs.delete(conn)
        break
      }
    }
    
    // Remove from upstream tracking
    this.removeUpstream(source)
    
    // Remove from source's downstream
    source.removeDownstream(this)
  }
  
  // Private method to compute with all inputs
  private computeWithInputs(): void {
    // Collect values from all live connections
    const values: LatticeValue[] = []
    const deadConnections: Connection[] = []
    
    for (const conn of this.inputs) {
      const source = conn.source.deref()
      if (source) {
        // Source still exists
        values.push(source.getOutput(conn.outputName))
      } else {
        // Source was garbage collected
        deadConnections.push(conn)
      }
    }
    
    // Clean up dead connections
    for (const conn of deadConnections) {
      this.inputs.delete(conn)
    }
    
    // Apply lattice operation
    let result: LatticeValue
    if (values.length === 0) {
      result = nil()
    } else if (values.length === 1) {
      result = values[0]
    } else {
      result = this.latticeOp(...values)
    }
    
    // Set output (will auto-emit if changed)
    this.setOutput("default", result)
  }
  
  // Legacy compute for compatibility
  compute(): void {
    this.computeWithInputs()
  }
  
  // Get all live sources (for debugging)
  getLiveSources(): GadgetBase[] {
    const sources: GadgetBase[] = []
    for (const conn of this.inputs) {
      const source = conn.source.deref()
      if (source) sources.push(source)
    }
    return sources
  }
  
  // Serialize cell to JSON
  serialize(): any {
    const base = super.serialize()
    
    // Add cell-specific data
    base.type = 'cell'
    base.boundary = this.boundary
    
    // Serialize connections (as IDs since we can't serialize WeakRefs)
    base.inputs = []
    for (const conn of this.inputs) {
      const source = conn.source.deref()
      if (source) {
        base.inputs.push({
          sourceId: source.id,
          outputName: conn.outputName
        })
      }
    }
    
    return base
  }
}

/**
 * TypedCell - Base class for cells with known input/output types
 * 
 * Provides type-safe setValue/getValue methods for cells that work
 * with specific types (e.g., MaxCell works with numbers).
 */
export abstract class TypedCell<T> extends Cell {
  /**
   * Type-safe setter for the cell's value
   */
  setValue(value: T): void {
    const latticeValue = this.wrap(value)
    this.accept(latticeValue, this)
  }
  
  /**
   * Type-safe getter for the cell's value
   */
  getValue(): T | null {
    const output = this.getOutput()
    if (!output) return null
    
    // For LatticeValue instances, extract the value
    if (output && typeof output === 'object' && 'value' in output) {
      return output.value as T
    }
    return output as T
  }
  
  /**
   * Subclasses define how to wrap their type into a LatticeValue
   */
  abstract wrap(value: T): LatticeValue
}