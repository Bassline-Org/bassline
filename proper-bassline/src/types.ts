/**
 * Proper Bassline - Core Types
 * 
 * Values are just data - no built-in operations.
 * Gadgets define the operations (lattice or function).
 * 
 * All types are JSON-compatible for easy serialization.
 */

// Core value type - JSON-compatible structures only
export type LatticeValue = 
  | { type: "bool", value: boolean }
  | { type: "number", value: number }
  | { type: "string", value: string }
  | { type: "array", value: LatticeValue[] }  // For ordered collections
  | { type: "dict", value: Record<string, LatticeValue> }  // For key-value maps
  | { type: "null" }
  | { type: "contradiction", conflicts: LatticeValue[] }

// Helper constructors
export const bool = (value: boolean): LatticeValue => ({ type: "bool", value })
export const num = (value: number): LatticeValue => ({ type: "number", value })
export const str = (value: string): LatticeValue => ({ type: "string", value })
export const array = (value: LatticeValue[]): LatticeValue => ({ type: "array", value })
export const dict = (value: Record<string, LatticeValue>): LatticeValue => ({ type: "dict", value })
export const nil = (): LatticeValue => ({ type: "null" })
export const contradiction = (conflicts: LatticeValue[]): LatticeValue => ({ type: "contradiction", conflicts })

// Legacy aliases for compatibility
export const set = array  // Sets become arrays
export const map = dict    // Maps become dicts

// Type guards for safer access
export const isNumber = (v: LatticeValue | null): v is { type: "number", value: number } => v !== null && v.type === "number"
export const isBool = (v: LatticeValue | null): v is { type: "bool", value: boolean } => v !== null && v.type === "bool"
export const isString = (v: LatticeValue | null): v is { type: "string", value: string } => v !== null && v.type === "string"
export const isArray = (v: LatticeValue | null): v is { type: "array", value: LatticeValue[] } => v !== null && v.type === "array"
export const isDict = (v: LatticeValue | null): v is { type: "dict", value: Record<string, LatticeValue> } => v !== null && v.type === "dict"
export const isNull = (v: LatticeValue | null): v is { type: "null" } => v !== null && v.type === "null"

// Legacy aliases for compatibility
export const isSet = isArray
export const isMap = isDict

// Helper functions for ordinal values (using dict)
export const ordinalValue = (ord: number, val: LatticeValue): LatticeValue => 
  dict({ ordinal: num(ord), value: val })

export const getOrdinal = (d: LatticeValue): number | null => {
  if (!isDict(d)) return null
  const ord = d.value.ordinal
  return ord && isNumber(ord) ? ord.value : null
}

export const getDictValue = (d: LatticeValue, key: string): LatticeValue | null => {
  if (!isDict(d)) return null
  return d.value[key] || null
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
    case "dict": return lv.value
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