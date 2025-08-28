/**
 * Port-Graph Interpreter
 * 
 * Interprets port-graph structures by executing primitive functions.
 * Functions operate directly on port records, reading inputs and writing outputs.
 */

import { GraphId, GraphRegistry, PortGraph, PortRecord } from 'port-graphs'
import { JsonValue, PortId, GadgetRecord, GadgetId } from 'port-graphs/src/types'

// Core types
type PortMap = Record<string, PortRecord>
export type PrimitiveInputs = Record<string, JsonValue>
export type PrimitiveOutputs = Record<string, JsonValue>

// A Primitive is just a function that operates on port maps
export type Primitive = (inputs: PortMap, outputs: PortMap) => void

// Similar to a reducer fn
export type CellFn<T extends JsonValue> = (current: T, incoming: T) => T
export type GadgetFn<In extends PrimitiveInputs = PrimitiveInputs, Out extends PrimitiveOutputs = PrimitiveOutputs> = (inputs: In) => Out


// Port remapping configuration
export type PortMapping<In, Out> = {
  inputs?: Partial<Record<keyof In, string>>
  outputs?: Partial<Record<keyof Out, string>>
}

// Combinator: Convert a GadgetFn into a Primitive
export function gadget<In extends PrimitiveInputs, Out extends PrimitiveOutputs>(
  fn: GadgetFn<In, Out>,
  portMap?: PortMapping<In, Out>
): Primitive {
  return (inputs: PortMap, outputs: PortMap) => {
    // Build input values with optional remapping
    const inputValues = {} as In
    
    if (portMap?.inputs) {
      // Map custom port names to function parameters
      for (const [paramName, portName] of Object.entries(portMap.inputs)) {
        const port = inputs[portName as string]
        if (port) {
          inputValues[paramName as keyof In] = port.currentValue as In[keyof In]
        }
      }
    }
    
    // Direct mapping for unmapped parameters
    for (const [portName, port] of Object.entries(inputs)) {
      if (!portMap?.inputs || !Object.values(portMap.inputs).includes(portName)) {
        inputValues[portName as keyof In] = port?.currentValue as In[keyof In]
      }
    }
    
    // Run the function
    const outputValues = fn(inputValues)
    
    // Write to output ports with optional remapping
    if (portMap?.outputs) {
      for (const [resultKey, portName] of Object.entries(portMap.outputs)) {
        const port = outputs[portName as string]
        if (port && resultKey in outputValues) {
          port.currentValue = outputValues[resultKey as keyof Out]
        }
      }
    }
    
    // Direct mapping for unmapped outputs
    for (const [resultKey, value] of Object.entries(outputValues)) {
      if (!portMap?.outputs || !portMap.outputs[resultKey as keyof Out]) {
        if (outputs[resultKey]) {
          outputs[resultKey].currentValue = value
        }
      }
    }
  }
}

// Combinator: Convert a CellFn into a Primitive
export function cell<T extends JsonValue>(
  reducer: CellFn<T>,
  seed?: T
): Primitive {
  return (inputs: PortMap, outputs: PortMap) => {
    const incoming = inputs['value']?.currentValue as T
    const current = outputs['value']?.currentValue as T
    
    if (incoming !== null && incoming !== undefined) {
      const newValue = reducer(current ?? seed ?? (null as any), incoming)
      if (outputs['value']) {
        outputs['value'].currentValue = newValue
      }
    }
  }
}


// Pure function definitions - no double wrapping!
const add = ({a, b}: {a: number, b: number}) => {
  if (a === null || a === undefined || b === null || b === undefined) return {}
  return { result: a + b }
}

const multiply = ({a, b}: {a: number, b: number}) => {
  if (a === null || a === undefined || b === null || b === undefined) return {}
  return { result: a * b }
}

const subtract = ({minuend, subtrahend}: {minuend: number, subtrahend: number}) => {
  if (minuend === null || minuend === undefined || subtrahend === null || subtrahend === undefined) return {}
  return { result: minuend - subtrahend }
}

const divide = ({dividend, divisor}: {dividend: number, divisor: number}) => {
  if (dividend === null || dividend === undefined || divisor === null || divisor === undefined || divisor === 0) return {}
  return { result: dividend / divisor }
}

const negate = ({value}: {value: number}) => {
  if (value === null || value === undefined) return {}
  return { result: -value }
}

const equal = ({a, b}: {a: JsonValue, b: JsonValue}) => {
  return { result: a === b }
}

const greaterThan = ({a, b}: {a: number, b: number}) => {
  if (a === null || a === undefined || b === null || b === undefined) return {}
  return { result: a > b }
}

const lessThan = ({a, b}: {a: number, b: number}) => {
  if (a === null || a === undefined || b === null || b === undefined) return {}
  return { result: a < b }
}

const gate = ({condition, value}: {condition: JsonValue, value: JsonValue}) => {
  return { result: condition ? value : null }
}

// Cell reducer functions - pure and simple
const maxCell = (current: number, incoming: number) => 
  Math.max(current ?? -Infinity, incoming)

const minCell = (current: number, incoming: number) => 
  Math.min(current ?? Infinity, incoming)

type OrdinalValue = { ordinal: number, value: JsonValue }

const ordinalCell = (current: OrdinalValue | null, incoming: OrdinalValue | null): OrdinalValue | null => {
  if (incoming && typeof incoming === 'object' && 'ordinal' in incoming) {
    if (!current || !(typeof current === 'object' && 'ordinal' in current) || 
        incoming.ordinal > current.ordinal) {
      return incoming
    }
  }
  return current
}

const unionCell = (current: JsonValue[] | null, incoming: JsonValue): JsonValue[] => {
  const currentSet = Array.isArray(current) ? current : []
  
  if (Array.isArray(incoming)) {
    // If incoming is an array, union all elements
    const union = new Set([...currentSet, ...incoming])
    return Array.from(union)
  } else {
    // If incoming is a single value, add it to the set
    const union = new Set([...currentSet, incoming])
    return Array.from(union)
  }
}



// Primitive registry - clean and simple
const PRIMITIVES: Record<string, Primitive> = {
  // Arithmetic
  'Add': gadget(add),
  'Multiply': gadget(multiply),
  'Subtract': gadget(subtract),
  'Divide': gadget(divide),
  'Negate': gadget(negate),
  
  // Lattice cells
  'MaxCell': cell(maxCell, -Infinity),
  'MinCell': cell(minCell, Infinity),
  'OrdinalCell': cell(ordinalCell),
  'UnionCell': cell(unionCell, []),
  
  // Comparison
  'Equal': gadget(equal),
  'GreaterThan': gadget(greaterThan),
  'LessThan': gadget(lessThan),
  
  // Control flow
  'Gate': gadget(gate),
}

export class PortGraphInterpreter {
  constructor(private registry: GraphRegistry) {}
  
  // Run a gadget
  runGadget(graph: PortGraph, gadgetId: string) {
    const gadget = graph.records[gadgetId]
    if (!gadget || gadget.recordType !== 'gadget') return
    
    const gadgetRecord = gadget as GadgetRecord
    if (!gadgetRecord.primitiveName) return
    
    const primitive = PRIMITIVES[gadgetRecord.primitiveName]
    if (!primitive) {
      console.warn(`Unknown primitive: ${gadgetRecord.primitiveName}`)
      return
    }
    
    // Get all ports for this gadget
    const ports = graph.getGadgetPorts(gadgetId as GadgetId)
    
    // Build named input and output maps using portName field
    const inputs: PortMap = {}
    const outputs: PortMap = {}
    
    for (const port of ports) {
      // Use portName field for the human-readable name
      const portRecord = port as PortRecord & { portName?: string }
      const portName = portRecord.portName || 'value'
      
      if (port.direction === 'input') {
        // Update input port with value from connected source
        const connection = graph.connectionRecords.find(c => c.target === port.name)
        if (connection) {
          const sourcePort = graph.records[connection.source] as PortRecord
          if (sourcePort) {
            port.currentValue = sourcePort.currentValue
          }
        }
        // Input port keeps its currentValue if not connected
        inputs[portName] = port
      } else {
        outputs[portName] = port
      }
    }
    
    // Just call the primitive - it's a function!
    primitive(inputs, outputs)
    
    // Propagate from output ports
    for (const port of Object.values(outputs)) {
      this.propagateFromPort(graph, port.name)
    }
  }
  
  // When a port value changes, trigger connected gadgets
  propagateFromPort(graph: PortGraph, portId: string) {
    const connections = graph.connectionRecords.filter(c => c.source === portId)
    
    for (const conn of connections) {
      const targetPort = graph.records[conn.target] as PortRecord
      if (targetPort?.gadget) {
        this.runGadget(graph, targetPort.gadget)
      }
    }
  }
  
  // Set a value on a port and trigger propagation
  setPortValue(graphId: GraphId, portId: string, value: any) {
    const graph = this.registry.getGraph(graphId)
    if (!graph) return
    
    const port = graph.records[portId] as PortRecord
    if (port) {
      port.currentValue = value
      
      // If this port belongs to a gadget, run it
      if (port.gadget) {
        this.runGadget(graph, port.gadget)
      } else {
        // Free port - just propagate
        this.propagateFromPort(graph, portId)
      }
    }
  }
  
  // Get all available primitives
  static getPrimitives(): string[] {
    return Object.keys(PRIMITIVES)
  }
}

// Export the primitives for extension
export { PRIMITIVES }