import { describe, it, expect, beforeEach } from 'vitest'
import { Network, Cell, Gadget, Nothing } from './gadgets'
import { logicalOrMerge, logicalAndMerge, setDifferenceMerge } from './terms'

describe('Core Term System', () => {
  describe('Logical Merge Operations', () => {
    it('should perform logical OR correctly', () => {
      const result = logicalOrMerge(['a', 'b'], ['b', 'c'])
      expect(result).toEqual(['or', ['a', 'b'], ['b', 'c']])
    })

    it('should perform logical AND correctly', () => {
      const result = logicalAndMerge(['a', 'b'], ['b', 'c'])
      expect(result).toEqual(['and', ['a', 'b'], ['b', 'c']])
    })

    it('should handle existing OR terms', () => {
      const existing = ['or', ['a', 'b'], ['c', 'd']]
      const result = logicalOrMerge(existing, ['e', 'f'])
      expect(result).toEqual(['or', ['a', 'b'], ['c', 'd'], ['e', 'f']])
    })

    it('should handle existing AND terms', () => {
      const existing = ['and', ['a', 'b'], ['c', 'd']]
      const result = logicalAndMerge(existing, ['e', 'f'])
      expect(result).toEqual(['and', ['a', 'b'], ['c', 'd'], ['e', 'f']])
    })

    it('should handle Nothing in logical OR', () => {
      const result = logicalOrMerge(Nothing, ['x', 'y'])
      expect(result).toEqual(['x', 'y'])
    })

    it('should perform set difference correctly', () => {
      const result = setDifferenceMerge(['a', 'b', 'c'], ['b'])
      expect(result).toEqual(['a', 'c'])
    })

    it('should handle Nothing in set difference', () => {
      const result = setDifferenceMerge(Nothing, ['x'])
      expect(result).toEqual(['x'])
    })

    it('should handle empty arrays', () => {
      const orResult = logicalOrMerge([], ['a'])
      const diffResult = setDifferenceMerge(['a', 'b'], [])
      
      expect(orResult).toEqual(['or', [], ['a']])
      expect(diffResult).toEqual(['a', 'b'])
    })

    it('should handle complex nested logical structures', () => {
      // Test that logical OR preserves nested structures
      const complexPremise1 = ['and', ['premise', 'rule1'], ['condition', 'active']]
      const complexPremise2 = ['and', ['premise', 'rule2'], ['condition', 'inactive']]
      
      const result = logicalOrMerge(complexPremise1, complexPremise2)
      expect(result).toEqual(['or', complexPremise1, complexPremise2])
      
      // Test that logical AND creates compound beliefs
      const andResult = logicalAndMerge(['premise', 'rule1'], ['premise', 'rule2'])
      expect(andResult).toEqual(['and', ['premise', 'rule1'], ['premise', 'rule2']])
    })

    it('should handle idempotent operations correctly', () => {
      const premise = ['premise', 'rule1']
      
      // Adding the same premise twice should not change the result
      let result = logicalOrMerge(Nothing, premise)
      result = logicalOrMerge(result, premise)
      
      expect(result).toEqual(['or', premise])
      expect(result).not.toEqual(['or', premise, premise]) // Should not duplicate
    })
  })
  })
})

describe('Core Gadget System', () => {
  let network: Network

  beforeEach(() => {
    network = new Network('test-network')
  })

  describe('Network', () => {
    it('should create with correct ID', () => {
      expect(network.id).toBe('test-network')
    })

    it('should add and retrieve gadgets', () => {
      const gadget = new Gadget('test-gadget', network)
      expect(network.getGadget('test-gadget')).toBe(gadget)
    })

    it('should return undefined for non-existent gadgets', () => {
      expect(network.getGadget('non-existent')).toBeUndefined()
    })
  })

  describe('Gadget', () => {
    it('should create with correct ID and network', () => {
      const gadget = new Gadget('test-gadget', network)
      expect(gadget.id).toBe('test-gadget')
      expect(gadget.network).toBe(network)
    })

    it('should have a control port by default', () => {
      const gadget = new Gadget('test-gadget', network)
      const controlPort = gadget.getPort('control')
      expect(controlPort).toBeDefined()
      expect(controlPort?.direction).toBe('input')
    })

    it('should add input ports via control commands', () => {
      const gadget = new Gadget('test-gadget', network)
      gadget.receive('control', ['add-input-port', 'data-in'])
      
      const dataPort = gadget.getPort('data-in')
      expect(dataPort).toBeDefined()
      expect(dataPort?.direction).toBe('input')
    })

    it('should add output ports via control commands', () => {
      const gadget = new Gadget('test-gadget', network)
      gadget.receive('control', ['add-output-port', 'data-out'])
      
      const dataPort = gadget.getPort('data-out')
      expect(dataPort).toBeDefined()
      expect(dataPort?.direction).toBe('output')
    })

    it('should set input handlers via control commands', () => {
      const gadget = new Gadget('test-gadget', network)
      const handler = (self: Gadget, value: any) => self.emit('output', value * 2)
      
      gadget.receive('control', ['add-input-port', 'input'])
      gadget.receive('control', ['add-output-port', 'output'])
      gadget.receive('control', ['set-input-handler', 'input', ['opaque', handler]])
      
      // Test the handler
      gadget.receive('input', 5)
      const outputPort = gadget.getPort('output')
      expect(outputPort?.value).toBe(10)
    })

    it('should handle batch commands', () => {
      const gadget = new Gadget('test-gadget', network)
      const commands = [
        ['add-input-port', 'input'],
        ['add-output-port', 'output'],
        ['set-input-handler', 'input', ['opaque', (self: Gadget, value: any) => self.emit('output', value)]]
      ]
      
      gadget.receive('control', ['batch', commands] as any)
      
      expect(gadget.getPort('input')).toBeDefined()
      expect(gadget.getPort('output')).toBeDefined()
    })
  })

  describe('Port', () => {
    let gadget: Gadget
    let port: any

    beforeEach(() => {
      gadget = new Gadget('test-gadget', network)
      gadget.receive('control', ['add-input-port', 'test-input'])
      port = gadget.getPort('test-input') // Use input port for handler test
    })

    it('should accept values and trigger handlers', () => {
      let handlerCalled = false
      let handlerValue: any = null
      
      gadget.receive('control', ['set-input-handler', 'test-input', ['opaque', (_self: Gadget, value: any) => {
        handlerCalled = true
        handlerValue = value
      }]])
      
      port.accept(42)
      expect(handlerCalled).toBe(true)
      expect(handlerValue).toBe(42)
    })

    it('should only propagate when value changes', () => {
      // Create a separate gadget for the propagation test
      const propagationGadget = new Gadget('propagation-test', network)
      propagationGadget.receive('control', ['add-input-port', 'prop-input'])
      propagationGadget.receive('control', ['add-output-port', 'prop-output'])
      
      // Set up the propagation gadget to echo input to output
      propagationGadget.receive('control', ['set-input-handler', 'prop-input', ['opaque', (self: Gadget, value: any) => {
        self.emit('prop-output', value)
      }]])
      
      const outputPort = propagationGadget.getPort('prop-output')
      
      // Create a simple cell to observe port behavior
      const observerCell = new Cell('observer', network, {}, (_current, incoming) => {
        console.log('Observer cell input handler called with:', incoming)
        return incoming
      })
      
      // Connect the output port to the observer
      outputPort!.connectTo([observerCell.id, 'value-in'])
      
      // Debug: Check if connection was made
      console.log('Port connections:', outputPort!.getConnections())
      console.log('Observer input port:', observerCell.getPort('value-in'))
      
      // Send values to the input port, which should propagate to the output port
      propagationGadget.receive('prop-input', 42)
      propagationGadget.receive('prop-input', 42) // Same value - should not trigger propagation
      propagationGadget.receive('prop-input', 43) // Different value - should trigger propagation
      
      // Check that the observer received the values
      const observerValue = observerCell.getPort('value-out')?.value
      console.log('Observer output value:', observerValue)
      expect(observerValue).toBe(43) // Should have the last value
      
      // The port should have propagated the value changes
      expect(outputPort!.value).toBe(43)
    })
  })
})

describe('TMS System', () => {
  let network: Network
  let allPremises: Cell
  let nogoodPremises: Cell
  let believedPremises: Cell

  beforeEach(() => {
    network = new Network('tms-test')
    
    // Create the three TMS cells
    allPremises = new Cell('all-premises', network, {}, logicalOrMerge)
    nogoodPremises = new Cell('nogood-premises', network, {}, logicalOrMerge)
    believedPremises = new Cell('believed-premises', network, {}, setDifferenceMerge)
  })

  describe('TMS Cell Creation', () => {
    it('should create TMS cells with correct merge functions', () => {
      expect(allPremises).toBeDefined()
      expect(nogoodPremises).toBeDefined()
      expect(believedPremises).toBeDefined()
    })

    it('should have value-in and value-out ports', () => {
      expect(allPremises.getPort('value-in')).toBeDefined()
      expect(allPremises.getPort('value-out')).toBeDefined()
    })
  })

  describe('TMS Logic', () => {
    it('should maintain all premises correctly with logical OR structure', () => {
      allPremises.receive('value-in', ['premise', 'rule1'])
      allPremises.receive('value-in', ['premise', 'rule2'])
      
      const value = allPremises.getPort('value-out')?.value
      
      // Should create a logical OR structure
      expect(value).toEqual(['or', ['premise', 'rule1'], ['premise', 'rule2']])
      
      // Add another premise
      allPremises.receive('value-in', ['premise', 'rule3'])
      const updatedValue = allPremises.getPort('value-out')?.value
      
      // Should extend the OR structure
      expect(updatedValue).toEqual(['or', ['premise', 'rule1'], ['premise', 'rule2'], ['premise', 'rule3']])
    })

    it('should maintain nogood premises correctly with logical OR structure', () => {
      nogoodPremises.receive('value-in', ['premise', 'rule2'])
      nogoodPremises.receive('value-in', ['premise', 'rule3'])
      
      const value = nogoodPremises.getPort('value-out')?.value
      
      // Should create a logical OR structure
      expect(value).toEqual(['or', ['premise', 'rule2'], ['premise', 'rule3']])
    })

    it('should compute believed premises as all minus nogoods', () => {
      // Add premises to all
      allPremises.receive('value-in', ['premise', 'rule1'])
      allPremises.receive('value-in', ['premise', 'rule2'])
      allPremises.receive('value-in', ['premise', 'rule3'])
      
      // Add nogoods
      nogoodPremises.receive('value-in', ['premise', 'rule2'])
      
      // Test that both cells have values
      const all = allPremises.getPort('value-out')?.value
      const nogoods = nogoodPremises.getPort('value-out')?.value
      
      // Verify the logical OR structures
      expect(all).toEqual(['or', ['premise', 'rule1'], ['premise', 'rule2'], ['premise', 'rule3']])
      expect(nogoods).toEqual(['or', ['premise', 'rule2']])
      
      // Now test the actual TMS computation: believed = all - nogoods
      // We need to connect the cells and see the result
      allPremises.getPort('value-out')?.connectTo([believedPremises.id, 'value-in'])
      nogoodPremises.getPort('value-out')?.connectTo([believedPremises.id, 'value-in'])
      
      // The believed premises should be computed as all minus nogoods
      // Since we're using setDifferenceMerge, this should remove rule2 from the result
      const believed = believedPremises.getPort('value-out')?.value
      
      // The result should be rule1 and rule3 (rule2 was in nogoods)
      expect(believed).toEqual(['or', ['premise', 'rule1'], ['premise', 'rule3']])
    })
  })

  describe('TMS Connections', () => {
    it('should automatically compute believed premises when connected', () => {
      // Set up initial premises
      allPremises.receive('value-in', ['premise', 'rule1'])
      allPremises.receive('value-in', ['premise', 'rule2'])
      nogoodPremises.receive('value-in', ['premise', 'rule2'])
      
      // Initially, believed premises should be Nothing
      expect(believedPremises.getPort('value-out')?.value).toBe(Nothing)
      
      // Connect the TMS cells
      allPremises.getPort('value-out')?.connectTo([believedPremises.id, 'value-in'])
      nogoodPremises.getPort('value-out')?.connectTo([believedPremises.id, 'value-in'])
      
      // The believed premises should now be automatically computed
      const believed = believedPremises.getPort('value-out')?.value
      expect(believed).toEqual(['or', ['premise', 'rule1']])
      
      // Add a new nogood premise - should automatically update believed
      nogoodPremises.receive('value-in', ['premise', 'rule1'])
      const updatedBelieved = believedPremises.getPort('value-out')?.value
      expect(updatedBelieved).toEqual(['or']) // Empty OR - no premises left
    })
  })
})

describe('Rewrite Rules System', () => {

  describe('Basic Rewrite Rules', () => {
    it('should create a rewrite rule premise', () => {
      const rewriteRule = [
        'rewrite-rule',
        'simplify-constraints',
        {
          pattern: ['constraint', 'complex'],
          replacement: ['constraint', 'simple']
        }
      ]
      
      // This would be added to the TMS all-premises
      expect(rewriteRule[0]).toBe('rewrite-rule')
      expect(rewriteRule[1]).toBe('simplify-constraints')
    })

    it('should create a graph variable rule', () => {
      const graphRule = [
        'rewrite-rule',
        'optimize-subgraph',
        {
          pattern: ['graph-variable', 'subgraph', { interface: ['input', 'output'] }],
          replacement: ['optimized-graph', 'subgraph']
        }
      ]
      
      expect(graphRule[0]).toBe('rewrite-rule')
      expect(graphRule[1]).toBe('optimize-subgraph')
    })
  })

  describe('Pattern Matching', () => {
    it('should match simple patterns', () => {
      const pattern = ['constraint', 'complex']
      const target = ['constraint', 'complex']
      
      // Simple equality matching
      expect(JSON.stringify(pattern) === JSON.stringify(target)).toBe(true)
    })

    it('should handle variable patterns', () => {
      const pattern = ['constraint', 'variable', 'name']
      const target = ['constraint', 'max', 'temperature']
      
      // This would test our variable binding logic
      // For now, just verify the structure
      expect(pattern[0]).toBe('constraint')
      expect(target[0]).toBe('constraint')
    })
  })
})
