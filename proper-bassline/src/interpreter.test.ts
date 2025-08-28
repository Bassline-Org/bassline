import { describe, it, expect, beforeEach } from 'vitest'
import { PortGraphInterpreter } from './interpreter'
import { GraphRegistry, PortGraph, GadgetRecord, PortRecord, ConnectionRecord, GraphId, GadgetId, PortId, ConnectionId } from 'port-graphs'

describe('PortGraphInterpreter', () => {
  let registry: GraphRegistry
  let graph: PortGraph
  let interpreter: PortGraphInterpreter
  
  beforeEach(() => {
    registry = new GraphRegistry()
    graph = registry.newGraph('graph-main' as GraphId)
    interpreter = new PortGraphInterpreter(registry)
  })
  
  describe('Basic Arithmetic', () => {
    it('should add two numbers', () => {
      // Create an Add gadget
      const addGadget: GadgetRecord = {
        name: 'gadget-add1' as GadgetId,
        recordType: 'gadget',
        type: 'function',
        primitiveName: 'Add',
        ladder: null
      }
      graph.addGadget(addGadget as any)
      
      // Create input ports
      const portA: PortRecord = {
        name: 'port-add1-a' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-add1' as GadgetId,
        currentValue: null
      }
      const portB: PortRecord = {
        name: 'port-add1-b' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-add1' as GadgetId,
        currentValue: null
      }
      const portResult: PortRecord = {
        name: 'port-add1-result' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: 'gadget-add1' as GadgetId,
        currentValue: null
      }
      graph.addPort(portA as any)
      graph.addPort(portB as any)
      graph.addPort(portResult as any)
      
      // Create source ports (free ports to inject values)
      const sourceA: PortRecord = {
        name: 'port-source-a' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: null,
        currentValue: 5
      }
      const sourceB: PortRecord = {
        name: 'port-source-b' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: null,
        currentValue: 3
      }
      graph.addPort(sourceA as any)
      graph.addPort(sourceB as any)
      
      // Connect sources to inputs
      const connA: ConnectionRecord = {
        name: 'conn-a' as ConnectionId,
        recordType: 'connection',
        source: 'port-source-a' as PortId,
        target: 'port-add1-a' as PortId
      }
      const connB: ConnectionRecord = {
        name: 'conn-b' as ConnectionId,
        recordType: 'connection',
        source: 'port-source-b' as PortId,
        target: 'port-add1-b' as PortId
      }
      graph.addEdge(connA as any)
      graph.addEdge(connB as any)
      
      // Run the gadget
      interpreter.runGadget(graph, 'gadget-add1')
      
      // Check the result
      expect(portResult.currentValue).toBe(8)
    })
    
    it('should handle null inputs gracefully', () => {
      // Create a Multiply gadget
      const gadget: GadgetRecord = {
        name: 'gadget-mul1' as GadgetId,
        recordType: 'gadget',
        type: 'function',
        primitiveName: 'Multiply',
        ladder: null
      }
      graph.addGadget(gadget as any)
      
      // Create ports with one null value
      const portA: PortRecord = {
        name: 'port-mul1-a' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-mul1' as GadgetId,
        currentValue: null
      }
      const portB: PortRecord = {
        name: 'port-mul1-b' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-mul1' as GadgetId,
        currentValue: 5
      }
      const portResult: PortRecord = {
        name: 'port-mul1-result' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: 'gadget-mul1' as GadgetId,
        currentValue: null
      }
      graph.addPort(portA as any)
      graph.addPort(portB as any)
      graph.addPort(portResult as any)
      
      // Run the gadget - should not update output since one input is null
      interpreter.runGadget(graph, 'gadget-mul1')
      
      expect(portResult.currentValue).toBe(null)
    })
    
    it('should handle division by zero', () => {
      const gadget: GadgetRecord = {
        name: 'gadget-div1' as GadgetId,
        recordType: 'gadget',
        type: 'function',
        primitiveName: 'Divide',
        ladder: null
      }
      graph.addGadget(gadget as any)
      
      const portDividend: PortRecord = {
        name: 'port-div1-dividend' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-div1' as GadgetId,
        currentValue: 10
      }
      const portDivisor: PortRecord = {
        name: 'port-div1-divisor' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-div1' as GadgetId,
        currentValue: 0
      }
      const portResult: PortRecord = {
        name: 'port-div1-result' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: 'gadget-div1' as GadgetId,
        currentValue: null
      }
      graph.addPort(portDividend as any)
      graph.addPort(portDivisor as any)
      graph.addPort(portResult as any)
      
      // Run - should not update output for division by zero
      interpreter.runGadget(graph, 'gadget-div1')
      
      expect(portResult.currentValue).toBe(null)
    })
  })
  
  describe('Lattice Cells', () => {
    it('MaxCell should keep maximum value', () => {
      const gadget: GadgetRecord = {
        name: 'gadget-max1' as GadgetId,
        recordType: 'gadget',
        type: 'cell',
        primitiveName: 'MaxCell',
        ladder: null
      }
      graph.addGadget(gadget as any)
      
      // Cells have a single input port named 'value'
      const portIn: PortRecord = {
        name: 'port-max1-value' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-max1' as GadgetId,
        currentValue: null
      }
      const portOut: PortRecord = {
        name: 'port-max1-out-value' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: 'gadget-max1' as GadgetId,
        currentValue: null
      }
      graph.addPort(portIn as any)
      graph.addPort(portOut as any)
      
      // First value: 5
      portIn.currentValue = 5
      interpreter.runGadget(graph, 'gadget-max1')
      expect(portOut.currentValue).toBe(5)
      
      // Second value: 10 (should become new max)
      portIn.currentValue = 10
      interpreter.runGadget(graph, 'gadget-max1')
      expect(portOut.currentValue).toBe(10)
      
      // Third value: 3 (should keep 10)
      portIn.currentValue = 3
      interpreter.runGadget(graph, 'gadget-max1')
      expect(portOut.currentValue).toBe(10)
      
      // Fourth value: 15 (should become new max)
      portIn.currentValue = 15
      interpreter.runGadget(graph, 'gadget-max1')
      expect(portOut.currentValue).toBe(15)
      
      // Fifth value: 2 (should keep 15)
      portIn.currentValue = 2
      interpreter.runGadget(graph, 'gadget-max1')
      expect(portOut.currentValue).toBe(15)
    })
    
    it('OrdinalCell should keep value with highest ordinal', () => {
      const gadget: GadgetRecord = {
        name: 'gadget-ord1' as GadgetId,
        recordType: 'gadget',
        type: 'cell',
        primitiveName: 'OrdinalCell',
        ladder: null
      }
      graph.addGadget(gadget as any)
      
      const portIn: PortRecord = {
        name: 'port-ord1-value' as PortId,
        recordType: 'port',
        type: 'any',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-ord1' as GadgetId,
        currentValue: { ordinal: 1, value: 'first' }
      }
      const portOut: PortRecord = {
        name: 'port-ord1-out-value' as PortId,
        recordType: 'port',
        type: 'any',
        direction: 'output',
        position: 'right',
        gadget: 'gadget-ord1' as GadgetId,
        currentValue: null
      }
      graph.addPort(portIn as any)
      graph.addPort(portOut as any)
      
      // First value
      interpreter.runGadget(graph, 'gadget-ord1')
      expect(portOut.currentValue).toEqual({ ordinal: 1, value: 'first' })
      
      // Higher ordinal - should update
      portIn.currentValue = { ordinal: 5, value: 'second' }
      interpreter.runGadget(graph, 'gadget-ord1')
      expect(portOut.currentValue).toEqual({ ordinal: 5, value: 'second' })
      
      // Lower ordinal - should keep current
      portIn.currentValue = { ordinal: 3, value: 'third' }
      interpreter.runGadget(graph, 'gadget-ord1')
      expect(portOut.currentValue).toEqual({ ordinal: 5, value: 'second' })
      
      // Higher ordinal - should update again
      portIn.currentValue = { ordinal: 10, value: 'fourth' }
      interpreter.runGadget(graph, 'gadget-ord1')
      expect(portOut.currentValue).toEqual({ ordinal: 10, value: 'fourth' })
    })
    
    it('OrdinalCell should handle invalid inputs', () => {
      const gadget: GadgetRecord = {
        name: 'gadget-ord2' as GadgetId,
        recordType: 'gadget',
        type: 'cell',
        primitiveName: 'OrdinalCell',
        ladder: null
      }
      graph.addGadget(gadget as any)
      
      const portIn: PortRecord = {
        name: 'port-ord2-value' as PortId,
        recordType: 'port',
        type: 'any',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-ord2' as GadgetId,
        currentValue: 'not-an-ordinal-value'  // Invalid format
      }
      const portOut: PortRecord = {
        name: 'port-ord2-out-value' as PortId,
        recordType: 'port',
        type: 'any',
        direction: 'output',
        position: 'right',
        gadget: 'gadget-ord2' as GadgetId,
        currentValue: null
      }
      graph.addPort(portIn as any)
      graph.addPort(portOut as any)
      
      // Invalid input - should not update
      interpreter.runGadget(graph, 'gadget-ord2')
      expect(portOut.currentValue).toBe(null)
      
      // Valid input
      portIn.currentValue = { ordinal: 1, value: 'valid' }
      interpreter.runGadget(graph, 'gadget-ord2')
      expect(portOut.currentValue).toEqual({ ordinal: 1, value: 'valid' })
      
      // Another invalid input - should keep current valid value
      portIn.currentValue = null
      interpreter.runGadget(graph, 'gadget-ord2')
      expect(portOut.currentValue).toEqual({ ordinal: 1, value: 'valid' })
    })
  })
  
  describe('Propagation', () => {
    it('should propagate through a chain of gadgets', () => {
      // Create a chain: source -> Add -> Multiply -> output
      
      // Add gadget
      const addGadget: GadgetRecord = {
        name: 'gadget-add' as GadgetId,
        recordType: 'gadget',
        type: 'function',
        primitiveName: 'Add',
        ladder: null
      }
      graph.addGadget(addGadget as any)
      
      const addPortA: PortRecord = {
        name: 'port-add-a' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-add' as GadgetId,
        currentValue: null
      }
      const addPortB: PortRecord = {
        name: 'port-add-b' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-add' as GadgetId,
        currentValue: null
      }
      const addPortResult: PortRecord = {
        name: 'port-add-result' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: 'gadget-add' as GadgetId,
        currentValue: null
      }
      graph.addPort(addPortA as any)
      graph.addPort(addPortB as any)
      graph.addPort(addPortResult as any)
      
      // Multiply gadget
      const mulGadget: GadgetRecord = {
        name: 'gadget-mul' as GadgetId,
        recordType: 'gadget',
        type: 'function',
        primitiveName: 'Multiply',
        ladder: null
      }
      graph.addGadget(mulGadget as any)
      
      const mulPortA: PortRecord = {
        name: 'port-mul-a' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-mul' as GadgetId,
        currentValue: null
      }
      const mulPortB: PortRecord = {
        name: 'port-mul-b' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-mul' as GadgetId,
        currentValue: null
      }
      const mulPortResult: PortRecord = {
        name: 'port-mul-result' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: 'gadget-mul' as GadgetId,
        currentValue: null
      }
      graph.addPort(mulPortA as any)
      graph.addPort(mulPortB as any)
      graph.addPort(mulPortResult as any)
      
      // Source ports
      const source1: PortRecord = {
        name: 'port-source-1' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: null,
        currentValue: 2
      }
      const source2: PortRecord = {
        name: 'port-source-2' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: null,
        currentValue: 3
      }
      const source3: PortRecord = {
        name: 'port-source-3' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: null,
        currentValue: 4
      }
      graph.addPort(source1 as any)
      graph.addPort(source2 as any)
      graph.addPort(source3 as any)
      
      // Connect: source1 -> add.a, source2 -> add.b
      graph.addEdge({
        name: 'conn-1' as ConnectionId,
        recordType: 'connection',
        source: 'port-source-1' as PortId,
        target: 'port-add-a' as PortId
      } as any)
      graph.addEdge({
        name: 'conn-2' as ConnectionId,
        recordType: 'connection',
        source: 'port-source-2' as PortId,
        target: 'port-add-b' as PortId
      } as any)
      
      // Connect: add.result -> mul.a, source3 -> mul.b
      graph.addEdge({
        name: 'conn-3' as ConnectionId,
        recordType: 'connection',
        source: 'port-add-result' as PortId,
        target: 'port-mul-a' as PortId
      } as any)
      graph.addEdge({
        name: 'conn-4' as ConnectionId,
        recordType: 'connection',
        source: 'port-source-3' as PortId,
        target: 'port-mul-b' as PortId
      } as any)
      
      // Trigger propagation from source1
      interpreter.setPortValue('graph-main', 'port-source-1', 2)
      
      // Check results: 2 + 3 = 5, 5 * 4 = 20
      expect(addPortResult.currentValue).toBe(5)
      expect(mulPortResult.currentValue).toBe(20)
      
      // Change a value and propagate again
      interpreter.setPortValue('graph-main', 'port-source-2', 5)
      
      // Check updated results: 2 + 5 = 7, 7 * 4 = 28
      expect(addPortResult.currentValue).toBe(7)
      expect(mulPortResult.currentValue).toBe(28)
    })
    
    it('should handle disconnected ports gracefully', () => {
      const gadget: GadgetRecord = {
        name: 'gadget-add' as GadgetId,
        recordType: 'gadget',
        type: 'function',
        primitiveName: 'Add',
        ladder: null
      }
      graph.addGadget(gadget as any)
      
      // Port with no connection
      const portA: PortRecord = {
        name: 'port-add-a' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-add' as GadgetId,
        currentValue: null
      }
      // Port with a value
      const portB: PortRecord = {
        name: 'port-add-b' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-add' as GadgetId,
        currentValue: 5
      }
      const portResult: PortRecord = {
        name: 'port-add-result' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: 'gadget-add' as GadgetId,
        currentValue: null
      }
      graph.addPort(portA as any)
      graph.addPort(portB as any)
      graph.addPort(portResult as any)
      
      // Run - should not crash, output stays null
      interpreter.runGadget(graph, 'gadget-add')
      expect(portResult.currentValue).toBe(null)
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle unknown primitives', () => {
      const gadget: GadgetRecord = {
        name: 'gadget-unknown' as GadgetId,
        recordType: 'gadget',
        type: 'function',
        primitiveName: 'UnknownPrimitive',
        ladder: null
      }
      graph.addGadget(gadget as any)
      
      // Should not throw, just warn
      expect(() => interpreter.runGadget(graph, 'gadget-unknown')).not.toThrow()
    })
    
    it('should handle gadgets with no primitive name', () => {
      const gadget: GadgetRecord = {
        name: 'gadget-no-prim' as GadgetId,
        recordType: 'gadget',
        type: 'function',
        primitiveName: undefined as any,
        ladder: null
      }
      graph.addGadget(gadget as any)
      
      expect(() => interpreter.runGadget(graph, 'gadget-no-prim')).not.toThrow()
    })
    
    it('should handle non-existent gadget IDs', () => {
      expect(() => interpreter.runGadget(graph, 'non-existent-gadget')).not.toThrow()
    })
    
    it('should handle non-existent port IDs', () => {
      expect(() => interpreter.setPortValue('graph-main', 'non-existent-port', 42)).not.toThrow()
    })
  })
})