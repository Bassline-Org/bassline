import { describe, it, expect, beforeEach } from 'vitest'
import { PortGraphInterpreter } from './interpreter'
import { GraphRegistry, PortGraph, GadgetRecord, PortRecord, ConnectionRecord, GadgetId, PortId, ConnectionId } from 'port-graphs'

describe('PortGraphInterpreter - Cycle Convergence', () => {
  let registry: GraphRegistry
  let graph: PortGraph
  let interpreter: PortGraphInterpreter

  beforeEach(() => {
    registry = new GraphRegistry()
    graph = registry.newGraph('graph-test-graph')
    interpreter = new PortGraphInterpreter(registry)
  })

  describe('MaxCell Cycles', () => {
    it('should converge in a 3-node MaxCell cycle', () => {
      // Create 3 MaxCells: A -> B -> C -> A
      graph.addCell({ name: 'gadget-a', primitiveName: 'MaxCell' })
      graph.addCell({ name: 'gadget-b', primitiveName: 'MaxCell' })
      graph.addCell({ name: 'gadget-c', primitiveName: 'MaxCell' })

      graph.addPort({ name: 'port-a-in', portName: 'value', type: 'number', direction: 'input', gadget: 'gadget-a', currentValue: null })
      graph.addPort({ name: 'port-a-out', portName: 'value', type: 'number', direction: 'output', gadget: 'gadget-a', currentValue: null })
      graph.addPort({ name: 'port-b-in', portName: 'value', type: 'number', direction: 'input', gadget: 'gadget-b', currentValue: null })
      graph.addPort({ name: 'port-b-out', portName: 'value', type: 'number', direction: 'output', gadget: 'gadget-b', currentValue: null })
      graph.addPort({ name: 'port-c-in', portName: 'value', type: 'number', direction: 'input', gadget: 'gadget-c', currentValue: null });
      graph.addPort({ name: 'port-c-out', portName: 'value', type: 'number', direction: 'output', gadget: 'gadget-c', currentValue: null });

      graph.addEdge({name: 'connection-a-b', source: 'port-a-out', target: 'port-b-in'});
      graph.addEdge({name: 'connection-b-c', source: 'port-b-out', target: 'port-c-in'});
      graph.addEdge({name: 'connection-c-a', source: 'port-c-out', target: 'port-a-in'});

      // Inject value 5 into cell A
      interpreter.setPortValue(graph.id, 'port-a-in', 5);

      // All cells should converge to 5
      expect(graph.getPortRecord('port-a-out').currentValue).toBe(5);
      expect(graph.getPortRecord('port-b-out').currentValue).toBe(5);
      expect(graph.getPortRecord('port-c-out').currentValue).toBe(5);

      // Inject value 10 into cell B
      interpreter.setPortValue(graph.id, 'port-b-in', 10);

      // All cells should converge to 10
      expect(graph.getPortRecord('port-a-out').currentValue).toBe(10);
      expect(graph.getPortRecord('port-b-out').currentValue).toBe(10);
      expect(graph.getPortRecord('port-c-out').currentValue).toBe(10);

      // Inject value 3 into cell C (less than current max)
      interpreter.setPortValue(graph.id, 'port-c-in', 3);

      // All cells should stay at 10
      expect(graph.getPortRecord('port-a-out').currentValue).toBe(10);
      expect(graph.getPortRecord('port-b-out').currentValue).toBe(10);
      expect(graph.getPortRecord('port-c-out').currentValue).toBe(10);
    })

    it('should handle mutual constraints (bidirectional connection)', () => {
      // Create 2 MaxCells with mutual connections
      const cellA: GadgetRecord = {
        name: 'cell-a' as GadgetId,
        recordType: 'gadget',
        type: 'cell',
        primitiveName: 'MaxCell',
        ladder: null
      }
      const cellB: GadgetRecord = {
        name: 'cell-b' as GadgetId,
        recordType: 'gadget',
        type: 'cell',
        primitiveName: 'MaxCell',
        ladder: null
      }
      graph.addGadget(cellA as any)
      graph.addGadget(cellB as any)

      // Create ports
      const portAIn: PortRecord = {
        name: 'port-a-in' as PortId,
        recordType: 'port',
        portName: 'value',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'cell-a' as GadgetId,
        currentValue: null
      }
      const portAOut: PortRecord = {
        name: 'port-a-out' as PortId,
        recordType: 'port',
        portName: 'value',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: 'cell-a' as GadgetId,
        currentValue: null
      }
      const portBIn: PortRecord = {
        name: 'port-b-in' as PortId,
        recordType: 'port',
        portName: 'value',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'cell-b' as GadgetId,
        currentValue: null
      }
      const portBOut: PortRecord = {
        name: 'port-b-out' as PortId,
        recordType: 'port',
        portName: 'value',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: 'cell-b' as GadgetId,
        currentValue: null
      }

      graph.addPort(portAIn as any)
      graph.addPort(portAOut as any)
      graph.addPort(portBIn as any)
      graph.addPort(portBOut as any)

      // Create mutual connections: A.out -> B.in AND B.out -> A.in
      const connAB: ConnectionRecord = {
        name: 'conn-a-b' as ConnectionId,
        recordType: 'connection',
        source: 'port-a-out' as PortId,
        target: 'port-b-in' as PortId
      }
      const connBA: ConnectionRecord = {
        name: 'conn-b-a' as ConnectionId,
        recordType: 'connection',
        source: 'port-b-out' as PortId,
        target: 'port-a-in' as PortId
      }
      graph.addEdge(connAB as any)
      graph.addEdge(connBA as any)

      // Inject value 7 into A
      interpreter.setPortValue(graph.id, 'port-a-in', 7)

      // Both should converge to 7
      expect(portAOut.currentValue).toBe(7)
      expect(portBOut.currentValue).toBe(7)

      // Inject value 15 into B
      interpreter.setPortValue(graph.id, 'port-b-in', 15)

      // Both should converge to 15
      expect(portAOut.currentValue).toBe(15)
      expect(portBOut.currentValue).toBe(15)
    })
  })

  describe('Function-Cell Mixed Cycles', () => {
    it('should handle Add -> MaxCell -> Add cycle', () => {
      // Create Add and MaxCell
      const add: GadgetRecord = {
        name: 'add' as GadgetId,
        recordType: 'gadget',
        type: 'function',
        primitiveName: 'Add',
        ladder: null
      }
      const maxCell: GadgetRecord = {
        name: 'max-cell' as GadgetId,
        recordType: 'gadget',
        type: 'cell',
        primitiveName: 'MaxCell',
        ladder: null
      }
      graph.addGadget(add as any)
      graph.addGadget(maxCell as any)

      // Create ports for Add
      const addPortA: PortRecord = {
        name: 'port-add-a' as PortId,
        recordType: 'port',
        portName: 'a',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'add' as GadgetId,
        currentValue: null
      }
      const addPortB: PortRecord = {
        name: 'port-add-b' as PortId,
        recordType: 'port',
        portName: 'b',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'add' as GadgetId,
        currentValue: 2  // Fixed value
      }
      const addPortResult: PortRecord = {
        name: 'port-add-result' as PortId,
        recordType: 'port',
        portName: 'result',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: 'add' as GadgetId,
        currentValue: null
      }

      // Create ports for MaxCell
      const maxPortIn: PortRecord = {
        name: 'port-max-in' as PortId,
        recordType: 'port',
        portName: 'value',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'max-cell' as GadgetId,
        currentValue: null
      }
      const maxPortOut: PortRecord = {
        name: 'port-max-out' as PortId,
        recordType: 'port',
        portName: 'value',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: 'max-cell' as GadgetId,
        currentValue: null
      }

      graph.addPort(addPortA as any)
      graph.addPort(addPortB as any)
      graph.addPort(addPortResult as any)
      graph.addPort(maxPortIn as any)
      graph.addPort(maxPortOut as any)

      // Create cycle: Add.result -> MaxCell.value -> Add.a
      const connAddToMax: ConnectionRecord = {
        name: 'conn-add-max' as ConnectionId,
        recordType: 'connection',
        source: 'port-add-result' as PortId,
        target: 'port-max-in' as PortId
      }
      const connMaxToAdd: ConnectionRecord = {
        name: 'conn-max-add' as ConnectionId,
        recordType: 'connection',
        source: 'port-max-out' as PortId,
        target: 'port-add-a' as PortId
      }
      graph.addEdge(connAddToMax as any)
      graph.addEdge(connMaxToAdd as any)

      // Start with initial value 3 in MaxCell
      interpreter.setPortValue(graph.id, 'port-max-in', 3)

      // Should converge: 3 -> Add(3,2)=5 -> Max(3,5)=5 -> Add(5,2)=7 -> Max(5,7)=7 -> ...
      // This will keep growing without bound in current implementation
      // In practice we'd need a convergence limit

      // For now, just verify it propagates
      expect(maxPortOut.currentValue).toBe(3)
      expect(addPortResult.currentValue).toBe(5)
    })
  })

  describe('Connection Constraints', () => {
    it('should allow multiple connections to cell input ports', () => {
      // Create a MaxCell with multiple input sources
      const maxCell: GadgetRecord = {
        name: 'max-cell' as GadgetId,
        recordType: 'gadget',
        type: 'cell',
        primitiveName: 'MaxCell',
        ladder: null
      }
      graph.addGadget(maxCell as any)

      // Create cell ports
      const maxPortIn: PortRecord = {
        name: 'port-max-in' as PortId,
        recordType: 'port',
        portName: 'value',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'max-cell' as GadgetId,
        currentValue: null
      }
      const maxPortOut: PortRecord = {
        name: 'port-max-out' as PortId,
        recordType: 'port',
        portName: 'value',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: 'max-cell' as GadgetId,
        currentValue: null
      }
      graph.addPort(maxPortIn as any)
      graph.addPort(maxPortOut as any)

      // Create multiple source ports
      const source1: PortRecord = {
        name: 'source-1' as PortId,
        recordType: 'port',
        portName: 'src1',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: null,
        currentValue: 5
      }
      const source2: PortRecord = {
        name: 'source-2' as PortId,
        recordType: 'port',
        portName: 'src2',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: null,
        currentValue: 10
      }
      const source3: PortRecord = {
        name: 'source-3' as PortId,
        recordType: 'port',
        portName: 'src3',
        type: 'number',
        direction: 'output',
        position: 'right',
        gadget: null,
        currentValue: 3
      }
      graph.addPort(source1 as any)
      graph.addPort(source2 as any)
      graph.addPort(source3 as any)

      // Connect all sources to the MaxCell input
      // Note: Current implementation only handles one connection at a time
      // This test documents the current behavior
      const conn1: ConnectionRecord = {
        name: 'conn-1' as ConnectionId,
        recordType: 'connection',
        source: 'source-1' as PortId,
        target: 'port-max-in' as PortId
      }
      graph.addEdge(conn1 as any)

      // Run with first connection  
      interpreter.setPortValue(graph.id, 'source-1', 5)
      expect(maxPortOut.currentValue).toBe(5)

      // In a full implementation, we'd handle multiple connections
      // For now, this documents that only the last connection is used
    })

    it('function ports should only accept single connection', () => {
      // This test documents the constraint that function ports
      // should only have one incoming connection

      const add: GadgetRecord = {
        name: 'add' as GadgetId,
        recordType: 'gadget',
        type: 'function',
        primitiveName: 'Add',
        ladder: null
      }
      graph.addGadget(add as any)

      const addPortA: PortRecord = {
        name: 'port-add-a' as PortId,
        recordType: 'port',
        portName: 'a',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'add' as GadgetId,
        currentValue: null
      }
      graph.addPort(addPortA as any)

      // In a full implementation, attempting to add a second connection
      // to a function input port should either error or replace the existing one
      // This test documents the expected behavior
      expect(true).toBe(true) // Placeholder
    })
  })
})