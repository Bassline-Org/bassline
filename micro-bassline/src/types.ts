/**
 * Micro-Bassline: The Unified Model
 * 
 * Core types for the simplified, unified propagation network model.
 */

// ============================================================================
// Core Structure Types
// ============================================================================

export type ContactId = string
export type WireId = string
export type GroupId = string
export type Properties = Record<string, any>

/**
 * Blend modes determine how contacts handle incoming values.
 * - 'merge': Merge values using mergeable type semantics (default)
 * - 'last': Keep only the most recent value (stream semantics)
 */
export type BlendMode = 'merge' | 'last'

/**
 * A contact holds information and propagates changes.
 */
export interface ReifiedContact {
  content?: any
  groupId?: GroupId
  properties?: Properties & {
    blendMode?: BlendMode
  }
}

/**
 * A wire connects two contacts for propagation.
 */
export interface ReifiedWire {
  fromId: ContactId
  toId: ContactId
  properties?: Properties & {
    bidirectional?: boolean  // Default true for constraint propagation
  }
}

/**
 * A group provides hierarchical organization and can be a gadget.
 */
export interface ReifiedGroup {
  parentId?: GroupId  // Parent group ID, undefined for root groups
  contactIds: Set<ContactId>
  boundaryContactIds: Set<ContactId>
  primitiveType?: string  // If present, this is a primitive gadget
  defaultProperties?: Properties  // Default values for the properties contact
  properties?: Properties & {
    'allow-mutation'?: boolean  // Controls whether BasslineGadget accepts actions
  }
}

/**
 * The complete reified network structure.
 */
export interface Bassline {
  contacts: Map<ContactId, ReifiedContact>
  wires: Map<WireId, ReifiedWire>
  groups: Map<GroupId, ReifiedGroup>
  properties?: Properties
}

// ============================================================================
// Propagation Event Types (Reified Propagation)
// ============================================================================

/**
 * Events that describe propagation activity as data.
 * These flow through stream contacts (blendMode: 'last').
 */
export type PropagationEvent = 
  | ['valueChanged', ContactId, any, any]  // [type, contactId, oldValue, newValue]
  | ['propagating', ContactId, ContactId, any]  // [type, fromId, toId, value]
  | ['gadgetActivated', GroupId, Map<string, any>, Map<string, any>]  // [type, gadgetId, inputs, outputs]
  | ['contradiction', ContactId, any, any]  // [type, contactId, currentValue, incomingValue]
  | ['converged']  // Network has reached stability
  | ['primitive-requested', GroupId, string, Map<string, any>]  // [type, groupId, primitiveType, inputs]
  | ['primitive-executed', GroupId, string, Map<string, any>]  // [type, groupId, primitiveType, outputs]
  | ['primitive-failed', GroupId, string, string]  // [type, groupId, primitiveType, error]

// ============================================================================
// Action Types (Reified Mutations)
// ============================================================================

/**
 * Actions describe mutations to the network structure or values.
 * These flow as data through the network.
 */
export type Action = 
  | ['setValue', ContactId, any]
  | ['createContact', ContactId, GroupId?, Properties?]
  | ['deleteContact', ContactId]
  | ['createWire', WireId, ContactId, ContactId, Properties?]
  | ['deleteWire', WireId]
  | ['createGroup', GroupId, GroupId?, Properties?]  // [type, id, parentId?, properties?]
  | ['deleteGroup', GroupId]
  | ['updateProperties', ContactId | WireId | GroupId, Properties]

/**
 * A collection of actions to be applied together.
 */
export interface ActionSet {
  actions: Action[]
  timestamp?: number
}

// ============================================================================
// Primitive Gadget Types
// ============================================================================

/**
 * A primitive gadget provides computation.
 * These are code, not data - referenced by type string.
 */
export interface PrimitiveGadget {
  type: string
  inputs: string[]  // Names of input boundary contacts
  outputs: string[]  // Names of output boundary contacts
  activation: (inputs: Map<string, any>) => boolean
  execute: (inputs: Map<string, any>) => Map<string, any>  // Synchronous execution
}

// ============================================================================
// Runtime Types
// ============================================================================

/**
 * Runtime context for execution.
 * This is NOT reified - it's the execution state.
 */
export interface RuntimeContext {
  bassline: Bassline
  values: Map<ContactId, any>  // Current contact values
  eventStream?: PropagationEvent[]  // Events being collected
  primitives: Map<string, PrimitiveGadget>  // Available primitive gadgets
}

// ============================================================================
// Mergeable Types (for constraint propagation)
// ============================================================================

/**
 * Growing types accumulate values (union semantics).
 */
export namespace Grow {
  export class GrowSet<T> extends Set<T> implements Mergeable<GrowSet<T>> {
    merge(other: GrowSet<T>): GrowSet<T> {
      return new GrowSet([...this, ...other])
    }
  }
  
  export class GrowArray<T> extends Array<T> implements Mergeable<GrowArray<T>> {
    merge(other: GrowArray<T>): GrowArray<T> {
      return new GrowArray(...this, ...other)
    }
  }
  
  export class GrowMap<K, V> extends Map<K, V> implements Mergeable<GrowMap<K, V>> {
    merge(other: GrowMap<K, V>): GrowMap<K, V> {
      const result = new GrowMap(this)
      for (const [k, v] of other) {
        result.set(k, v)
      }
      return result
    }
  }
}

/**
 * Shrinking types constrain values (intersection semantics).
 */
export namespace Shrink {
  export class ShrinkSet<T> extends Set<T> implements Mergeable<ShrinkSet<T>> {
    merge(other: ShrinkSet<T>): ShrinkSet<T> {
      return new ShrinkSet([...this].filter(x => other.has(x)))
    }
  }
  
  export class ShrinkArray<T> extends Array<T> implements Mergeable<ShrinkArray<T>> {
    merge(other: ShrinkArray<T>): ShrinkArray<T> {
      return new ShrinkArray(...this.filter(x => other.includes(x)))
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Represents a contradiction in the constraint system.
 */
export class Contradiction extends Error {
  constructor(
    public readonly current: any,
    public readonly incoming: any,
    message?: string
  ) {
    super(message || `Contradiction: Cannot merge ${JSON.stringify(current)} with ${JSON.stringify(incoming)}`)
    this.name = 'Contradiction'
  }
}

/**
 * Interface for mergeable types.
 */
export interface Mergeable<T> {
  merge(other: T): T
}

/**
 * Check if a value is a mergeable type.
 */
export function isMergeable(value: unknown): value is Mergeable<any> {
  return (
    value != null &&
    typeof value === 'object' &&
    'merge' in value &&
    typeof (value as any).merge === 'function'
  )
}

/**
 * Merge two values according to blend mode.
 * Throws a Contradiction if values cannot be merged.
 */
export function mergeValues(current: any, incoming: any, blendMode: BlendMode = 'merge'): any {
  switch (blendMode) {
    case 'last':
      // Stream semantics - always use latest value
      return incoming
    
    case 'merge':
      // Handle null/undefined - return the other value
      if (current === undefined || current === null) return incoming
      if (incoming === undefined || incoming === null) return current
      
      // If values are equal, return either
      if (valuesEqual(current, incoming)) return current
      
      // Both are mergeable types
      if (isMergeable(current) && isMergeable(incoming)) {
        // Check they're the same type of mergeable
        if (current.constructor === incoming.constructor) {
          return current.merge(incoming)
        }
        throw new Contradiction(current, incoming, 'Cannot merge different mergeable types')
      }
      
      // One is mergeable, one is scalar - special handling for shrinking types
      if (isMergeable(current) && !isMergeable(incoming)) {
        // For shrinking sets/arrays, if scalar is contained, return scalar
        if (current instanceof Shrink.ShrinkSet) {
          if (current.has(incoming)) {
            return incoming  // Scalar is in set, return it
          }
          throw new Contradiction(current, incoming, 'Scalar not contained in ShrinkSet')
        }
        if (current instanceof Shrink.ShrinkArray) {
          if (current.includes(incoming)) {
            return incoming  // Scalar is in array, return it
          }
          throw new Contradiction(current, incoming, 'Scalar not contained in ShrinkArray')
        }
        // For growing types, can't merge with scalar
        throw new Contradiction(current, incoming, 'Cannot merge collection with scalar')
      }
      
      if (!isMergeable(current) && isMergeable(incoming)) {
        // For shrinking sets/arrays, if scalar is contained, return scalar
        if (incoming instanceof Shrink.ShrinkSet) {
          if (incoming.has(current)) {
            return current  // Scalar is in set, return it
          }
          throw new Contradiction(current, incoming, 'Scalar not contained in ShrinkSet')
        }
        if (incoming instanceof Shrink.ShrinkArray) {
          if (incoming.includes(current)) {
            return current  // Scalar is in array, return it
          }
          throw new Contradiction(current, incoming, 'Scalar not contained in ShrinkArray')
        }
        // For growing types, can't merge with scalar
        throw new Contradiction(current, incoming, 'Cannot merge scalar with collection')
      }
      
      // Plain JavaScript collections - treat as growing (legacy support)
      if (current instanceof Set && incoming instanceof Set) {
        return new Set([...current, ...incoming])
      }
      
      if (current instanceof Map && incoming instanceof Map) {
        const result = new Map(current)
        for (const [key, value] of incoming) {
          if (result.has(key)) {
            const merged = mergeValues(result.get(key), value, 'merge')
            result.set(key, merged)
          } else {
            result.set(key, value)
          }
        }
        return result
      }
      
      if (Array.isArray(current) && Array.isArray(incoming)) {
        return [...current, ...incoming]
      }
      
      // Plain objects - merge with last-write-wins for scalar properties
      if (typeof current === 'object' && typeof incoming === 'object' &&
          current.constructor === Object && incoming.constructor === Object) {
        const result: any = { ...current }
        for (const key in incoming) {
          if (key in result) {
            // For nested objects, merge recursively
            if (typeof result[key] === 'object' && typeof incoming[key] === 'object' &&
                result[key] !== null && incoming[key] !== null &&
                result[key].constructor === Object && incoming[key].constructor === Object) {
              result[key] = mergeValues(result[key], incoming[key], 'merge')
            } else {
              // For scalar values, last-write-wins
              result[key] = incoming[key]
            }
          } else {
            result[key] = incoming[key]
          }
        }
        return result
      }
      
      // Different scalar values - contradiction
      throw new Contradiction(current, incoming, 'Cannot merge different scalar values')
    
    default:
      throw new Error(`Unknown blend mode: ${blendMode}`)
  }
}

/**
 * Check if two values are equal (for change detection).
 */
export function valuesEqual(a: any, b: any): boolean {
  // Handle primitives
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false
  
  // Fast path: if objects have structureHash, compare those
  if (a?.structureHash && b?.structureHash) {
    return a.structureHash === b.structureHash
  }
  
  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!valuesEqual(a[i], b[i])) return false
    }
    return true
  }
  
  // Handle Maps
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false
    for (const [key, value] of a) {
      if (!b.has(key) || !valuesEqual(value, b.get(key))) return false
    }
    return true
  }
  
  // Handle Sets
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false
    for (const value of a) {
      if (!b.has(value)) return false
    }
    return true
  }
  
  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false
    for (const key of keysA) {
      if (!valuesEqual(a[key], b[key])) return false
    }
    return true
  }
  
  return false
}