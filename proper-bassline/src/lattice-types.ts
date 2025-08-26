/**
 * Proper Bassline - Core Types
 * 
 * Runtime types use native JS structures (Set, Map) for efficiency.
 * Serialization protocol converts to/from JSON-compatible forms.
  */

// Base class for all lattice values - generic over the actual value type
export abstract class LatticeValue<T = any> {
  constructor(public readonly value: T, public readonly type: LatticeValueTypes) {
    if (value instanceof LatticeValue) {
      throw new Error(`Cannot wrap a LatticeValue: ${value.type}`)
    }
  }
  serialize(): SerializedLatticeValue {
    return { type: this.type, value: this.value } as SerializedLatticeValue
  }
  abstract prettyPrint(): string
}

// Simple primitive types
export class LatticeNumber extends LatticeValue<number> {
  constructor(value: number) { super(value, 'number') }
  prettyPrint(): string { return String(this.value) }
}

export class LatticeString extends LatticeValue<string> {
  constructor(value: string) { super(value, 'string') }
  prettyPrint(): string { return `"${this.value}"` }
}

export class LatticeBool extends LatticeValue<boolean> {
  constructor(value: boolean) { super(value, 'bool') }
  prettyPrint(): string { return this.value ? 'true' : 'false' }
}

export class LatticeNull extends LatticeValue<null> {
  constructor() { super(null, 'null') }
  prettyPrint(): string { return 'nil' }
}

// Compound types - T extends LatticeValue for proper nesting
export class LatticeArray<T extends LatticeValue = LatticeValue> extends LatticeValue<T[]> {
  constructor(value: T[]) { super(value, 'array') }
  prettyPrint(): string {
    const items = this.value.map(v => v.prettyPrint()).join(', ')
    return `[${items}]`
  }
}

export class LatticeSet<T extends LatticeValue = LatticeValue> extends LatticeValue<Set<T>> {
  constructor(value: Set<T>) { super(value, 'set') }
  prettyPrint(): string {
    const items = Array.from(this.value).map(v => v.prettyPrint()).join(', ')
    return `{${items}}`
  }
}

export class LatticeDict<V extends LatticeValue = LatticeValue> extends LatticeValue<Map<string, V>> {
  constructor(value: Map<string, V>) { super(value, 'dict') }
  prettyPrint(): string {
    const entries: string[] = []
    for (const [k, v] of this.value) {
      entries.push(`${k}: ${v.prettyPrint()}`)
    }
    return `{${entries.join(', ')}}`
  }
}


// Dynamic object type for host language objects
export class LatticeBox<T = any> extends LatticeValue<T> {
  id: string
  constructor(value: T, id: string = generateRandomId()) { super(value, 'box'); this.id = id }
  prettyPrint(): string {
    const id = this.id || generateRandomId()
    return `box-${id}`
  }
}

// Contradiction type
export class LatticeContradiction extends LatticeValue<Set<LatticeValue>> {
  constructor(value: Set<LatticeValue>) { super(value, 'contradiction') }
  prettyPrint(): string {
    const conflicts = Array.from(this.value).map(v => v.prettyPrint()).join(' vs ')
    return `⊥(${conflicts})`
  }
}


export type BoxId = string

export type LatticeValueTypes = "bool" | "number" | "string" | "array" | "set" | "dict" | "null" | "contradiction" | "box"

// Serialized type - JSON-compatible representation
export type SerializedLatticeValue = 
  | { type: "bool", value: boolean }
  | { type: "number", value: number }
  | { type: "string", value: string }
  | { type: "array", value: SerializedLatticeValue[] }
  | { type: "set", value: SerializedLatticeValue[] }  // Set as array
  | { type: "dict", value: Record<string, SerializedLatticeValue> }  // Map as object
  | { type: "null" }
  | { type: "contradiction", conflicts: SerializedLatticeValue[] }
  | { type: "box", value: BoxId }

// Helper constructors - now return class instances
export const bool = (value: boolean) => new LatticeBool(value)
export const num = (value: number) => new LatticeNumber(value)
export const str = (value: string) => new LatticeString(value)
export const array = <T extends LatticeValue>(items: T[]) => new LatticeArray(items)
export const nil = () => new LatticeNull()
export const box = <T = any>(value: T, id: string) => new LatticeBox(value, id)

// Set constructor with deduplication
export const set = <T extends LatticeValue>(items: Set<T> | T[]): LatticeSet<T> => {
  if (items instanceof Set) {
    return new LatticeSet(items)
  }
  // Deduplicate using JSON.stringify for deep equality
  const seen = new Map<string, T>()
  for (const item of items) {
    const key = JSON.stringify(item.serialize())
    if (!seen.has(key)) {
      seen.set(key, item)
    }
  }
  return new LatticeSet(new Set(seen.values()))
}

// Dict constructor
export const dict = <V extends LatticeValue>(entries: Map<string, V> | Record<string, V>): LatticeDict<V> => {
  if (entries instanceof Map) {
    return new LatticeDict(entries)
  }
  return new LatticeDict(new Map(Object.entries(entries)))
}

// Contradiction constructor
export const contradiction = (conflicts: Set<LatticeValue> | LatticeValue[]): LatticeContradiction => {
  return new LatticeContradiction(conflicts instanceof Set ? conflicts : new Set(conflicts))
}

// Type guards using instanceof
export const isNumber = (v: LatticeValue | null): v is LatticeNumber => 
  v !== null && v instanceof LatticeNumber
export const isBool = (v: LatticeValue | null): v is LatticeBool => 
  v !== null && v instanceof LatticeBool
export const isString = (v: LatticeValue | null): v is LatticeString => 
  v !== null && v instanceof LatticeString
export const isArray = (v: LatticeValue | null): v is LatticeArray => 
  v !== null && v instanceof LatticeArray
export const isSet = (v: LatticeValue | null): v is LatticeSet => 
  v !== null && v instanceof LatticeSet
export const isDict = (v: LatticeValue | null): v is LatticeDict => 
  v !== null && v instanceof LatticeDict
export const isBox = (v: LatticeValue | null): v is LatticeBox => 
  v !== null && v instanceof LatticeBox
export const isNull = (v: LatticeValue | null): v is LatticeNull => 
  v !== null && v instanceof LatticeNull

// Pretty printing helper
export function prettyPrint(value: LatticeValue | null | undefined | any): string {
  if (!value) return 'nil'
  
  // Handle LatticeValue instances
  if (value && typeof value === 'object' && typeof value.prettyPrint === 'function') {
    return value.prettyPrint()
  }
  
  // Handle OrdinalCell's dict structure (has ordinal and value keys)
  if (value && typeof value === 'object' && value.type === 'dict' && value.value instanceof Map) {
    const map = value.value as Map<string, any>
    if (map.has('ordinal') && map.has('value')) {
      // Extract the wrapped value and pretty print it
      const innerValue = map.get('value')
      return prettyPrint(innerValue)
    }
  }
  
  // Fallback to JSON for plain objects
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  
  return String(value)
}

// Deserialization protocol
export function deserialize(value: SerializedLatticeValue): LatticeValue {
  switch (value.type) {
    case "bool":
      return new LatticeBool(value.value)
    
    case "number":
      return new LatticeNumber(value.value)
    
    case "string":
      return new LatticeString(value.value)
    
    case "null":
      return new LatticeNull()
    
    case "array":
      return new LatticeArray(value.value.map(deserialize))
    
    case "set":
      return new LatticeSet(new Set(value.value.map(deserialize)))
    
    case "dict": {
      const map = new Map<string, LatticeValue>()
      for (const [k, v] of Object.entries(value.value)) {
        map.set(k, deserialize(v))
      }
      return new LatticeDict(map)
    }
    
    case "box":
      return new LatticeBox(value.value)
    
    case "contradiction":
      return new LatticeContradiction(new Set(value.conflicts.map(deserialize)))
    
    default:
      throw new Error(`Unknown type: ${(value as any).type}`)
  }
}

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
  if (lv instanceof LatticeNull) return null
  if (lv instanceof LatticeContradiction) return lv.value // Set of conflicts
  return lv.value
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

function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 15)
}