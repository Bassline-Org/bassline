import { createMemoryStore } from './store.js'

/**
 * Built-in type definitions
 */
export const builtinTypes = {
  bassline: {
    name: 'bassline',
    description: 'A resource that describes other resources',
  },
  cell: {
    name: 'cell',
    description: 'Lattice-based value accumulator',
  },
  'cell-value': {
    name: 'cell-value',
    description: 'The current value of a cell',
  },
  propagator: {
    name: 'propagator',
    description: 'Reactive computation between cells',
  },
  fn: {
    name: 'fn',
    description: 'A function in the registry',
  },
  timer: {
    name: 'timer',
    description: 'Time-based event source',
  },
  'timer-tick': {
    name: 'timer-tick',
    description: 'A tick event from a timer',
  },
  'fetch-response': {
    name: 'fetch-response',
    description: 'HTTP response from fetch',
  },
  'fetch-error': {
    name: 'fetch-error',
    description: 'HTTP error from fetch',
  },
  store: {
    name: 'store',
    description: 'Key-value storage',
  },
}

/**
 * Create a types store (just a memory store pre-populated with builtins)
 * @param customTypes
 */
export const createTypes = (customTypes = {}) => {
  return createMemoryStore({ ...builtinTypes, ...customTypes })
}

export default createTypes
