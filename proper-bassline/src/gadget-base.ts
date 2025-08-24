/**
 * GadgetBase - Core interface for all gadgets in the system
 * 
 * This defines the minimal contract that all gadgets must fulfill.
 * Gadgets are the fundamental units of computation and UI in the system.
 */

import type { LatticeValue } from './types'
import type { Gadget } from './gadget'

/**
 * Connection info for tracking gadget connections
 * Uses WeakRef to prevent memory leaks
 */
export interface Connection {
  gadget: WeakRef<GadgetBase>
  outputName?: string  // For named outputs
  inputName?: string   // For named inputs (e.g., Functions)
}

export interface GadgetBase {
  /**
   * Unique identifier for this gadget
   */
  id: string
  
  /**
   * Type name for reflection/querying
   */
  type: string
  
  /**
   * Parent gadget if this is contained in another
   */
  parent?: GadgetBase
  
  // ============================================================================
  // Propagation Protocol
  // ============================================================================
  
  /**
   * Accept a value from another gadget
   * This is how gadgets receive information
   */
  accept(value: LatticeValue, from: GadgetBase): void
  
  /**
   * Emit a value to downstream gadgets
   * This is how gadgets send information
   */
  emit(value: LatticeValue): void
  
  /**
   * Gadgets that send values to this gadget
   */
  upstream: Set<Connection>
  
  /**
   * Gadgets that receive values from this gadget
   */
  downstream: Set<Connection>
  
  /**
   * Get the current output value
   */
  getOutput(): LatticeValue | null
  
  // ============================================================================
  // Connection Management
  // ============================================================================
  
  /**
   * Add a downstream gadget
   */
  addDownstream(gadget: GadgetBase): void
  
  /**
   * Remove a downstream gadget
   */
  removeDownstream(gadget: GadgetBase): void
  
  /**
   * Add an upstream gadget
   */
  addUpstream(gadget: GadgetBase): void
  
  /**
   * Remove an upstream gadget
   */
  removeUpstream(gadget: GadgetBase): void
  
  // ============================================================================
  // Serialization
  // ============================================================================
  
  /**
   * Serialize this gadget to a plain object
   */
  serialize(): any
  
  /**
   * Deserialize from a plain object
   */
  deserialize(data: any): void
  
  // ============================================================================
  // Metadata (for querying and reflection)
  // ============================================================================
  
  /**
   * Get metadata about this gadget
   * Used by query system and inspectors
   */
  getMetadata(): Record<string, any>
  
  /**
   * Set metadata on this gadget
   */
  setMetadata(key: string, value: any): void
}

/**
 * Type guard to check if something is a GadgetBase
 */
export function isGadgetBase(obj: any): obj is GadgetBase {
  return obj && 
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.accept === 'function' &&
    typeof obj.emit === 'function' &&
    obj.upstream instanceof Set &&
    obj.downstream instanceof Set
}

/**
 * Container interface for gadgets that can contain other gadgets
 * Only containers are queryable in our system
 */
export interface Container extends GadgetBase {
  /**
   * Child gadgets contained in this container
   */
  children: Set<GadgetBase>
  
  /**
   * Add a child gadget
   */
  add(...gadgets: GadgetBase[]): this
  
  /**
   * Remove a child gadget
   */
  remove(gadget: GadgetBase): boolean
  
  /**
   * Query this container for gadgets matching a selector
   * This is what makes containers special - they can be searched
   */
  query(selector: string): Set<GadgetBase>
  
  /**
   * Get a gadget by its path (e.g., "parent/child/grandchild")
   */
  getByPath(path: string): GadgetBase | null
}

/**
 * Type guard for containers
 */
export function isContainer(obj: any): obj is Container {
  return isGadgetBase(obj) && 
    obj.children instanceof Set &&
    typeof obj.add === 'function' &&
    typeof obj.query === 'function'
}