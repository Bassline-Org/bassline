/**
 * Bassline Types
 * 
 * Basslines are manifests that describe propagation networks.
 * Everything in the system is fundamentally a bassline with different attributes.
 */

import type { Group, Contact, Wire, Topology } from '../types'

/**
 * Core bassline manifest structure
 */
export interface Bassline {
  // Identity
  name: string
  version?: string
  description?: string
  hash?: string  // Content-addressed identity
  
  // What to build
  build?: {
    topology?: Topology | (() => Topology)  // Network structure (can be lazy)
    gadget?: GadgetDefinition               // Single gadget
    gadgets?: GadgetDefinition[]            // Multiple gadgets
  }
  
  // Dependencies on other basslines
  dependencies?: {
    [name: string]: string | BasslineDependency
  }
  
  // Attributes (open-spec)
  attributes?: BasslineAttributes
  
  // Interface when used as gadget
  interface?: GadgetInterface
  
  // Connection information for distributed execution
  connections?: ConnectionConfig
  
  // Optional seed data for initialization
  seeds?: {
    [contactId: string]: unknown
  }
  
  // Metadata
  metadata?: {
    author?: string
    license?: string
    tags?: string[]
    created?: string
    modified?: string
  }
}

/**
 * Gadget definition within a bassline
 */
export interface GadgetDefinition {
  id: string
  type?: 'primitive' | 'normal' | 'dynamic' | 'reference'
  
  // For primitive gadgets
  variant?: string  // 'add', 'multiply', etc.
  
  // For reference gadgets
  from?: string     // Reference to dependency
  as?: string       // Local name
  
  // For inline gadgets
  bassline?: Bassline  // Nested bassline
  
  // Topology for this gadget
  topology?: Topology
  
  // Interface
  interface?: GadgetInterface
  
  // Gadget-specific attributes
  attributes?: BasslineAttributes
}

/**
 * Gadget interface definition
 */
export interface GadgetInterface {
  inputs?: string[]
  outputs?: string[]
  bidirectional?: string[]
  
  // Special contacts (prefixed with @)
  attributes?: string[]  // Attribute contacts
  schema?: string       // Schema input contact
}

/**
 * Bassline dependency specification
 */
export interface BasslineDependency {
  source: string       // URL, registry path, or local path
  version?: string     // Semantic version constraint
  integrity?: string   // Hash for verification
  
  // How to connect to this dependency
  connections?: {
    ourContact: string
    theirContact: string
    type?: 'bidirectional' | 'directed'
  }[]
}

/**
 * Connection configuration for distributed execution
 */
export interface ConnectionConfig {
  // Execution mode
  mode?: 'local' | 'remote' | 'distributed' | 'hybrid'
  
  // Where to find running instances
  endpoints?: string[]
  
  // WebRTC configuration
  signaling?: string[]
  iceServers?: RTCIceServer[]
  
  // Room configuration for P2P
  rooms?: {
    [groupId: string]: string  // Group ID to room code mapping
  }
  
  // Authentication
  auth?: {
    type: 'none' | 'token' | 'oauth' | 'custom'
    config?: unknown
  }
}

/**
 * Open-spec attribute system
 * Well-known attributes are namespaced, custom attributes use x- prefix
 */
export interface BasslineAttributes {
  // Core attributes (bassline.*)
  'bassline.pure'?: boolean              // No side effects
  'bassline.mutable'?: boolean           // Can topology change at runtime
  'bassline.singleton'?: boolean         // Only one instance globally
  'bassline.distributed'?: boolean       // Can run across multiple nodes
  'bassline.version'?: string           // Semantic version
  'bassline.hash'?: string              // Content hash for verification
  'bassline.experimental'?: boolean     // Mark as experimental/unstable
  
  // Dynamic behavior (bassline.dynamic.*)
  'bassline.dynamic-attributes'?: {
    enabled: boolean
    contact?: string                    // Boundary contact providing attributes
    mode?: 'replace' | 'merge' | 'override'
  }
  
  'bassline.dynamic-topology'?: {
    enabled: boolean
    schemaContact: string              // Contact providing topology/schema
    rebuildOn?: 'change' | 'explicit' | 'version'
  }
  
  // Attribute cycles configuration
  'bassline.attribute-cycles'?: {
    allowed: boolean
    contradictionMode?: 'last-wins' | 'merge' | 'reject'
    maxIterations?: number
  }
  
  // Permissions (permissions.*)
  'permissions.modify'?: 'none' | 'owner' | 'team' | 'anyone'
  'permissions.instantiate'?: 'none' | 'owner' | 'team' | 'anyone'
  'permissions.inspect'?: 'none' | 'owner' | 'team' | 'anyone'
  'permissions.execute'?: 'none' | 'owner' | 'team' | 'anyone'
  'permissions.fork'?: 'none' | 'owner' | 'team' | 'anyone'
  
  // Runtime hints (runtime.*)
  'runtime.lazy'?: boolean             // Lazy evaluation
  'runtime.cache'?: boolean | number   // Cache results (true or TTL in ms)
  'runtime.timeout'?: number           // Max execution time in ms
  'runtime.priority'?: 'high' | 'normal' | 'low'
  'runtime.parallel'?: boolean         // Can parallelize execution
  'runtime.memory-limit'?: number      // Max memory usage in bytes
  
  // Validation (validation.*)
  'validation.schema'?: string         // Contact providing schema validator
  'validation.upgrade'?: string        // Contact for upgrade validation
  'validation.input'?: string          // Input validation rules
  'validation.output'?: string         // Output validation rules
  
  // Trust and security (trust.*)
  'trust.level'?: 'untrusted' | 'sandbox' | 'verified' | 'trusted'
  'trust.signature'?: string           // Cryptographic signature
  'trust.author'?: string              // Author identity
  'trust.audit'?: string               // Audit trail reference
  
  // Performance hints (performance.*)
  'performance.latency'?: 'realtime' | 'fast' | 'normal' | 'slow'
  'performance.throughput'?: 'high' | 'medium' | 'low'
  'performance.gpu'?: boolean          // Requires GPU acceleration
  'performance.simd'?: boolean         // Can use SIMD instructions
  
  // Custom attributes (x-*)
  // Any string starting with 'x-' is reserved for custom extensions
  [key: `x-${string}`]: unknown
  
  // Legacy support for unnamespaced attributes (deprecated)
  [key: string]: unknown
}

/**
 * Well-known attribute names registry
 */
export const WELL_KNOWN_ATTRIBUTES = {
  // Core
  PURE: 'bassline.pure',
  MUTABLE: 'bassline.mutable',
  SINGLETON: 'bassline.singleton',
  DISTRIBUTED: 'bassline.distributed',
  VERSION: 'bassline.version',
  HASH: 'bassline.hash',
  
  // Dynamic
  DYNAMIC_ATTRIBUTES: 'bassline.dynamic-attributes',
  DYNAMIC_TOPOLOGY: 'bassline.dynamic-topology',
  ATTRIBUTE_CYCLES: 'bassline.attribute-cycles',
  
  // Permissions
  MODIFY: 'permissions.modify',
  INSTANTIATE: 'permissions.instantiate',
  INSPECT: 'permissions.inspect',
  EXECUTE: 'permissions.execute',
  
  // Runtime
  LAZY: 'runtime.lazy',
  CACHE: 'runtime.cache',
  TIMEOUT: 'runtime.timeout',
  PRIORITY: 'runtime.priority',
  
  // Validation
  SCHEMA: 'validation.schema',
  UPGRADE: 'validation.upgrade',
  
  // Trust
  TRUST_LEVEL: 'trust.level',
  SIGNATURE: 'trust.signature',
} as const

/**
 * Attribute value types for runtime checking
 */
export type AttributeValue = 
  | boolean
  | string
  | number
  | null
  | undefined
  | { [key: string]: AttributeValue }
  | AttributeValue[]

/**
 * Helper type for attribute contacts (prefixed with @)
 */
export type AttributeContact = `@${string}`

/**
 * Check if a contact ID is an attribute contact
 */
export function isAttributeContact(contactId: string): contactId is AttributeContact {
  return contactId.startsWith('@')
}

/**
 * Check if an attribute key is a custom extension
 */
export function isCustomAttribute(key: string): boolean {
  return key.startsWith('x-')
}

/**
 * Check if an attribute key is well-known
 */
export function isWellKnownAttribute(key: string): boolean {
  return Object.values(WELL_KNOWN_ATTRIBUTES).includes(key as any)
}

/**
 * Validate attribute key format
 */
export function isValidAttributeKey(key: string): boolean {
  // Must be either well-known, custom (x-*), or legacy
  const wellKnownPattern = /^(bassline|permissions|runtime|validation|trust|performance)\.[a-z-]+$/
  const customPattern = /^x-[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/i
  
  return wellKnownPattern.test(key) || customPattern.test(key)
}

/**
 * Bassline validation result
 */
export interface BasslineValidation {
  valid: boolean
  errors?: string[]
  warnings?: string[]
}

/**
 * Validate a bassline manifest
 */
export function validateBassline(bassline: unknown): BasslineValidation {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (!bassline || typeof bassline !== 'object') {
    return { valid: false, errors: ['Bassline must be an object'] }
  }
  
  const b = bassline as any
  
  // Required fields
  if (!b.name || typeof b.name !== 'string') {
    errors.push('Bassline must have a name')
  }
  
  // Validate attributes if present
  if (b.attributes) {
    for (const [key, value] of Object.entries(b.attributes)) {
      if (!isValidAttributeKey(key) && !isCustomAttribute(key)) {
        warnings.push(`Unknown attribute key: ${key}`)
      }
    }
  }
  
  // Check for deprecated patterns
  if (b.type) {
    warnings.push('The "type" field is deprecated. Use attributes to specify gadget behavior.')
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}