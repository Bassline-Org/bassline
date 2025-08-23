/**
 * Gadget - Base class for all computational units
 * 
 * Implements the core propagation protocol:
 * - accept: receive information from upstream
 * - emit: send information downstream
 */

import { LatticeValue, nil } from './types'

// Connection info for downstream tracking
export interface DownstreamConnection {
  gadget: WeakRef<Gadget>
  inputName?: string  // For Functions that have named inputs
}

/**
 * Base class for all gadgets (Cells, Functions, Networks)
 * Provides the fundamental propagation protocol
 */
export abstract class Gadget {
  id: string
  outputs: Map<string, LatticeValue> = new Map()
  downstream: Set<DownstreamConnection> = new Set()
  
  constructor(id: string) {
    this.id = id
  }
  
  /**
   * Accept information from upstream
   * @param value The value being sent
   * @param source The gadget sending the value
   * @param inputName Optional name for Functions with named inputs
   */
  abstract accept(value: LatticeValue, source: Gadget, inputName?: string): void
  
  /**
   * Emit current output to all downstream gadgets
   * @param outputName The output to emit (default: "default")
   */
  emit(outputName: string = "default"): void {
    const value = this.getOutput(outputName)
    
    // Clean up dead references while emitting
    const deadConnections: DownstreamConnection[] = []
    
    for (const conn of this.downstream) {
      const target = conn.gadget.deref()
      if (target) {
        // Target still exists, send the value
        target.accept(value, this, conn.inputName)
      } else {
        // Target was garbage collected
        deadConnections.push(conn)
      }
    }
    
    // Remove dead connections
    for (const conn of deadConnections) {
      this.downstream.delete(conn)
    }
  }
  
  /**
   * Register a downstream gadget to receive emissions
   * @param target The gadget to receive emissions
   * @param inputName Optional input name for Functions
   */
  addDownstream(target: Gadget, inputName?: string): void {
    this.downstream.add({
      gadget: new WeakRef(target),
      inputName
    })
  }
  
  /**
   * Remove a downstream connection
   */
  removeDownstream(target: Gadget): void {
    // Find and remove the connection
    for (const conn of this.downstream) {
      const gadget = conn.gadget.deref()
      if (gadget === target) {
        this.downstream.delete(conn)
        break
      }
    }
  }
  
  /**
   * Get output value
   * @param name Output name (default: "default")
   */
  getOutput(name: string = "default"): LatticeValue {
    return this.outputs.get(name) ?? nil()
  }
  
  /**
   * Set output value
   * @param name Output name
   * @param value The value to set
   * @param autoEmit Whether to automatically emit after setting (default: true)
   */
  protected setOutput(name: string, value: LatticeValue, autoEmit: boolean = true): void {
    // Just set the value and emit - let downstream decide if they care
    this.outputs.set(name, value)
    
    // Auto-emit
    if (autoEmit) {
      this.emit(name)
    }
  }
  
  /**
   * Legacy compute method for compatibility
   * New code should use accept/emit protocol
   */
  compute(): void {
    // Default: no-op
    // Subclasses can override for compatibility
  }
}