import { describe, it, expect, beforeEach } from 'vitest'
import { GraphRegistry } from './index'
import { GadgetRecord, PortRecord, GraphId, PortId, GadgetId } from './types'

describe('PortGraph', () => {
  let registry: GraphRegistry
  
  beforeEach(() => {
    registry = new GraphRegistry()
  })
  
  describe('validateLadder', () => {
    it('should validate matching semantic properties', () => {
      const mainGraph = registry.newGraph('graph-main' as GraphId)
      const ladderGraph = registry.newGraph('graph-ladder' as GraphId)
      
      // Add a gadget with ports to main graph
      const gadget: GadgetRecord = {
        name: 'gadget-1' as GadgetId,
        recordType: 'gadget',
        type: 'processor',
        ladder: null
      }
      mainGraph.addGadget(gadget)
      
      // Add ports to the gadget
      const port1: PortRecord = {
        name: 'port-1' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-1' as GadgetId,
        currentValue: null
      }
      const port2: PortRecord = {
        name: 'port-2' as PortId,
        recordType: 'port',
        type: 'string',
        direction: 'output',
        position: 'right',
        gadget: 'gadget-1' as GadgetId,
        currentValue: null
      }
      mainGraph.addPort(port1)
      mainGraph.addPort(port2)
      
      // Add matching free ports to ladder graph
      const ladderPort1: PortRecord = {
        name: 'port-1' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: null,
        currentValue: null
      }
      const ladderPort2: PortRecord = {
        name: 'port-2' as PortId,
        recordType: 'port',
        type: 'string',
        direction: 'output',
        position: 'right',
        gadget: null,
        currentValue: null
      }
      ladderGraph.addPort(ladderPort1)
      ladderGraph.addPort(ladderPort2)
      
      expect(mainGraph.validateLadder('gadget-1' as GadgetId, 'graph-ladder' as GraphId)).toBe(true)
    })
    
    it('should fail validation with mismatched types', () => {
      const mainGraph = registry.newGraph('graph-main' as GraphId)
      const ladderGraph = registry.newGraph('graph-ladder' as GraphId)
      
      const gadget: GadgetRecord = {
        name: 'gadget-1' as GadgetId,
        recordType: 'gadget',
        type: 'processor',
        ladder: null
      }
      mainGraph.addGadget(gadget)
      
      const port1: PortRecord = {
        name: 'port-1' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-1' as GadgetId,
        currentValue: null
      }
      mainGraph.addPort(port1)
      
      // Ladder port with different type
      const ladderPort1: PortRecord = {
        name: 'port-1' as PortId,
        recordType: 'port',
        type: 'string', // Different type!
        direction: 'input',
        position: 'left',
        gadget: null,
        currentValue: null
      }
      ladderGraph.addPort(ladderPort1)
      
      expect(mainGraph.validateLadder('gadget-1' as GadgetId, 'graph-ladder' as GraphId)).toBe(false)
    })
    
    it('should fail validation with mismatched directions', () => {
      const mainGraph = registry.newGraph('graph-main' as GraphId)
      const ladderGraph = registry.newGraph('graph-ladder' as GraphId)
      
      const gadget: GadgetRecord = {
        name: 'gadget-1' as GadgetId,
        recordType: 'gadget',
        type: 'processor',
        ladder: null
      }
      mainGraph.addGadget(gadget)
      
      const port1: PortRecord = {
        name: 'port-1' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'input',
        position: 'left',
        gadget: 'gadget-1' as GadgetId,
        currentValue: null
      }
      mainGraph.addPort(port1)
      
      // Ladder port with different direction
      const ladderPort1: PortRecord = {
        name: 'port-1' as PortId,
        recordType: 'port',
        type: 'number',
        direction: 'output', // Different direction!
        position: 'left',
        gadget: null,
        currentValue: null
      }
      ladderGraph.addPort(ladderPort1)
      
      expect(mainGraph.validateLadder('gadget-1' as GadgetId, 'graph-ladder' as GraphId)).toBe(false)
    })
  })
  
  describe('flatten', () => {
    it('should collect a single graph with no ladders', () => {
      const graph = registry.newGraph('graph-1' as GraphId)
      
      const gadget: GadgetRecord = {
        name: 'gadget-1' as GadgetId,
        recordType: 'gadget',
        type: 'processor',
        ladder: null
      }
      graph.addGadget(gadget)
      
      const result = graph.flatten()
      
      expect(Object.keys(result)).toEqual(['graph-1'])
      expect(result['graph-1' as GraphId]).toHaveProperty('gadget-1')
    })
    
    it('should collect nested ladder graphs', () => {
      const graphA = registry.newGraph('graph-A' as GraphId)
      const graphB = registry.newGraph('graph-B' as GraphId)
      const graphC = registry.newGraph('graph-C' as GraphId)
      
      // Graph C - leaf graph
      const gadgetC: GadgetRecord = {
        name: 'gadget-c' as GadgetId,
        recordType: 'gadget',
        type: 'leaf',
        ladder: null
      }
      graphC.addGadget(gadgetC)
      
      // Graph B - references C
      const gadgetB: GadgetRecord = {
        name: 'gadget-b' as GadgetId,
        recordType: 'gadget',
        type: 'middle',
        ladder: 'graph-C' as GraphId
      }
      graphB.addGadget(gadgetB)
      
      // Graph A - references B
      const gadgetA: GadgetRecord = {
        name: 'gadget-a' as GadgetId,
        recordType: 'gadget',
        type: 'root',
        ladder: 'graph-B' as GraphId
      }
      graphA.addGadget(gadgetA)
      
      const result = graphA.flatten()
      
      expect(Object.keys(result).sort()).toEqual(['graph-A', 'graph-B', 'graph-C'])
      expect(result['graph-A' as GraphId]).toHaveProperty('gadget-a')
      expect(result['graph-B' as GraphId]).toHaveProperty('gadget-b')
      expect(result['graph-C' as GraphId]).toHaveProperty('gadget-c')
    })
    
    it('should handle circular references gracefully', () => {
      const graphA = registry.newGraph('graph-A' as GraphId)
      const graphB = registry.newGraph('graph-B' as GraphId)
      
      // Graph A references B
      const gadgetA: GadgetRecord = {
        name: 'gadget-a' as GadgetId,
        recordType: 'gadget',
        type: 'a-type',
        ladder: 'graph-B' as GraphId
      }
      graphA.addGadget(gadgetA)
      
      // Graph B references A (circular)
      const gadgetB: GadgetRecord = {
        name: 'gadget-b' as GadgetId,
        recordType: 'gadget',
        type: 'b-type',
        ladder: 'graph-A' as GraphId
      }
      graphB.addGadget(gadgetB)
      
      const result = graphA.flatten()
      
      // Should still collect both graphs without infinite loop
      expect(Object.keys(result).sort()).toEqual(['graph-A', 'graph-B'])
    })
    
    it('should handle multiple gadgets with same ladder', () => {
      const graphA = registry.newGraph('graph-A' as GraphId)
      const graphB = registry.newGraph('graph-B' as GraphId)
      
      // Graph B - shared ladder
      const gadgetB: GadgetRecord = {
        name: 'gadget-b' as GadgetId,
        recordType: 'gadget',
        type: 'shared',
        ladder: null
      }
      graphB.addGadget(gadgetB)
      
      // Graph A - multiple gadgets referencing same ladder
      const gadget1: GadgetRecord = {
        name: 'gadget-1' as GadgetId,
        recordType: 'gadget',
        type: 'instance1',
        ladder: 'graph-B' as GraphId
      }
      const gadget2: GadgetRecord = {
        name: 'gadget-2' as GadgetId,
        recordType: 'gadget',
        type: 'instance2',
        ladder: 'graph-B' as GraphId
      }
      graphA.addGadget(gadget1)
      graphA.addGadget(gadget2)
      
      const result = graphA.flatten()
      
      expect(Object.keys(result).sort()).toEqual(['graph-A', 'graph-B'])
      // Graph B should only appear once despite multiple references
      expect(Object.keys(result['graph-B' as GraphId])).toEqual(['gadget-b'])
    })
  })
})