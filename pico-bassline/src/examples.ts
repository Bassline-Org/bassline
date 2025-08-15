/**
 * Pico-Bassline Examples
 * Demonstrations of various patterns and usage
 */

import { Group, WireMode } from './core'
import { loop, sequence, parallel, forkJoin } from './combinators'
import { primitives } from './primitives'
import { Properties, Value } from './types'

/**
 * Example 1: Simple binary adder
 */
export function createAdder(parent?: Group): Group {
  const group = new Group('adder', primitives.add(), parent)
  
  // Create input contacts
  group.createContact('a', 5)
  group.createContact('b', 10)
  
  // Create output contact
  group.createContact('output')
  
  // When execute() is called, it will compute a + b → output
  return group
}

/**
 * Example 2: Chained arithmetic using sequence combinator
 * Computes: ((input + 5) * 2) - 3
 */
export function createArithmeticChain(parent?: Group): Group {
  // Create primitives with preset values
  const add5 = {
    ...primitives.add(),
    defaultB: 5  // We'll wire input to 'a', use 5 for 'b'
  }
  
  const multiply2 = {
    ...primitives.multiply(),
    defaultB: 2
  }
  
  const subtract3 = {
    ...primitives.subtract(),
    defaultB: 3
  }
  
  return sequence('arithmetic-chain', [add5, multiply2, subtract3], parent)
}

/**
 * Example 3: Max accumulator using feedback loop
 * Continuously tracks the maximum value seen
 */
export function createMaxAccumulator(parent?: Group): Group {
  return loop('max-accumulator', primitives.maxMerge(), parent)
}

/**
 * Example 4: Parallel computation
 * Sends input to multiple operations simultaneously
 */
export function createParallelOperations(parent?: Group): Group {
  return parallel('parallel-ops', [
    primitives.multiply(),  // Branch 0: multiply
    primitives.add(),       // Branch 1: add
    primitives.not()        // Branch 2: logical not
  ], parent)
}

/**
 * Example 5: Dynamic sum using meta-propagation
 * Can sum any number of inputs by reading its own structure
 */
export function createDynamicSum(parent?: Group): Group {
  const group = new Group('dynamic-sum', {}, parent)
  
  // Create a self-aware summer that reads all inputs
  const summer = group.createGroup('summer', {
    primitive: true,
    name: 'dynamic-summer',
    compute: (inputs: Record<string, Value>) => {
      let sum = 0
      for (const key in inputs) {
        // Sum all non-meta, non-output values
        if (!key.startsWith('meta-') && key !== 'output') {
          const value = inputs[key]
          if (typeof value === 'number') {
            sum += value
          }
        }
      }
      return sum
    }
  })
  
  // Create boundary output
  const output = group.createContact('output', undefined, {
    boundary: true,
    internal: 'write',
    external: 'read'
  })
  
  // Create summer output and wire to group output
  summer.createContact('output')
  const summerOutput = summer.contacts.get('output')
  if (summerOutput) {
    summerOutput.wireTo(output, WireMode.FORWARD_ONLY)
  }
  
  // Helper method to add new inputs dynamically
  const addInput = (id: string, value: number): void => {
    const input = group.createContact(id, value, {
      boundary: true,
      internal: 'read',
      external: 'write'
    })
    
    // Create corresponding input in summer and wire
    const summerInput = summer.createContact(id)
    input.wireTo(summerInput, WireMode.FORWARD_ONLY)
  }
  
  // Add some initial inputs
  addInput('input1', 5)
  addInput('input2', 10)
  addInput('input3', 15)
  
  // Store helper for external use - attach to group object
  // This is a pattern for extending groups with helper methods
  Object.defineProperty(group, 'addInput', {
    value: addInput,
    writable: false,
    enumerable: false
  })
  
  return group
}

/**
 * Example 6: Temperature converter with bidirectional constraint
 * Demonstrates constraint propagation between Celsius and Fahrenheit
 */
export function createTemperatureConverter(parent?: Group): Group {
  const group = new Group('temp-converter', {}, parent)
  
  // Create bidirectional boundary contacts
  const celsius = group.createContact('celsius', 0, {
    boundary: true,
    internal: 'both',
    external: 'both'
  })
  
  const fahrenheit = group.createContact('fahrenheit', 32, {
    boundary: true,
    internal: 'both',
    external: 'both'
  })
  
  // Create converters for each direction
  const c2f = group.createGroup('c2f', {
    primitive: true,
    name: 'celsius-to-fahrenheit',
    compute: (inputs: Record<string, Value>) => {
      const c = inputs.celsius as number ?? 0
      return (c * 9/5) + 32
    }
  })
  
  const f2c = group.createGroup('f2c', {
    primitive: true,
    name: 'fahrenheit-to-celsius',
    compute: (inputs: Record<string, Value>) => {
      const f = inputs.fahrenheit as number ?? 32
      return (f - 32) * 5/9
    }
  })
  
  // Create contacts for converters
  c2f.createContact('celsius')
  c2f.createContact('output')
  f2c.createContact('fahrenheit')
  f2c.createContact('output')
  
  // Wire bidirectionally
  const c2fInput = c2f.contacts.get('celsius')
  const c2fOutput = c2f.contacts.get('output')
  const f2cInput = f2c.contacts.get('fahrenheit')
  const f2cOutput = f2c.contacts.get('output')
  
  if (c2fInput && c2fOutput && f2cInput && f2cOutput) {
    celsius.wireTo(c2fInput, WireMode.FORWARD_ONLY)
    c2fOutput.wireTo(fahrenheit, WireMode.FORWARD_ONLY)
    fahrenheit.wireTo(f2cInput, WireMode.FORWARD_ONLY)
    f2cOutput.wireTo(celsius, WireMode.FORWARD_ONLY)
  }
  
  return group
}

/**
 * Example 7: Self-modifying group
 * Changes its behavior based on input threshold
 */
export function createSelfModifying(parent?: Group): Group {
  const group = new Group('self-modifying', {}, parent)
  
  const threshold = group.createContact('threshold', 10, {
    boundary: true,
    internal: 'read',
    external: 'write'
  })
  
  const input = group.createContact('input', 0, {
    boundary: true,
    internal: 'read',
    external: 'write'
  })
  
  group.createContact('output', undefined, {
    boundary: true,
    internal: 'write',
    external: 'read'
  })
  
  // Controller that modifies parent's properties
  const controller = group.createGroup('controller', {
    primitive: true,
    name: 'property-controller',
    compute: (inputs: Record<string, Value>) => {
      const value = inputs.input as number ?? 0
      const thresh = inputs.threshold as number ?? 10
      
      // Return new properties based on threshold
      return {
        primitive: value > thresh,
        compute: value > thresh 
          ? primitives.multiply().compute
          : primitives.add().compute
      }
    }
  })
  
  // Create controller contacts
  controller.createContact('input')
  controller.createContact('threshold')
  controller.createContact('output')
  
  // Wire inputs to controller
  const ctrlInput = controller.contacts.get('input')
  const ctrlThreshold = controller.contacts.get('threshold')
  const ctrlOutput = controller.contacts.get('output')
  
  if (ctrlInput && ctrlThreshold && ctrlOutput && group.properties) {
    input.wireTo(ctrlInput, WireMode.FORWARD_ONLY)
    threshold.wireTo(ctrlThreshold, WireMode.FORWARD_ONLY)
    
    // Wire controller output to group's properties!
    ctrlOutput.wireTo(group.properties, WireMode.FORWARD_ONLY)
  }
  
  return group
}

/**
 * Example 8: Fork-Join pattern
 * Split input into parts, process in parallel, then combine
 */
export function createForkJoinExample(parent?: Group): Group {
  // Splitter that divides input into two parts
  const splitter: Properties = {
    primitive: true,
    name: 'splitter',
    compute: (inputs: Record<string, Value>) => {
      const value = inputs.input as number ?? 0
      return {
        output0: value / 2,
        output1: value / 2
      }
    }
  }
  
  // Joiner that combines results
  const joiner: Properties = {
    primitive: true,
    name: 'joiner',
    compute: (inputs: Record<string, Value>) => {
      const a = inputs.input0 as number ?? 0
      const b = inputs.input1 as number ?? 0
      return a + b  // Recombine
    }
  }
  
  return forkJoin(
    'fork-join-example',
    splitter,
    [primitives.multiply(), primitives.add()],  // Different operations on each branch
    joiner,
    parent
  )
}