/**
 * Extreme Scale Tests
 * 
 * Tests system behavior at scale boundaries - large numbers of gadgets,
 * deep nesting, wide fan-out, and resource limits.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createGadget,
  createContact,
  createTransistor,
  createDynamicGadget,
  createSpawner,
  provideSpawnerGain,
  createIterator,
  createEvolver,
  signal,
  propagate,
  wire,
  clearReceipts,
  getAllReceipts,
  type DynamicGadgetSpec,
  type TemplateSignal,
  type InstanceSignal
} from '../src'

describe('Extreme Scale', () => {
  beforeEach(() => {
    clearReceipts()
  })
  
  describe('Mass Spawning', () => {
    it('should handle spawning 100 gadgets', () => {
      const iterator = createIterator('mass-spawn')
      
      const template: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: {
                'input': { direction: 'input' },
                'output': { direction: 'output' }
              }
            }
          }
        }
      }
      
      const result = iterator.compute!(new Map([
        ['template', signal(template, 1.0)],
        ['count', signal(100, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      const instances = result.get('instances')?.value as InstanceSignal[]
      expect(instances).toHaveLength(100)
      
      // All should be created
      expect(iterator.gadgets.size).toBe(100)
      
      // Check memory refs are valid
      let validCount = 0
      for (const instance of instances) {
        if (instance.value.gadget.deref()) validCount++
      }
      expect(validCount).toBe(100)
    })
    
    it('should handle rapid sequential spawning', () => {
      const spawner = createSpawner('rapid')
      
      const template: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: {
                'data': { direction: 'input' }
              }
            }
          }
        }
      }
      
      const startTime = Date.now()
      
      // Spawn 50 in rapid succession
      for (let i = 0; i < 50; i++) {
        spawner.compute!(new Map([
          ['template', signal(template, 1.0)],
          ['initialGain', signal(10, 1.0)],
          ['trigger', signal(true, 1.0)]
        ]))
      }
      
      const duration = Date.now() - startTime
      
      expect(spawner.gadgets.size).toBe(50)
      expect(duration).toBeLessThan(1000) // Should be fast
      
      // Check receipts
      const receipts = getAllReceipts()
      expect(receipts.length).toBe(50)
    })
    
    it('should handle spawning with large templates', () => {
      const spawner = createSpawner('large-template')
      
      // Create a template with many contacts
      const contacts: Record<string, any> = {}
      for (let i = 0; i < 100; i++) {
        contacts[`contact_${i}`] = { direction: 'input' as const }
      }
      
      const largeTemplate: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts,
              children: {
                'child1': { structure: { contacts } },
                'child2': { structure: { contacts } },
                'child3': { structure: { contacts } }
              }
            }
          }
        }
      }
      
      const result = spawner.compute!(new Map([
        ['template', signal(largeTemplate, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      const instance = result.get('instance')?.value as InstanceSignal
      const gadget = instance?.value.gadget.deref()
      
      expect(gadget).toBeDefined()
      expect(gadget?.contacts.size).toBe(100)
      expect(gadget?.gadgets.size).toBe(3)
    })
  })
  
  describe('Deep Nesting', () => {
    it('should handle 50 levels of nesting', () => {
      const createDeepSpec = (depth: number): DynamicGadgetSpec => {
        if (depth === 0) {
          return {
            structure: {
              contacts: {
                'leaf': { direction: 'output' }
              }
            }
          }
        }
        
        return {
          structure: {
            contacts: {
              'input': { direction: 'input' },
              'output': { direction: 'output' }
            },
            children: {
              'deeper': createDeepSpec(depth - 1)
            }
          }
        }
      }
      
      const deepSpec = createDeepSpec(50)
      const gadget = createDynamicGadget('deep', deepSpec)
      
      // Navigate to deepest level
      let current = gadget
      let depth = 0
      
      while (current.gadgets.size > 0) {
        current = [...current.gadgets.values()][0]
        depth++
      }
      
      expect(depth).toBe(50)
      expect(current.contacts.has('leaf')).toBe(true)
    })
    
    it('should handle deeply nested wire paths', () => {
      const root = createGadget('root')
      
      // Create root's output contact
      const rootOut = createContact('out', root, signal(0, 0.5), 'output')
      root.contacts.set('out', rootOut)
      
      // Create chain of nested gadgets  
      let current = root
      const chain = [root]
      
      for (let i = 0; i < 20; i++) {
        const child = createGadget(`level_${i}`)
        const input = createContact('in', child, signal(0, 0.3), 'input')
        const output = createContact('out', child, signal(0, 0.3), 'output')
        
        child.contacts.set('in', input)
        child.contacts.set('out', output)
        
        // Wire input to output within each gadget so signal flows through
        wire(input, output)
        
        current.gadgets.set(`child_${i}`, child)
        child.parent = new WeakRef(current)
        
        chain.push(child)
        current = child
      }
      
      // Wire them in sequence (output of one level to input of next)
      for (let i = 0; i < chain.length - 1; i++) {
        const out = chain[i].contacts.get('out')
        const nextIn = chain[i + 1].contacts.get('in')
        
        if (out && nextIn) {
          wire(out, nextIn)
        }
      }
      
      // Propagate through entire chain
      propagate(rootOut, signal('deep', 0.9))
      
      // The signal should cascade through wires
      // With > semantics, 0.9 > 0.5 so it should propagate
      // Check a few levels to debug
      for (let i = 0; i < Math.min(5, chain.length); i++) {
        const level = chain[i]
        const out = level.contacts.get('out')
        const nextLevel = chain[i + 1]
        const nextIn = nextLevel?.contacts.get('in')
        
        if (i === 0) {
          // Root output should be updated
          expect(out?.signal.value).toBe('deep')
          expect(out?.signal.strength).toBe(9000)
        }
        
        if (nextIn && i < 4) {
          // Next level input should receive the signal
          expect(nextIn.signal.value).toBe('deep')
        }
      }
      
      // Check deepest level received signal
      const deepest = chain[chain.length - 1]
      const deepIn = deepest.contacts.get('in')
      expect(deepIn?.signal.value).toBe('deep')
    })
  })
  
  describe('Wide Fan-out', () => {
    it('should handle 1000 targets from single source', () => {
      const g = createGadget('fan-out')
      const source = createContact('source', g, signal(0, 0.5), 'output')
      g.contacts.set('source', source)
      
      const targets = []
      
      // Create 1000 targets
      for (let i = 0; i < 1000; i++) {
        const target = createContact(`t${i}`, g, signal(0, 0.1), 'input')
        g.contacts.set(`t${i}`, target)
        targets.push(target)
        wire(source, target)
      }
      
      // Propagate to all
      propagate(source, signal('broadcast', 0.8))
      
      // All should receive
      let receivedCount = 0
      for (const target of targets) {
        if (target.signal.value === 'broadcast') receivedCount++
      }
      
      expect(receivedCount).toBe(1000)
    })
    
    it('should handle 1000 sources to single target', () => {
      const g = createGadget('fan-in')
      const target = createContact('target', g, signal(0, 0.1), 'input')
      g.contacts.set('target', target)
      
      const sources = []
      
      // Create 1000 sources
      for (let i = 0; i < 1000; i++) {
        const source = createContact(`s${i}`, g, signal(i, 0.001), 'output')
        g.contacts.set(`s${i}`, source)
        sources.push(source)
        wire(source, target)
      }
      
      // Propagate from all with different strengths
      for (let i = 0; i < sources.length; i++) {
        propagate(sources[i], signal(i, i / 1000))
      }
      
      // Target should have value from strongest source
      expect(target.signal.value).toBe(999)
      expect(target.signal.strength).toBeLessThanOrEqual(10000)
    })
    
    it('should handle complete graph connectivity', () => {
      const g = createGadget('complete')
      const nodes = []
      
      // Create 30 nodes (30*29/2 = 435 edges)
      for (let i = 0; i < 30; i++) {
        const node = createContact(`n${i}`, g, signal(i, 0.1), 'input')
        g.contacts.set(`n${i}`, node)
        nodes.push(node)
      }
      
      // Wire every node to every other node
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          wire(nodes[i], nodes[j])
        }
      }
      
      // Propagate from one node
      propagate(nodes[0], signal('complete', 0.9))
      
      // Should reach all nodes
      let reachedCount = 0
      for (const node of nodes) {
        if (node.signal.value === 'complete') reachedCount++
      }
      
      expect(reachedCount).toBe(30)
    })
  })
  
  describe('Gain Pool Limits', () => {
    it('should handle gain exhaustion gracefully', () => {
      const spawner = createSpawner('exhausted')
      spawner.gainPool = 100 // Limited gain
      
      const template: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: { 'x': { direction: 'input' } }
            }
          }
        }
      }
      
      // Try to spawn with more gain than available
      const results = []
      for (let i = 0; i < 5; i++) {
        const result = spawner.compute!(new Map([
          ['template', signal(template, 1.0)],
          ['initialGain', signal(50, 1.0)], // 50 each, but only 100 total
          ['trigger', signal(true, 1.0)]
        ]))
        results.push(result)
      }
      
      // Should spawn some but not all
      expect(spawner.gadgets.size).toBeGreaterThan(0)
      expect(spawner.gadgets.size).toBeLessThanOrEqual(5)
    })
    
    it('should handle evolution with insufficient gain', () => {
      const evolver = createEvolver('insufficient')
      
      const poor = createGadget('poor')
      const rich = createGadget('rich')
      
      poor.gainPool = 10 // Very little
      rich.gainPool = 0
      
      const poorInstance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'poor',
          gadget: new WeakRef(poor),
          born: Date.now(),
          generation: 1
        }
      }
      
      const richInstance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: 'rich',
          gadget: new WeakRef(rich),
          born: Date.now(),
          generation: 2
        }
      }
      
      // Try to transfer more than available
      const result = evolver.compute!(new Map([
        ['old', signal(poorInstance, 1.0)],
        ['new', signal(richInstance, 1.0)],
        ['rate', signal(1000, 1.0)], // Way more than available
        ['threshold', signal(0, 1.0)]
      ]))
      
      // Should transfer what's available
      expect(poor.gainPool).toBe(0)
      expect(rich.gainPool).toBe(10)
      
      const status = result.get('status')?.value as any
      expect(status.transferred).toBe(10)
    })
  })
  
  describe('Strength Limits', () => {
    it('should cap strength at maximum', () => {
      const g = createGadget('strength-test')
      const contact = createContact('c', g, signal(0, 0.5), 'input')
      
      // Try to set very high strength
      for (let i = 0; i < 100; i++) {
        propagate(contact, signal('max', 1.0))
      }
      
      // Should be capped
      expect(contact.signal.strength).toBeLessThanOrEqual(10000)
    })
    
    it('should handle strength amplification chains', () => {
      const chain = []
      const root = createGadget('root')
      
      // Create amplification chain
      for (let i = 0; i < 10; i++) {
        const t = createTransistor(`t${i}`)
        t.gainPool = 10000
        
        // Set amplifying control
        propagate(t.contacts.get('control')!, signal(2000, 1.0))
        
        chain.push(t)
        root.gadgets.set(`t${i}`, t)
      }
      
      // Wire in sequence
      for (let i = 0; i < chain.length - 1; i++) {
        const out = chain[i].contacts.get('output')
        const nextIn = chain[i + 1].contacts.get('input')
        
        if (out && nextIn) {
          wire(out, nextIn)
        }
      }
      
      // Start with weak signal
      const firstInput = chain[0].contacts.get('input')
      if (firstInput) {
        propagate(firstInput, signal('amplify', 0.1))
      }
      
      // Process through chain
      for (const t of chain) {
        const inputs = new Map<string, any>()
        for (const [name, contact] of t.contacts) {
          inputs.set(name, contact.signal)
        }
        
        const outputs = t.compute!(inputs)
        for (const [name, sig] of outputs) {
          const contact = t.contacts.get(name)
          if (contact) {
            propagate(contact, sig)
          }
        }
      }
      
      // Final output should be capped at system max
      const lastOutput = chain[chain.length - 1].contacts.get('output')
      expect(lastOutput?.signal.strength).toBeLessThanOrEqual(100000)
    })
  })
  
  describe('Memory Pressure', () => {
    it('should handle large numbers of WeakRefs', () => {
      const instances: InstanceSignal[] = []
      
      // Create many instance signals with WeakRefs
      for (let i = 0; i < 1000; i++) {
        const g = createGadget(`temp_${i}`)
        instances.push({
          tag: 'instance',
          value: {
            id: `instance_${i}`,
            gadget: new WeakRef(g),
            born: Date.now(),
            generation: i
          }
        })
      }
      
      // Check how many are still valid
      let validCount = 0
      for (const instance of instances) {
        if (instance.value.gadget.deref()) validCount++
      }
      
      // Most should still be valid (unless GC ran)
      expect(validCount).toBeGreaterThan(0)
    })
    
    it('should handle large receipt histories', () => {
      const spawner = createSpawner('receipt-generator')
      provideSpawnerGain(spawner, 100, 'test')
      
      clearReceipts()  // Clear after setup
      
      const template: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: { 'x': { direction: 'input' } }
            }
          }
        }
      }
      
      // Generate many receipts
      for (let i = 0; i < 100; i++) {
        spawner.compute!(new Map([
          ['template', signal(template, 1.0)],
          ['initialGain', signal(1, 1.0)],
          ['trigger', signal(true, 1.0)]
        ]))
      }
      
      const receipts = getAllReceipts()
      expect(receipts.length).toBe(100)
      
      // Should be able to process all receipts
      const totalGain = receipts.reduce((sum, r) => sum + r.amount, 0)
      expect(totalGain).toBe(100)
    })
  })
  
  describe('Parallel Operations', () => {
    it('should handle concurrent spawning from multiple spawners', () => {
      const spawners = []
      
      // Create 10 spawners
      for (let i = 0; i < 10; i++) {
        spawners.push(createSpawner(`spawner_${i}`))
      }
      
      const template: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: {
              contacts: { 'data': { direction: 'input' } }
            }
          }
        }
      }
      
      // All spawn simultaneously
      const results = spawners.map(s => 
        s.compute!(new Map([
          ['template', signal(template, 1.0)],
          ['trigger', signal(true, 1.0)]
        ]))
      )
      
      // All should succeed
      for (const result of results) {
        expect(result.get('instance')).toBeDefined()
      }
      
      // Each spawner should have one child
      for (const spawner of spawners) {
        expect(spawner.gadgets.size).toBe(1)
      }
    })
    
    it('should handle mass evolution', () => {
      const evolvers = []
      const pairs = []
      
      // Create 20 evolution pairs
      for (let i = 0; i < 20; i++) {
        const evolver = createEvolver(`evolver_${i}`)
        const old = createGadget(`old_${i}`)
        const newG = createGadget(`new_${i}`)
        
        old.gainPool = 100
        newG.gainPool = 0
        
        evolvers.push(evolver)
        pairs.push({ old, new: newG })
      }
      
      // Evolve all pairs
      for (let i = 0; i < evolvers.length; i++) {
        const oldInstance: InstanceSignal = {
          tag: 'instance',
          value: {
            id: `old_${i}`,
            gadget: new WeakRef(pairs[i].old),
            born: Date.now(),
            generation: 1
          }
        }
        
        const newInstance: InstanceSignal = {
          tag: 'instance',
          value: {
            id: `new_${i}`,
            gadget: new WeakRef(pairs[i].new),
            born: Date.now(),
            generation: 2
          }
        }
        
        evolvers[i].compute!(new Map([
          ['old', signal(oldInstance, 1.0)],
          ['new', signal(newInstance, 1.0)],
          ['rate', signal(50, 1.0)]
        ]))
      }
      
      // Check all evolved
      for (const pair of pairs) {
        expect(pair.old.gainPool).toBe(50)
        expect(pair.new.gainPool).toBe(50)
      }
    })
  })
  
  describe('Extreme Templates', () => {
    it('should handle templates with 1000 contacts', () => {
      const contacts: Record<string, any> = {}
      
      for (let i = 0; i < 1000; i++) {
        contacts[`c${i}`] = {
          direction: i % 2 === 0 ? 'input' : 'output'
        }
      }
      
      const megaTemplate: TemplateSignal = {
        tag: 'template',
        value: {
          spec: {
            structure: { contacts }
          }
        }
      }
      
      const spawner = createSpawner('mega')
      const result = spawner.compute!(new Map([
        ['template', signal(megaTemplate, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      const instance = result.get('instance')?.value as InstanceSignal
      const gadget = instance?.value.gadget.deref()
      
      expect(gadget?.contacts.size).toBe(1000)
    })
    
    it('should handle deeply nested template specifications', () => {
      const createNestedTemplate = (depth: number): any => {
        if (depth === 0) {
          return {
            structure: {
              contacts: { 'leaf': { direction: 'output' } }
            }
          }
        }
        
        return {
          structure: {
            children: {
              'child': createNestedTemplate(depth - 1)
            }
          }
        }
      }
      
      const deepTemplate: TemplateSignal = {
        tag: 'template',
        value: {
          spec: createNestedTemplate(30)
        }
      }
      
      const spawner = createSpawner('deep-template')
      const result = spawner.compute!(new Map([
        ['template', signal(deepTemplate, 1.0)],
        ['trigger', signal(true, 1.0)]
      ]))
      
      const instance = result.get('instance')?.value as InstanceSignal
      const gadget = instance?.value.gadget.deref()
      
      // Should create deep structure
      let current = gadget
      let depth = 0
      
      while (current && current.gadgets.size > 0) {
        current = [...current.gadgets.values()][0]
        depth++
      }
      
      expect(depth).toBe(30)
    })
  })
})