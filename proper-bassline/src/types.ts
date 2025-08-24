/**
 * Proper Bassline - Core Types
 * 
 * Runtime types use native JS structures (Set, Map) for efficiency.
 * Serialization protocol converts to/from JSON-compatible forms.
 */

// Base class for all lattice values - generic over the actual value type
export abstract class LatticeValue<T = any> {
  constructor(public readonly value: T) {}
  abstract get type(): string
  abstract serialize(): SerializedLatticeValue
}

// Simple primitive types
export class LatticeNumber extends LatticeValue<number> {
  get type(): 'number' { return 'number' }
  serialize(): SerializedLatticeValue { return { type: 'number', value: this.value } }
}

export class LatticeString extends LatticeValue<string> {
  get type(): 'string' { return 'string' }
  serialize(): SerializedLatticeValue { return { type: 'string', value: this.value } }
}

export class LatticeBool extends LatticeValue<boolean> {
  get type(): 'bool' { return 'bool' }
  serialize(): SerializedLatticeValue { return { type: 'bool', value: this.value } }
}

export class LatticeNull extends LatticeValue<null> {
  constructor() { super(null) }
  get type(): 'null' { return 'null' }
  serialize(): SerializedLatticeValue { return { type: 'null' } }
}

// Compound types - T extends LatticeValue for proper nesting
export class LatticeArray<T extends LatticeValue = LatticeValue> extends LatticeValue<T[]> {
  get type(): 'array' { return 'array' }
  serialize(): SerializedLatticeValue { 
    return { type: 'array', value: this.value.map(v => v.serialize()) }
  }
}

export class LatticeSet<T extends LatticeValue = LatticeValue> extends LatticeValue<Set<T>> {
  get type(): 'set' { return 'set' }
  serialize(): SerializedLatticeValue { 
    return { type: 'set', value: Array.from(this.value).map(v => v.serialize()) }
  }
}

export class LatticeDict<V extends LatticeValue = LatticeValue> extends LatticeValue<Map<string, V>> {
  get type(): 'dict' { return 'dict' }
  serialize(): SerializedLatticeValue {
    const obj: Record<string, SerializedLatticeValue> = {}
    for (const [k, v] of this.value) {
      obj[k] = v.serialize()
    }
    return { type: 'dict', value: obj }
  }
}

// Function type
export class LatticeFunction extends LatticeValue<Function> {
  get type(): 'function' { return 'function' }
  serialize(): SerializedLatticeValue {
    return { type: 'function-ref', name: this.value.name || 'anonymous' }
  }
}

// Contradiction type
export class LatticeContradiction extends LatticeValue<Set<LatticeValue>> {
  get type(): 'contradiction' { return 'contradiction' }
  serialize(): SerializedLatticeValue {
    return { type: 'contradiction', conflicts: Array.from(this.value).map(v => v.serialize()) }
  }
}

// Dynamic object type for anything else
export class LatticeObject extends LatticeValue<any> {
  get type(): 'object' { return 'object' }
  serialize(): SerializedLatticeValue { 
    return { 
      type: 'object-ref', 
      className: this.value?.constructor?.name,
      id: this.value?.id
    }
  }
}

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

// Helper constructors - now return class instances
export const bool = (value: boolean) => new LatticeBool(value)
export const num = (value: number) => new LatticeNumber(value)
export const str = (value: string) => new LatticeString(value)
export const array = <T extends LatticeValue>(items: T[]) => new LatticeArray(items)
export const nil = () => new LatticeNull()
export const obj = (value: any) => new LatticeObject(value)
export const fn = (value: Function) => new LatticeFunction(value)

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
export const isObject = (v: LatticeValue | null): v is LatticeObject => 
  v !== null && v instanceof LatticeObject
export const isFunction = (v: LatticeValue | null): v is LatticeFunction => 
  v !== null && v instanceof LatticeFunction
export const isNull = (v: LatticeValue | null): v is LatticeNull => 
  v !== null && v instanceof LatticeNull

// Legacy alias
export const isMap = isDict

// Serialization protocol - now just calls the serialize method
export function serialize(value: LatticeValue): SerializedLatticeValue {
  return value.serialize()
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
      return new LatticeContradiction(new Set(value.conflicts.map(deserialize)))
    
    default:
      throw new Error(`Unknown type: ${(value as any).type}`)
  }
}

// Helper functions for ordinal values (using dict)
export const ordinalValue = (ord: number, val: LatticeValue): LatticeDict => 
  dict(new Map([['ordinal', num(ord)], ['value', val]]))

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