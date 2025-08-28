/**
 * Port-Graph Interpreter
 * 
 * Interprets port-graph structures by executing primitive functions.
 * Functions operate directly on port records, reading inputs and writing outputs.
 */

import { GraphId, GraphRegistry, PortGraph, PortRecord } from 'port-graphs'
import { JsonValue, PortId } from 'port-graphs/src/types'

// Core types
type PortMap = Record<string, PortRecord>
export type PrimitiveInputs = Record<string, JsonValue>
export type PrimitiveOutputs = Record<string, JsonValue>

// A Primitive is just a function that operates on port maps
export type Primitive = (inputs: PortMap, outputs: PortMap) => void

// Similar to a reducer fn
export type CellFn<T extends JsonValue> = (current: T, incoming: T) => T
export type GadgetFn<In extends PrimitiveInputs = PrimitiveInputs, Out extends PrimitiveOutputs = PrimitiveOutputs> = (inputs: In) => Out


// Combinator: Convert a GadgetFn into a Primitive
export function gadget<In extends PrimitiveInputs, Out extends PrimitiveOutputs>(
  fn: GadgetFn<In, Out>
): Primitive {
  return (inputs: PortMap, outputs: PortMap) => {
    // Extract values from input ports
    const inputValues = {} as In
    let hasAllRequiredInputs = true
    
    for (const [portName, port] of Object.entries(inputs)) {
      const value = port?.currentValue
      if (value !== null && value !== undefined) {
        inputValues[portName as keyof In] = value as In[keyof In]
      } else {
        // If any input is null/undefined, check if function can handle it
        inputValues[portName as keyof In] = value as In[keyof In]
      }
    }
    
    // Run the function
    const outputValues = fn(inputValues)
    
    // Write to output ports
    for (const [portName, value] of Object.entries(outputValues)) {
      if (outputs[portName]) {
        outputs[portName].currentValue = value
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


// Helper: Create a GadgetFn with null checking
export function primitiveFn<In extends PrimitiveInputs, Out extends PrimitiveOutputs>(
  shouldRun: (inputs: In) => boolean,
  body: (inputs: In) => Out
): GadgetFn<In, Out> {
  return (inputs: In) => {
    if (shouldRun(inputs)) {
      return body(inputs)
    } else {
      return {} as Out
    }
  }
}

export function handleNulls(inputs: PrimitiveInputs): boolean {
  return Object.values(inputs).every(input => (input !== null && input !== undefined))
}

// Helper: Create a binary operation
export function binaryOp(fn: (a: number, b: number) => number): GadgetFn<{a: number, b: number}, {result: number}> {
  return primitiveFn(handleNulls, ({a, b}: {a: number, b: number}) => ({ result: fn(a, b) }))
}

// Numeric operations as GadgetFns
export const numeric = {
  add: binaryOp((a, b) => a + b),
  multiply: binaryOp((a, b) => a * b),
  subtract: primitiveFn(handleNulls, ({minuend, subtrahend}: {minuend: number, subtrahend: number}) => 
    ({ result: minuend - subtrahend })
  ),
  divide: primitiveFn(
    (inputs: {dividend: number, divisor: number}) => 
      inputs.dividend !== null && inputs.dividend !== undefined &&
      inputs.divisor !== null && inputs.divisor !== undefined && 
      inputs.divisor !== 0,
    ({dividend, divisor}) => ({ result: dividend / divisor })
  ),
  negate: primitiveFn(handleNulls, ({value}: {value: number}) => 
    ({ result: -value })
  ),
}



// Primitive registry using combinators
const PRIMITIVES: Record<string, Primitive> = {
  // Arithmetic
  'Add': gadget(numeric.add),
  'Multiply': gadget(numeric.multiply),
  'Subtract': gadget(numeric.subtract),
  'Divide': gadget(numeric.divide),
  'Negate': gadget(numeric.negate),
  
  // Lattice cells
  'MaxCell': cell((current: number, incoming: number) => 
    Math.max(current ?? -Infinity, incoming), -Infinity
  ),
  
  'MinCell': cell((current: number, incoming: number) => 
    Math.min(current ?? Infinity, incoming), Infinity
  ),
  
  'OrdinalCell': cell((current: any, incoming: any) => {
    if (incoming && typeof incoming === 'object' && 'ordinal' in incoming) {
      if (!current || !(typeof current === 'object' && 'ordinal' in current) || 
          incoming.ordinal > current.ordinal) {
        return incoming
      }
    }
    return current
  }),
  
  'UnionCell': cell((current: JsonValue[], incoming: JsonValue[]) => {
    if (!Array.isArray(current)) current = []
    if (!Array.isArray(incoming)) return current
    
    const union = new Set([...current, ...incoming])
    return Array.from(union)
  }, []),
  
  // Comparison
  'Equal': gadget(primitiveFn(
    ({a, b}: {a: JsonValue, b: JsonValue}) => a !== null && a !== undefined && b !== null && b !== undefined,
    ({a, b}) => ({ result: a === b })
  )),
  
  'GreaterThan': gadget(binaryOp((a, b) => a > b ? 1 : 0)),
  'LessThan': gadget(binaryOp((a, b) => a < b ? 1 : 0)),
  
  // Control flow
  'Gate': gadget(primitiveFn(
    ({condition, value}: {condition: JsonValue, value: JsonValue}) => true,
    ({condition, value}) => ({ result: condition ? value : null })
  )),
}

export class PortGraphInterpreter {
  constructor(private registry: GraphRegistry) {}
  
  // Run a gadget
  runGadget(graph: PortGraph, gadgetId: string) {
    const gadget = graph.records[gadgetId]
    if (!gadget || gadget.recordType !== 'gadget') return
    
    const gadgetRecord = gadget as any  // Cast to GadgetRecord
    if (!gadgetRecord.primitiveName) return
    
    const primitive = PRIMITIVES[gadgetRecord.primitiveName]
    if (!primitive) {
      console.warn(`Unknown primitive: ${gadgetRecord.primitiveName}`)
      return
    }
    
    // Get all ports for this gadget
    const ports = graph.getGadgetPorts(gadgetId as any)
    
    // Build named input and output maps using portName field
    const inputs: PortMap = {}
    const outputs: PortMap = {}
    
    for (const port of ports) {
      // Use portName field or extract from port ID
      const portName = (port as any).portName || port.name.split('-').pop() || 'value'
      
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