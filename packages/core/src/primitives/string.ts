import type { PrimitiveGadget } from '../types'

// String primitive gadgets - exported as functions for modular loading

export function concat(): PrimitiveGadget {
  return {
    id: 'concat',
    name: 'Concatenate',
    inputs: ['a', 'b'],
    outputs: ['result'],
    activation: (inputs) =>
      inputs.has('a') && inputs.has('b'),
    body: async (inputs) => {
      const a = String(inputs.get('a'))
      const b = String(inputs.get('b'))
      return new Map([['result', a + b]])
    },
    description: 'Concatenates two strings',
    category: 'string'
  }
}

export function length(): PrimitiveGadget {
  return {
    id: 'length',
    name: 'Length',
    inputs: ['value'],
    outputs: ['length'],
    activation: (inputs) =>
      inputs.has('value'),
    body: async (inputs) => {
      const value = String(inputs.get('value'))
      return new Map([['length', value.length]])
    },
    description: 'Returns string length',
    category: 'string'
  }
}

export function substring(): PrimitiveGadget {
  return {
    id: 'substring',
    name: 'Substring',
    inputs: ['string', 'start', 'end'],
    outputs: ['result'],
    activation: (inputs) =>
      inputs.has('string') && inputs.has('start') &&
      typeof inputs.get('start') === 'number',
    body: async (inputs) => {
      const str = String(inputs.get('string'))
      const start = inputs.get('start') as number
      const end = inputs.has('end') ? inputs.get('end') as number : undefined
      return new Map([['result', str.substring(start, end)]])
    },
    description: 'Extracts substring',
    category: 'string'
  }
}

export function toUpper(): PrimitiveGadget {
  return {
    id: 'toUpper',
    name: 'To Uppercase',
    inputs: ['value'],
    outputs: ['result'],
    activation: (inputs) =>
      inputs.has('value'),
    body: async (inputs) => {
      const value = String(inputs.get('value'))
      return new Map([['result', value.toUpperCase()]])
    },
    description: 'Converts to uppercase',
    category: 'string'
  }
}

export function toLower(): PrimitiveGadget {
  return {
    id: 'toLower',
    name: 'To Lowercase',
    inputs: ['value'],
    outputs: ['result'],
    activation: (inputs) =>
      inputs.has('value'),
    body: async (inputs) => {
      const value = String(inputs.get('value'))
      return new Map([['result', value.toLowerCase()]])
    },
    description: 'Converts to lowercase',
    category: 'string'
  }
}

export function trim(): PrimitiveGadget {
  return {
    id: 'trim',
    name: 'Trim',
    inputs: ['value'],
    outputs: ['result'],
    activation: (inputs) =>
      inputs.has('value'),
    body: async (inputs) => {
      const value = String(inputs.get('value'))
      return new Map([['result', value.trim()]])
    },
    description: 'Removes whitespace from both ends',
    category: 'string'
  }
}

export function split(): PrimitiveGadget {
  return {
    id: 'split',
    name: 'Split',
    inputs: ['string', 'separator'],
    outputs: ['result'],
    activation: (inputs) =>
      inputs.has('string') && inputs.has('separator'),
    body: async (inputs) => {
      const str = String(inputs.get('string'))
      const separator = String(inputs.get('separator'))
      return new Map([['result', str.split(separator)]])
    },
    description: 'Splits string into array',
    category: 'string'
  }
}

export function join(): PrimitiveGadget {
  return {
    id: 'join',
    name: 'Join',
    inputs: ['array', 'separator'],
    outputs: ['result'],
    activation: (inputs) =>
      inputs.has('array') && Array.isArray(inputs.get('array')),
    body: async (inputs) => {
      const array = inputs.get('array') as unknown[]
      const separator = inputs.has('separator') ? String(inputs.get('separator')) : ','
      return new Map([['result', array.join(separator)]])
    },
    description: 'Joins array into string',
    category: 'string'
  }
}

