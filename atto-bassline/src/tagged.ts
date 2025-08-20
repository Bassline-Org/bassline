/**
 * Tagged value utilities for type system
 */

import { Value } from './types'

// ============================================================================
// Tagged value type
// ============================================================================

export interface Tagged<T = any> {
  tag: string
  value: T
}

// ============================================================================
// Constructors
// ============================================================================

/**
 * Create a tagged value
 */
export function tag(name: string, value: any): Tagged {
  return { tag: name, value }
}

/**
 * Extract value from tagged
 */
export function untag<T>(tagged: Tagged<T>): T {
  return tagged.value
}

/**
 * Get tag name from value
 */
export function getTag(value: Value): string | null {
  if (value && typeof value === 'object' && 'tag' in value) {
    return (value as any).tag
  }
  return null
}

// ============================================================================
// Contradiction type
// ============================================================================

export interface ContradictionData {
  reason: string
  sources?: Value[]
  location?: string
}

/**
 * Create a contradiction value
 */
export function contradiction(
  reason: string,
  sources?: Value[],
  location?: string
): Tagged<ContradictionData> {
  return tag('contradiction', { reason, sources, location })
}

// ============================================================================
// Type predicates (for use in TypeScript, not gadgets)
// ============================================================================

/**
 * Check if value is tagged
 */
export function isTagged(value: Value): boolean {
  return value !== null && 
         typeof value === 'object' && 
         'tag' in value &&
         'value' in value
}

/**
 * Check if value has specific tag
 */
export function hasTag(value: Value, tagName: string): boolean {
  return isTagged(value) && (value as any).tag === tagName
}

/**
 * Check if value is a contradiction
 */
export function isContradiction(value: Value): boolean {
  return hasTag(value, 'contradiction')
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Stringify a value, handling tagged values recursively
 */
export function stringify(value: Value): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return String(value)
  
  // Handle arrays
  if (Array.isArray(value)) {
    return '[' + value.map(stringify).join(', ') + ']'
  }
  
  // Handle tagged values specially
  if (isTagged(value)) {
    const tagged = value as any
    if (tagged.tag === 'contradiction') {
      return `<contradiction: ${tagged.value.reason}>`
    }
    if (tagged.tag === 'some') {
      return `Some(${stringify(tagged.value)})`
    }
    if (tagged.tag === 'none') {
      return 'None'
    }
    // Generic tagged value
    return `<${tagged.tag}: ${stringify(tagged.value)}>`
  }
  
  // Handle regular objects
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([k, v]) => `${k}: ${stringify(v)}`)
      .join(', ')
    return '{' + entries + '}'
  }
  
  return String(value)
}

/**
 * Parse a stringified value back into a Value
 * This is a basic implementation - can be extended as needed
 */
export function parse(str: string): Value {
  // Try to parse as JSON first
  try {
    return JSON.parse(str)
  } catch {
    // Handle special formats
    if (str === 'null') return null
    if (str === 'true') return true
    if (str === 'false') return false
    if (str === 'None') return none()
    
    // Try to parse as number
    const num = Number(str)
    if (!isNaN(num)) return num
    
    // Check for tagged value formats
    if (str.startsWith('Some(') && str.endsWith(')')) {
      const inner = str.slice(5, -1)
      return some(parse(inner))
    }
    
    if (str.startsWith('<') && str.includes(':')) {
      // Parse generic tagged format <tag: value>
      const match = str.match(/^<([^:]+):\s*(.+)>$/)
      if (match) {
        return tag(match[1], parse(match[2]))
      }
    }
    
    // Default to string
    return str
  }
}

// ============================================================================
// Common tagged types
// ============================================================================

/**
 * Create an interval (as a pair)
 */
export function interval(min: number, max: number): [number, number] {
  return [min, max]
}

/**
 * Check if value is a pair (2-element array)
 */
export function isPair(value: Value): value is [Value, Value] {
  return Array.isArray(value) && value.length === 2
}

/**
 * Create a Maybe/Option type
 */
export function some<T>(value: T): Tagged<T> {
  return tag('some', value)
}

export function none(): Tagged<null> {
  return tag('none', null)
}

/**
 * Check if value is Some
 */
export function isSome(value: Value): boolean {
  return hasTag(value, 'some')
}

/**
 * Check if value is None
 */
export function isNone(value: Value): boolean {
  return hasTag(value, 'none')
}