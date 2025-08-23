/**
 * Proper Bassline - Core Types
 * 
 * Values are just data - no built-in operations.
 * Gadgets define the operations (lattice or function).
 */

// Core value type - just data, no operations
export type LatticeValue = 
  | { type: "bool", value: boolean }
  | { type: "number", value: number }
  | { type: "string", value: string }
  | { type: "set", value: Set<LatticeValue> }
  | { type: "null" }
  | { type: "contradiction", conflicts: Set<LatticeValue> }

// Helper constructors
export const bool = (value: boolean): LatticeValue => ({ type: "bool", value })
export const num = (value: number): LatticeValue => ({ type: "number", value })
export const str = (value: string): LatticeValue => ({ type: "string", value })
export const set = (value: Set<LatticeValue>): LatticeValue => ({ type: "set", value })
export const nil = (): LatticeValue => ({ type: "null" })
export const contradiction = (conflicts: Set<LatticeValue>): LatticeValue => ({ type: "contradiction", conflicts })

// Type guards for safer access
export const isNumber = (v: LatticeValue): v is { type: "number", value: number } => v.type === "number"
export const isBool = (v: LatticeValue): v is { type: "bool", value: boolean } => v.type === "bool"
export const isString = (v: LatticeValue): v is { type: "string", value: string } => v.type === "string"
export const isSet = (v: LatticeValue): v is { type: "set", value: Set<LatticeValue> } => v.type === "set"
export const isNull = (v: LatticeValue): v is { type: "null" } => v.type === "null"

// Extract raw value for operations
export function getValue(lv: LatticeValue): any {
  switch (lv.type) {
    case "bool": return lv.value
    case "number": return lv.value
    case "string": return lv.value
    case "set": return lv.value
    case "null": return null
    case "contradiction": return lv.conflicts
  }
}

// Connection from a source gadget (uses WeakRef for memory safety)
export interface Connection {
  source: WeakRef<Gadget>
  outputName: string
}

// Base class for all computational units
export abstract class Gadget {
  id: string
  outputs: Map<string, LatticeValue> = new Map()
  
  constructor(id: string) {
    this.id = id
  }
  
  abstract compute(): void
  
  getOutput(name: string = "default"): LatticeValue {
    return this.outputs.get(name) ?? nil()
  }
  
  setOutput(name: string, value: LatticeValue) {
    this.outputs.set(name, value)
  }
}