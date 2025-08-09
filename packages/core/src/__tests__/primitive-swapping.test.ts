/**
 * Tests for primitive swapping - demonstrating how the same network
 * can have different behaviors by loading different primitive implementations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Kernel } from '../kernel/kernel'
import { UserspaceRuntime } from '../kernel/userspace-runtime'
import { PrimitiveLoaderDriver } from '../kernel/drivers/primitive-loader-driver'
import { brand } from '../types'
import type { PrimitiveGadget } from '../types'

describe('Primitive Swapping', () => {
  let kernel: Kernel
  let runtime: UserspaceRuntime
  let primitiveLoader: PrimitiveLoaderDriver
  
  beforeEach(async () => {
    kernel = new Kernel({ debug: false })
    runtime = new UserspaceRuntime({ kernel })
    
    // Initialize system drivers
    await kernel.initializeSystemDrivers()
    kernel.setUserspaceRuntime(runtime)
    
    primitiveLoader = kernel.getPrimitiveLoader()!
    expect(primitiveLoader).toBeDefined()
  })
  
  describe('Basic arithmetic network with swappable operations', () => {
    let rootGroupId: string
    let contactA: string
    let contactB: string
    let contactC: string
    let adderGadgetId: string
    
    beforeEach(async () => {
      // Create a basic network: a + b = c
      rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Test Network',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create input contacts
      contactA = await runtime.addContact(rootGroupId, {
        content: 5,
        blendMode: 'accept-last'
      })
      
      contactB = await runtime.addContact(rootGroupId, {
        content: 3,
        blendMode: 'accept-last'
      })
      
      // Create output contact
      contactC = await runtime.addContact(rootGroupId, {
        content: undefined,
        blendMode: 'accept-last'
      })
    })
    
    it('should use standard addition by default', async () => {
      // Create an adder gadget using the default implementation
      adderGadgetId = await runtime.createPrimitiveGadget('@bassline/core/add', rootGroupId)
      
      // Get the gadget state to find boundary contacts
      const gadgetState = await runtime.getState(adderGadgetId)
      expect(gadgetState).toBeDefined()
      
      // Find input and output boundary contacts
      const inputA = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'a' && c.boundaryDirection === 'input')
      const inputB = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'b' && c.boundaryDirection === 'input')
      const output = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'sum' && c.boundaryDirection === 'output')
      
      expect(inputA).toBeDefined()
      expect(inputB).toBeDefined()
      expect(output).toBeDefined()
      
      // Wire up the network
      await runtime.connect(contactA, inputA!.id)
      await runtime.connect(contactB, inputB!.id)
      await runtime.connect(output!.id, contactC)
      
      // Check the result
      const outputContact = (await runtime.getState(rootGroupId)).contacts.get(contactC)
      expect(outputContact?.content).toBe(8) // 5 + 3 = 8
    })
    
    it('should swap to subtraction behavior', async () => {
      // Load a custom module where "add" actually subtracts
      await primitiveLoader.loadModule({
        type: 'builtin',
        module: async () => ({
          add: (): PrimitiveGadget => ({
            id: 'add',
            name: 'Subtract (Disguised as Add)',
            inputs: ['a', 'b'],
            outputs: ['sum'],
            activation: (inputs) => inputs.has('a') && inputs.has('b'),
            body: async (inputs) => {
              const a = Number(inputs.get('a')) || 0
              const b = Number(inputs.get('b')) || 0
              return new Map([['sum', a - b]]) // Subtract instead!
            },
            description: 'Actually subtracts instead of adding',
            category: 'math'
          })
        }),
        namespace: '@alternative/math'
      })
      
      // Create gadget with the alternative implementation
      adderGadgetId = await runtime.createPrimitiveGadget('@alternative/math/add', rootGroupId)
      
      // Wire up the same network
      const gadgetState = await runtime.getState(adderGadgetId)
      const inputA = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'a' && c.boundaryDirection === 'input')
      const inputB = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'b' && c.boundaryDirection === 'input')
      const output = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'sum' && c.boundaryDirection === 'output')
      
      await runtime.connect(contactA, inputA!.id)
      await runtime.connect(contactB, inputB!.id)
      await runtime.connect(output!.id, contactC)
      
      // Check the result - should subtract
      const outputContact = (await runtime.getState(rootGroupId)).contacts.get(contactC)
      expect(outputContact?.content).toBe(2) // 5 - 3 = 2
    })
    
    it('should swap to multiplication behavior', async () => {
      // Load a module where "add" multiplies
      await primitiveLoader.loadModule({
        type: 'builtin',
        module: async () => ({
          add: (): PrimitiveGadget => ({
            id: 'add',
            name: 'Multiply (Disguised as Add)',
            inputs: ['a', 'b'],
            outputs: ['sum'],
            activation: (inputs) => inputs.has('a') && inputs.has('b'),
            body: async (inputs) => {
              const a = Number(inputs.get('a')) || 0
              const b = Number(inputs.get('b')) || 0
              return new Map([['sum', a * b]]) // Multiply instead!
            },
            description: 'Actually multiplies instead of adding',
            category: 'math'
          })
        }),
        namespace: '@multiply/math'
      })
      
      // Create gadget with multiplication behavior
      adderGadgetId = await runtime.createPrimitiveGadget('@multiply/math/add', rootGroupId)
      
      // Wire up the same network
      const gadgetState = await runtime.getState(adderGadgetId)
      const inputA = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'a' && c.boundaryDirection === 'input')
      const inputB = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'b' && c.boundaryDirection === 'input')
      const output = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'sum' && c.boundaryDirection === 'output')
      
      await runtime.connect(contactA, inputA!.id)
      await runtime.connect(contactB, inputB!.id)
      await runtime.connect(output!.id, contactC)
      
      // Check the result - should multiply
      const outputContact = (await runtime.getState(rootGroupId)).contacts.get(contactC)
      expect(outputContact?.content).toBe(15) // 5 * 3 = 15
    })
    
    it('should swap to delayed addition behavior', async () => {
      vi.useFakeTimers()
      
      // Load a module where "add" has a delay
      await primitiveLoader.loadModule({
        type: 'builtin',
        module: async () => ({
          add: (): PrimitiveGadget => ({
            id: 'add',
            name: 'Delayed Add',
            inputs: ['a', 'b'],
            outputs: ['sum'],
            activation: (inputs) => inputs.has('a') && inputs.has('b'),
            body: async (inputs) => {
              const a = Number(inputs.get('a')) || 0
              const b = Number(inputs.get('b')) || 0
              
              // Wait 5 seconds before returning result
              await new Promise(resolve => setTimeout(resolve, 5000))
              
              return new Map([['sum', a + b]])
            },
            description: 'Adds with a 5 second delay',
            category: 'math',
            isPure: false // Has timing side effects
          })
        }),
        namespace: '@delayed/math'
      })
      
      // Create gadget with delayed behavior
      adderGadgetId = await runtime.createPrimitiveGadget('@delayed/math/add', rootGroupId)
      
      // Wire up the network
      const gadgetState = await runtime.getState(adderGadgetId)
      const inputA = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'a' && c.boundaryDirection === 'input')
      const inputB = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'b' && c.boundaryDirection === 'input')
      const output = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'sum' && c.boundaryDirection === 'output')
      
      const connectPromise = Promise.all([
        runtime.connect(contactA, inputA!.id),
        runtime.connect(contactB, inputB!.id),
        runtime.connect(output!.id, contactC)
      ])
      
      // Initially, output should be undefined (still waiting)
      let outputContact = (await runtime.getState(rootGroupId)).contacts.get(contactC)
      expect(outputContact?.content).toBeUndefined()
      
      // Advance time and wait for propagation
      vi.advanceTimersByTime(5000)
      await connectPromise
      
      // Now check the result - should have the sum after delay
      outputContact = (await runtime.getState(rootGroupId)).contacts.get(contactC)
      expect(outputContact?.content).toBe(8) // 5 + 3 = 8 (after delay)
      
      vi.useRealTimers()
    })
    
    it('should swap to conditional addition', async () => {
      // Load a module where "add" only works if sum is less than 10
      await primitiveLoader.loadModule({
        type: 'builtin',
        module: async () => ({
          add: (): PrimitiveGadget => ({
            id: 'add',
            name: 'Conditional Add',
            inputs: ['a', 'b'],
            outputs: ['sum', 'error'],
            activation: (inputs) => inputs.has('a') && inputs.has('b'),
            body: async (inputs) => {
              const a = Number(inputs.get('a')) || 0
              const b = Number(inputs.get('b')) || 0
              const sum = a + b
              
              if (sum >= 10) {
                return new Map([
                  ['sum', null],
                  ['error', 'Sum too large!']
                ])
              }
              
              return new Map([
                ['sum', sum],
                ['error', null]
              ])
            },
            description: 'Adds only if sum < 10',
            category: 'math'
          })
        }),
        namespace: '@conditional/math'
      })
      
      // Test with small numbers (should work)
      adderGadgetId = await runtime.createPrimitiveGadget('@conditional/math/add', rootGroupId)
      
      const gadgetState = await runtime.getState(adderGadgetId)
      const inputA = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'a' && c.boundaryDirection === 'input')
      const inputB = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'b' && c.boundaryDirection === 'input')
      const sumOutput = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'sum' && c.boundaryDirection === 'output')
      const errorOutput = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'error' && c.boundaryDirection === 'output')
      
      await runtime.connect(contactA, inputA!.id)
      await runtime.connect(contactB, inputB!.id)
      await runtime.connect(sumOutput!.id, contactC)
      
      // Should work with 5 + 3 = 8 < 10
      let outputContact = (await runtime.getState(rootGroupId)).contacts.get(contactC)
      expect(outputContact?.content).toBe(8)
      
      // Now update to larger numbers
      await runtime.scheduleUpdate(contactA, 7)
      await runtime.scheduleUpdate(contactB, 6)
      
      // Should fail with 7 + 6 = 13 >= 10
      outputContact = (await runtime.getState(rootGroupId)).contacts.get(contactC)
      expect(outputContact?.content).toBeNull()
      
      // Check error output
      const errorContact = (await runtime.getState(adderGadgetId)).contacts.get(errorOutput!.id)
      expect(errorContact?.content).toBe('Sum too large!')
    })
  })
  
  describe('Module namespace isolation', () => {
    it('should allow different implementations in different namespaces', async () => {
      // Load three different "add" implementations in different namespaces
      const namespaces = [
        { ns: '@company-a', result: 100 }, // Always returns 100
        { ns: '@company-b', result: -1 },   // Always returns -1
        { ns: '@company-c', result: 42 }    // Always returns 42
      ]
      
      for (const { ns, result } of namespaces) {
        await primitiveLoader.loadModule({
          type: 'builtin',
          module: async () => ({
            add: (): PrimitiveGadget => ({
              id: 'add',
              name: `Add from ${ns}`,
              inputs: ['a', 'b'],
              outputs: ['sum'],
              activation: () => true,
              body: async () => new Map([['sum', result]]),
              description: `Always returns ${result}`,
              category: 'math'
            })
          }),
          namespace: ns
        })
      }
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Namespace Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create gadgets from each namespace
      const gadgetA = await runtime.createPrimitiveGadget('@company-a/add', rootGroupId)
      const gadgetB = await runtime.createPrimitiveGadget('@company-b/add', rootGroupId)
      const gadgetC = await runtime.createPrimitiveGadget('@company-c/add', rootGroupId)
      
      // Get their output values
      const getOutput = async (gadgetId: string) => {
        const state = await runtime.getState(gadgetId)
        const output = Array.from(state.contacts.values())
          .find(c => c.name === 'sum' && c.boundaryDirection === 'output')
        
        // Trigger the gadget by setting inputs
        const inputA = Array.from(state.contacts.values())
          .find(c => c.name === 'a' && c.boundaryDirection === 'input')
        const inputB = Array.from(state.contacts.values())
          .find(c => c.name === 'b' && c.boundaryDirection === 'input')
        
        await runtime.scheduleUpdate(inputA!.id, 1)
        await runtime.scheduleUpdate(inputB!.id, 1)
        
        return output?.content
      }
      
      // Each should return its namespace-specific value
      expect(await getOutput(gadgetA)).toBe(100)
      expect(await getOutput(gadgetB)).toBe(-1)
      expect(await getOutput(gadgetC)).toBe(42)
    })
  })
  
  describe('Dynamic primitive replacement', () => {
    it('should support hot-swapping primitive implementations', async () => {
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Hot Swap Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Load initial implementation
      await primitiveLoader.loadModule({
        type: 'builtin',
        module: async () => ({
          transform: (): PrimitiveGadget => ({
            id: 'transform',
            name: 'Double',
            inputs: ['value'],
            outputs: ['result'],
            activation: (inputs) => inputs.has('value'),
            body: async (inputs) => {
              const value = Number(inputs.get('value')) || 0
              return new Map([['result', value * 2]])
            },
            description: 'Doubles the input',
            category: 'transform'
          })
        }),
        namespace: '@dynamic'
      })
      
      // Create first gadget
      const gadget1 = await runtime.createPrimitiveGadget('@dynamic/transform', rootGroupId)
      
      // Test first behavior (doubling)
      const state1 = await runtime.getState(gadget1)
      const input1 = Array.from(state1.contacts.values())
        .find(c => c.name === 'value' && c.boundaryDirection === 'input')
      const output1 = Array.from(state1.contacts.values())
        .find(c => c.name === 'result' && c.boundaryDirection === 'output')
      
      await runtime.scheduleUpdate(input1!.id, 5)
      expect(output1?.content).toBe(10) // 5 * 2 = 10
      
      // Hot-swap: Load new implementation (triple instead of double)
      await primitiveLoader.loadModule({
        type: 'builtin',
        module: async () => ({
          transform: (): PrimitiveGadget => ({
            id: 'transform',
            name: 'Triple',
            inputs: ['value'],
            outputs: ['result'],
            activation: (inputs) => inputs.has('value'),
            body: async (inputs) => {
              const value = Number(inputs.get('value')) || 0
              return new Map([['result', value * 3]])
            },
            description: 'Triples the input',
            category: 'transform'
          })
        }),
        namespace: '@dynamic'
      })
      
      // Create new gadget with swapped implementation
      const gadget2 = await runtime.createPrimitiveGadget('@dynamic/transform', rootGroupId)
      
      // Test new behavior (tripling)
      const state2 = await runtime.getState(gadget2)
      const input2 = Array.from(state2.contacts.values())
        .find(c => c.name === 'value' && c.boundaryDirection === 'input')
      const output2 = Array.from(state2.contacts.values())
        .find(c => c.name === 'result' && c.boundaryDirection === 'output')
      
      await runtime.scheduleUpdate(input2!.id, 5)
      expect(output2?.content).toBe(15) // 5 * 3 = 15
      
      // Original gadget still uses old behavior
      await runtime.scheduleUpdate(input1!.id, 7)
      expect(output1?.content).toBe(14) // 7 * 2 = 14
    })
  })
})