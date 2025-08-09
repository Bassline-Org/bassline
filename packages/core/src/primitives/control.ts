import type { PrimitiveGadget } from '../types'

// Control flow primitive gadgets - exported as functions for modular loading

export function gate(): PrimitiveGadget {
  return {
    id: 'gate',
    name: 'Gate',
    inputs: ['value', 'condition'],
    outputs: ['output'],
    activation: (inputs) =>
      inputs.has('value') && inputs.has('condition'),
    body: async (inputs) => {
      const condition = Boolean(inputs.get('condition'))
      if (condition) {
        return new Map([['output', inputs.get('value')]])
      }
      // Return empty map when gate is closed
      return new Map()
    },
    description: 'Passes value through when condition is true',
    category: 'control'
  }
}

export function switchGadget(): PrimitiveGadget {
  return {
    id: 'switch',
    name: 'Switch',
    inputs: ['condition', 'true', 'false'],
    outputs: ['result'],
    activation: (inputs) =>
      inputs.has('condition') && 
      (inputs.has('true') || inputs.has('false')),
    body: async (inputs) => {
      const condition = Boolean(inputs.get('condition'))
      const result = condition 
        ? inputs.get('true') 
        : inputs.get('false')
      return new Map([['result', result]])
    },
    description: 'Selects between two values based on condition',
    category: 'control'
  }
}

export function demux(): PrimitiveGadget {
  return {
    id: 'demux',
    name: 'Demultiplexer',
    inputs: ['value', 'selector'],
    outputs: ['out0', 'out1'],
    activation: (inputs) =>
      inputs.has('value') && inputs.has('selector'),
    body: async (inputs) => {
      const selector = Boolean(inputs.get('selector'))
      const value = inputs.get('value')
      
      if (selector) {
        return new Map([['out1', value]])
      } else {
        return new Map([['out0', value]])
      }
    },
    description: 'Routes value to one of two outputs',
    category: 'control'
  }
}

export function mux(): PrimitiveGadget {
  return {
    id: 'mux',
    name: 'Multiplexer',
    inputs: ['in0', 'in1', 'selector'],
    outputs: ['result'],
    activation: (inputs) =>
      inputs.has('selector') &&
      (inputs.has('in0') || inputs.has('in1')),
    body: async (inputs) => {
      const selector = Boolean(inputs.get('selector'))
      const result = selector 
        ? inputs.get('in1')
        : inputs.get('in0')
      return new Map([['result', result]])
    },
    description: 'Selects one of two inputs',
    category: 'control'
  }
}

export function latch(): PrimitiveGadget {
  return {
    id: 'latch',
    name: 'Latch',
    inputs: ['value', 'enable'],
    outputs: ['output'],
    activation: (inputs) =>
      inputs.has('enable'),
    body: async (inputs) => {
      // Note: This is a simplified latch that doesn't maintain state
      // In a real implementation, we'd need to track previous values
      const enable = Boolean(inputs.get('enable'))
      if (enable && inputs.has('value')) {
        return new Map([['output', inputs.get('value')]])
      }
      // When not enabled, output nothing (maintains previous value conceptually)
      return new Map()
    },
    description: 'Latches value when enabled',
    category: 'control'
  }
}

export function delay(): PrimitiveGadget {
  return {
    id: 'delay',
    name: 'Delay',
    inputs: ['value', 'delay'],
    outputs: ['output'],
    activation: (inputs) =>
      inputs.has('value'),
    body: async (inputs) => {
      const value = inputs.get('value')
      const delayMs = inputs.has('delay') && typeof inputs.get('delay') === 'number'
        ? inputs.get('delay') as number
        : 0
      
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
      
      return new Map([['output', value]])
    },
    description: 'Delays value propagation',
    category: 'control'
  }
}

// Legacy export for backwards compatibility (will be removed)
export const controlGadgets = [
  gate(),
  switchGadget(),
  demux(),
  mux(),
  latch(),
  delay()
]

// Legacy named exports for backwards compatibility
export const gateGadget = gate()
export { switchGadget as switch } // Can't use 'switch' directly as it's a keyword
export const demuxGadget = demux()
export const muxGadget = mux()
export const latchGadget = latch()
export const delayGadget = delay()