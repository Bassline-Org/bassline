/**
 * Gadget - Base class for all computational units
 * 
 * Implements the core propagation protocol:
 * - accept: receive information from upstream
 * - emit: send information downstream
 * 
 * Now also implements GadgetBase interface for the new metamodel
 */

import type { SerializedLatticeValue } from './lattice-types'
import { LatticeValue, nil } from './lattice-types'
import type { GadgetBase, Connection } from './gadget-base'
import { BasslineEngine } from './engine'

/**
 * Base class for all gadgets (Cells, Functions, Networks)
 * Provides the fundamental propagation protocol
 * Implements GadgetBase for the unified metamodel
 */
export abstract class Gadget implements GadgetBase {
  id: string
  type: string
  outputs: Map<string, LatticeValue> = new Map()
  downstream: Set<Connection> = new Set()
  upstream: Set<Connection> = new Set()
  engine?: WeakRef<BasslineEngine>
  parent?: GadgetBase
  // A hook for when a value is emitted, useful for integrating with other systems such as the UI without manually connecting taps to each gadget
  onEmit: (outputName: string) => void

  // Metadata for querying and reflection
  private metadata: Record<string, any> = {}
  
  constructor(id: string, onEmit?: (outputName: string) => void) {
    this.id = id
    this.type = this.constructor.name
    this.onEmit = onEmit ?? (() => {})
  }
  
  /**
   * Accept information from upstream
   * @param value The value being sent
   * @param source The gadget sending the value
   * @param inputName Optional name for Functions with named inputs
   */
  abstract accept(value: LatticeValue, source: Gadget, inputName?: string): void
  
  /**
   * Report accept to engine if available
   */
  protected reportAccept(value: LatticeValue, source: Gadget, inputName?: string): void {
    const engine = this.engine?.deref()
    if (engine && 'trackAccept' in engine) {
      (engine as any).trackAccept(this.id, source.id, inputName, value)
    }
  }
  
  /**
   * Emit current output to all downstream gadgets
   * @param outputName The output to emit (default: "default")
   */
  emit(outputName: string = "default"): void {
    const value = this.getOutput(outputName)
    this.onEmit(outputName)
    
    // Report to engine if available
    const engine = this.engine?.deref()
    if (engine && 'trackEmit' in engine) {
      (engine as any).trackEmit(this.id, outputName, value)
    }
    
    // Clean up dead references while emitting
    const deadConnections: Connection[] = []
    
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
  addDownstream(target: GadgetBase, inputName?: string): void {
    this.downstream.add({
      gadget: new WeakRef(target),
      inputName
    })
    
    // Report to engine if available
    const engine = this.engine?.deref()
    if (engine && 'trackConnect' in engine) {
      (engine as any).trackConnect(this.id, target.id, undefined, inputName)
    }
  }
  
  /**
   * Remove a downstream connection
   */
  removeDownstream(target: GadgetBase): void {
    // Find and remove the connection
    for (const conn of this.downstream) {
      const gadget = conn.gadget.deref()
      if (gadget === target) {
        this.downstream.delete(conn)
        
        // Report to engine if available
        const engine = this.engine?.deref()
        if (engine && 'trackDisconnect' in engine) {
          (engine as any).trackDisconnect(this.id, target.id)
        }
        break
      }
    }
  }
  
  /**
   * Add an upstream gadget
   * @param source The gadget that sends values to this gadget
   * @param outputName Optional output name for named outputs
   */
  addUpstream(source: GadgetBase, outputName?: string): void {
    this.upstream.add({
      gadget: new WeakRef(source),
      outputName
    })
  }
  
  /**
   * Remove an upstream gadget
   */
  removeUpstream(source: GadgetBase): void {
    // Find and remove the connection
    for (const conn of this.upstream) {
      const gadget = conn.gadget.deref()
      if (gadget === source) {
        this.upstream.delete(conn)
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
  
  /**
   * Get metadata (for GadgetBase interface)
   */
  getMetadata(): Record<string, any> {
    return { ...this.metadata }
  }
  
  /**
   * Set metadata (for GadgetBase interface)
   */
  setMetadata(key: string, value: any): void {
    this.metadata[key] = value
  }
  
  /**
   * Serialize this gadget to a JSON-compatible format
   * Subclasses should override to include their specific data
   */
  serialize(): any {
    const outputs: Record<string, SerializedLatticeValue> = {}
    for (const [name, value] of this.outputs) {
      outputs[name] = value.serialize()
    }
    
    return {
      type: 'gadget',
      id: this.id,
      className: this.constructor.name,
      outputs,
      metadata: this.metadata
    }
  }
  
  /**
   * Deserialize from data (for GadgetBase interface)
   */
  deserialize(data: any): void {
    // Subclasses should override to restore their state
    if (data.metadata) {
      this.metadata = data.metadata
    }
  }
  
  /**
   * Static deserialize a gadget from JSON
   * Subclasses should override to handle their specific data
   * The registry parameter allows access to other gadget types
   */
  static deserialize(data: any, registry?: any): Gadget {
    throw new Error(`Deserialize not implemented for ${data.className}`)
  }
}