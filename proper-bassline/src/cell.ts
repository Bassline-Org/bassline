/**
 * Cell - Semi-lattice gadget
 * 
 * Cells implement lattice join operations.
 * They can accept any number of inputs (many writers).
 * The operation must be Associative, Commutative, and Idempotent (ACI).
 * 
 * Uses WeakRefs for connections to prevent memory leaks.
 */

import { Gadget, Connection, LatticeValue, nil } from './types'

export abstract class Cell extends Gadget {
  // Multiple inputs allowed (many-to-one)
  inputs: Set<Connection> = new Set()
  
  // Boundary marker - indicates this cell is part of a module's public interface
  boundary: boolean = false
  
  // The lattice join operation - must be ACI
  abstract latticeOp(...values: LatticeValue[]): LatticeValue
  
  // Mark this cell as a boundary (monotonic - can't be undone)
  makeBoundary(): void {
    this.boundary = true
  }
  
  // Check if this is a boundary cell
  isBoundary(): boolean {
    return this.boundary
  }
  
  // Connect from another gadget (creates WeakRef)
  connectFrom(source: Gadget, outputName: string = "default"): void {
    this.inputs.add({
      source: new WeakRef(source),
      outputName
    })
  }
  
  // Chainable version that returns this
  from(...sources: Gadget[]): this {
    for (const source of sources) {
      this.connectFrom(source)
    }
    return this
  }
  
  // Disconnect from a source
  disconnectFrom(source: Gadget, outputName: string = "default"): void {
    // Find and remove the connection
    for (const conn of this.inputs) {
      const src = conn.source.deref()
      if (src === source && conn.outputName === outputName) {
        this.inputs.delete(conn)
        break
      }
    }
  }
  
  // Compute by applying lattice join to all inputs
  compute(): void {
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
    if (values.length === 0) {
      this.setOutput("default", nil())
    } else if (values.length === 1) {
      this.setOutput("default", values[0])
    } else {
      this.setOutput("default", this.latticeOp(...values))
    }
  }
  
  // Get all live sources (for debugging)
  getLiveSources(): Gadget[] {
    const sources: Gadget[] = []
    for (const conn of this.inputs) {
      const source = conn.source.deref()
      if (source) sources.push(source)
    }
    return sources
  }
}