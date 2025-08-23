/**
 * Proper Bassline - Core Types
 * 
 * Runtime types use native JS structures (Set, Map) for efficiency.
 * Serialization protocol converts to/from JSON-compatible forms.
 */

// Runtime type - uses native JS structures for efficiency
export type LatticeValue = 
  | { type: "bool", value: boolean }
  | { type: "number", value: number }
  | { type: "string", value: string }
  | { type: "array", value: LatticeValue[] }  // Ordered collection
  | { type: "set", value: Set<LatticeValue> }  // Unordered, unique items
  | { type: "dict", value: Map<string, LatticeValue> }  // Key-value map
  | { type: "object", value: any }  // Arbitrary JS objects
  | { type: "function", value: Function }  // Executable functions
  | { type: "null" }
  | { type: "contradiction", conflicts: Set<LatticeValue> }

// Serialized type - JSON-compatible representation
export type SerializedLatticeValue = 
  | { type: "bool", value: boolean }
  | { type: "number", value: number }
  | { type: "string", value: string }
  | { type: "array", value: SerializedLatticeValue[] }
  | { type: "set", value: SerializedLatticeValue[] }  // Set as array
  | { type: "dict", value: Record<string, SerializedLatticeValue> }  // Map as object
  | { type: "object-ref", className?: string, id?: string }  // Reference to object
  | { type: "function-ref", name: string }  // Reference to function by name
  | { type: "function-src", source: string }  // Function source code
  | { type: "null" }
  | { type: "contradiction", conflicts: SerializedLatticeValue[] }

// Helper constructors (runtime types)
export const bool = (value: boolean): LatticeValue => ({ type: "bool", value })
export const num = (value: number): LatticeValue => ({ type: "number", value })
export const str = (value: string): LatticeValue => ({ type: "string", value })
export const array = (value: LatticeValue[]): LatticeValue => ({ type: "array", value })
export const nil = (): LatticeValue => ({ type: "null" })
export const obj = (value: any): LatticeValue => ({ type: "object", value })
export const fn = (value: Function): LatticeValue => ({ type: "function", value })

// Set constructor with deduplication
export const set = (items: LatticeValue[] | Set<LatticeValue>): LatticeValue => {
  if (items instanceof Set) {
    return { type: "set", value: items }
  }
  // Deduplicate using JSON.stringify for deep equality
  const seen = new Map<string, LatticeValue>()
  for (const item of items) {
    const key = JSON.stringify(serialize(item))
    if (!seen.has(key)) {
      seen.set(key, item)
    }
  }
  return { type: "set", value: new Set(seen.values()) }
}

// Dict constructor
export const dict = (entries: Record<string, LatticeValue> | Map<string, LatticeValue>): LatticeValue => {
  if (entries instanceof Map) {
    return { type: "dict", value: entries }
  }
  return { type: "dict", value: new Map(Object.entries(entries)) }
}

// Contradiction constructor
export const contradiction = (conflicts: LatticeValue[] | Set<LatticeValue>): LatticeValue => ({
  type: "contradiction",
  conflicts: conflicts instanceof Set ? conflicts : new Set(conflicts)
})

// Type guards for runtime types
export const isNumber = (v: LatticeValue | null): v is { type: "number", value: number } => 
  v !== null && v.type === "number"
export const isBool = (v: LatticeValue | null): v is { type: "bool", value: boolean } => 
  v !== null && v.type === "bool"
export const isString = (v: LatticeValue | null): v is { type: "string", value: string } => 
  v !== null && v.type === "string"
export const isArray = (v: LatticeValue | null): v is { type: "array", value: LatticeValue[] } => 
  v !== null && v.type === "array"
export const isSet = (v: LatticeValue | null): v is { type: "set", value: Set<LatticeValue> } => 
  v !== null && v.type === "set"
export const isDict = (v: LatticeValue | null): v is { type: "dict", value: Map<string, LatticeValue> } => 
  v !== null && v.type === "dict"
export const isObject = (v: LatticeValue | null): v is { type: "object", value: any } => 
  v !== null && v.type === "object"
export const isFunction = (v: LatticeValue | null): v is { type: "function", value: Function } => 
  v !== null && v.type === "function"
export const isNull = (v: LatticeValue | null): v is { type: "null" } => 
  v !== null && v.type === "null"

// Legacy alias
export const isMap = isDict

// Serialization protocol
export function serialize(value: LatticeValue): SerializedLatticeValue {
  switch (value.type) {
    case "bool":
    case "number":
    case "string":
    case "null":
      return value as SerializedLatticeValue
    
    case "array":
      return { type: "array", value: value.value.map(serialize) }
    
    case "set":
      return { type: "set", value: Array.from(value.value).map(serialize) }
    
    case "dict": {
      const obj: Record<string, SerializedLatticeValue> = {}
      for (const [k, v] of value.value) {
        obj[k] = serialize(v)
      }
      return { type: "dict", value: obj }
    }
    
    case "object":
      // For objects, we'll serialize as a reference
      // Could be enhanced to include className or other metadata
      return { 
        type: "object-ref", 
        className: value.value?.constructor?.name,
        id: value.value?.id
      }
    
    case "function":
      // For functions, serialize by name or source
      return {
        type: "function-ref",
        name: value.value.name || "anonymous"
      }
    
    case "contradiction":
      return { type: "contradiction", conflicts: Array.from(value.conflicts).map(serialize) }
    
    default:
      throw new Error(`Unknown type: ${(value as any).type}`)
  }
}

// Deserialization protocol
export function deserialize(value: SerializedLatticeValue): LatticeValue {
  switch (value.type) {
    case "bool":
    case "number":
    case "string":
    case "null":
      return value as LatticeValue
    
    case "array":
      return { type: "array", value: value.value.map(deserialize) }
    
    case "set":
      return { type: "set", value: new Set(value.value.map(deserialize)) }
    
    case "dict": {
      const map = new Map<string, LatticeValue>()
      for (const [k, v] of Object.entries(value.value)) {
        map.set(k, deserialize(v))
      }
      return { type: "dict", value: map }
    }
    
    case "object-ref":
      // For now, deserialize as null - could be enhanced with a registry
      // In the future, could look up object by className/id
      return nil()
    
    case "function-ref":
      // For now, deserialize as null - could be enhanced with a function registry
      // In the future, could look up function by name
      return nil()
    
    case "function-src":
      // Could eval the source, but that's dangerous
      // For now, return nil
      return nil()
    
    case "contradiction":
      return { type: "contradiction", conflicts: new Set(value.conflicts.map(deserialize)) }
    
    default:
      throw new Error(`Unknown type: ${(value as any).type}`)
  }
}

// Helper functions for ordinal values (using dict)
export const ordinalValue = (ord: number, val: LatticeValue): LatticeValue => 
  dict({ ordinal: num(ord), value: val })

export const getOrdinal = (d: LatticeValue): number | null => {
  if (!isDict(d)) return null
  const ord = d.value.get("ordinal")
  return ord && isNumber(ord) ? ord.value : null
}

export const getDictValue = (d: LatticeValue, key: string): LatticeValue | null => {
  if (!isDict(d)) return null
  return d.value.get(key) || null
}

// Alias for backward compatibility
export const getMapValue = (d: LatticeValue): LatticeValue | null => getDictValue(d, "value")

// Extract raw value for operations
export function getValue(lv: LatticeValue): any {
  switch (lv.type) {
    case "bool": return lv.value
    case "number": return lv.value
    case "string": return lv.value
    case "array": return lv.value
    case "set": return lv.value
    case "dict": return lv.value
    case "object": return lv.value
    case "function": return lv.value
    case "null": return null
    case "contradiction": return lv.conflicts
    default: throw new Error(`Invalid value type: ${lv}`)
  }
}

// Forward declaration - Gadget is now in gadget.ts
export type { Gadget } from './gadget'

// Connection from a source gadget (uses WeakRef for memory safety)
export interface Connection {
  source: WeakRef<any>  // Using any to avoid circular dependency
  outputName: string
}

// Compatibility layer - allow plain objects to be used where Maps are expected
export const map = dict  // Alias for backward compatibility