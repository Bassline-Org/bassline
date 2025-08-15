/**
 * Pico-Bassline Type Definitions
 * Core types for the ultra-minimal propagation runtime
 */

// Core value type - contacts can hold any value
export type Value = unknown

// Properties are open-ended records
export type Properties = Record<string, unknown>

// Access control types
export type AccessLevel = 'both' | 'read' | 'write' | 'none'

export interface ContactAccess {
  boundary: boolean
  internal: AccessLevel
  external: AccessLevel
}

// Wire modes for smart wiring
export enum WireMode {
  AUTO,          // Smart detection based on permissions
  FORWARD_ONLY,  // Single direction only
  BIDIRECTIONAL, // Both directions if allowed
  CONSTRAINT     // For constraint propagation (always bidirectional)
}

// Compute function signature for primitives
export type ComputeFunction = (
  inputs: Record<string, Value>,
  props: Properties
) => Value

// Primitive group properties
export interface PrimitiveProps extends Properties {
  primitive: true
  name: string
  compute: ComputeFunction
  needsHistory?: boolean
  gatherMode?: 'object' | 'array'
}

// Regular group properties
export interface GroupProps extends Properties {
  primitive?: false
  [key: string]: unknown  // Open for user-defined properties
}

// Union type for any properties
export type AnyProps = PrimitiveProps | GroupProps | Properties

// Helper type guards
export function isPrimitiveProps(props: Properties): props is PrimitiveProps {
  return props.primitive === true
}

export function isGroupProps(props: Properties): props is GroupProps {
  return !props.primitive
}

// Structure metadata
export interface ContactInfo {
  id: string
  sources: string[]
  targets: string[]
}

export interface StructureData {
  contacts: ContactInfo[]
  groups: string[]
}

// Dynamics metadata (propagation events)
export interface PropagationEvent {
  type: 'propagate'
  from: string
  to: string
  fromGroup?: string
  toGroup?: string
  value: Value
  timestamp?: number
}

export type DynamicsData = PropagationEvent[]

// Error classes
export class InvalidWiringError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidWiringError'
  }
}