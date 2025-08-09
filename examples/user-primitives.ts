/**
 * Example user-defined primitive module
 * 
 * This shows how users can create their own primitive gadgets
 * and load them into the Bassline system.
 */

import type { PrimitiveGadget } from '@bassline/core'

/**
 * Custom primitive: Random number generator
 * Generates a random number between min and max inputs
 */
export function random(): PrimitiveGadget {
  return {
    id: 'random',
    name: 'Random Number',
    inputs: ['min', 'max', 'trigger'],
    outputs: ['value'],
    activation: (inputs) => 
      inputs.has('min') && inputs.has('max') && inputs.has('trigger'),
    body: async (inputs) => {
      const min = Number(inputs.get('min')) || 0
      const max = Number(inputs.get('max')) || 1
      const value = Math.random() * (max - min) + min
      return new Map([['value', value]])
    },
    description: 'Generates a random number between min and max',
    category: 'custom'
  }
}

/**
 * Custom primitive: Delay
 * Delays the input value by specified milliseconds
 */
export function delay(): PrimitiveGadget {
  return {
    id: 'delay',
    name: 'Delay',
    inputs: ['value', 'milliseconds'],
    outputs: ['delayed'],
    activation: (inputs) => 
      inputs.has('value') && inputs.has('milliseconds'),
    body: async (inputs) => {
      const value = inputs.get('value')
      const ms = Number(inputs.get('milliseconds')) || 0
      
      // Impure: has side effects (timing)
      await new Promise(resolve => setTimeout(resolve, ms))
      
      return new Map([['delayed', value]])
    },
    description: 'Delays a value by specified milliseconds',
    category: 'custom',
    isPure: false // Mark as impure due to timing side effects
  }
}

/**
 * Custom primitive: Accumulator
 * Accumulates values over time (stateful)
 */
export function accumulator(): PrimitiveGadget {
  // Note: State is encapsulated in the closure
  let sum = 0
  
  return {
    id: 'accumulator',
    name: 'Accumulator',
    inputs: ['add', 'reset'],
    outputs: ['sum'],
    activation: (inputs) => 
      inputs.has('add') || inputs.has('reset'),
    body: async (inputs) => {
      if (inputs.has('reset') && inputs.get('reset')) {
        sum = 0
      }
      if (inputs.has('add')) {
        sum += Number(inputs.get('add')) || 0
      }
      return new Map([['sum', sum]])
    },
    description: 'Accumulates values over time',
    category: 'custom',
    isPure: false // Stateful
  }
}

/**
 * Custom primitive: Fetch
 * Fetches data from a URL
 */
export function fetch(): PrimitiveGadget {
  return {
    id: 'fetch',
    name: 'Fetch',
    inputs: ['url', 'trigger'],
    outputs: ['data', 'error'],
    activation: (inputs) => 
      inputs.has('url') && inputs.has('trigger'),
    body: async (inputs) => {
      const url = String(inputs.get('url'))
      
      try {
        const response = await globalThis.fetch(url)
        const data = await response.json()
        return new Map([
          ['data', data],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['data', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Fetches JSON data from a URL',
    category: 'custom',
    isPure: false // Network I/O
  }
}

/**
 * Custom primitive: Format
 * Formats a template string with values
 */
export function format(): PrimitiveGadget {
  return {
    id: 'format',
    name: 'Format String',
    inputs: ['template', 'value1', 'value2', 'value3'],
    outputs: ['formatted'],
    activation: (inputs) => 
      inputs.has('template'),
    body: async (inputs) => {
      let template = String(inputs.get('template'))
      
      // Replace {1}, {2}, {3} with values
      if (inputs.has('value1')) {
        template = template.replace(/\{1\}/g, String(inputs.get('value1')))
      }
      if (inputs.has('value2')) {
        template = template.replace(/\{2\}/g, String(inputs.get('value2')))
      }
      if (inputs.has('value3')) {
        template = template.replace(/\{3\}/g, String(inputs.get('value3')))
      }
      
      return new Map([['formatted', template]])
    },
    description: 'Formats a template string with values',
    category: 'custom'
  }
}

/**
 * Custom primitive: Timer
 * Emits a value periodically
 */
export function timer(): PrimitiveGadget {
  let intervalId: NodeJS.Timeout | null = null
  let counter = 0
  
  return {
    id: 'timer',
    name: 'Timer',
    inputs: ['interval', 'start', 'stop'],
    outputs: ['tick', 'count'],
    activation: (inputs) => 
      inputs.has('start') || inputs.has('stop'),
    body: async (inputs) => {
      if (inputs.has('stop') && inputs.get('stop')) {
        if (intervalId) {
          clearInterval(intervalId)
          intervalId = null
        }
        return new Map([['tick', false], ['count', counter]])
      }
      
      if (inputs.has('start') && inputs.get('start')) {
        const interval = Number(inputs.get('interval')) || 1000
        
        if (intervalId) {
          clearInterval(intervalId)
        }
        
        counter = 0
        intervalId = setInterval(() => {
          counter++
          // Note: This would need to trigger a propagation
          // In real implementation, this would use the runtime
        }, interval)
        
        return new Map([['tick', true], ['count', counter]])
      }
      
      return new Map([['tick', false], ['count', counter]])
    },
    description: 'Emits values periodically',
    category: 'custom',
    isPure: false // Timing and state
  }
}

/**
 * Export all custom primitives
 * When loaded, these will be available as:
 * - @user/custom/random
 * - @user/custom/delay
 * - @user/custom/accumulator
 * - @user/custom/fetch
 * - @user/custom/format
 * - @user/custom/timer
 */