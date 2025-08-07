import type { PrimitiveGadget } from '../types'

// Logic primitive gadgets

export const andGadget: PrimitiveGadget = {
  id: 'and',
  name: 'AND',
  inputs: ['a', 'b'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('a') && inputs.has('b'),
  body: async (inputs) => {
    const a = Boolean(inputs.get('a'))
    const b = Boolean(inputs.get('b'))
    return new Map([['result', a && b]])
  },
  description: 'Logical AND operation',
  category: 'logic'
}

export const orGadget: PrimitiveGadget = {
  id: 'or',
  name: 'OR',
  inputs: ['a', 'b'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('a') && inputs.has('b'),
  body: async (inputs) => {
    const a = Boolean(inputs.get('a'))
    const b = Boolean(inputs.get('b'))
    return new Map([['result', a || b]])
  },
  description: 'Logical OR operation',
  category: 'logic'
}

export const notGadget: PrimitiveGadget = {
  id: 'not',
  name: 'NOT',
  inputs: ['value'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('value'),
  body: async (inputs) => {
    const value = Boolean(inputs.get('value'))
    return new Map([['result', !value]])
  },
  description: 'Logical NOT operation',
  category: 'logic'
}

export const equalsGadget: PrimitiveGadget = {
  id: 'equals',
  name: 'Equals',
  inputs: ['a', 'b'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('a') && inputs.has('b'),
  body: async (inputs) => {
    const a = inputs.get('a')
    const b = inputs.get('b')
    return new Map([['result', a === b]])
  },
  description: 'Tests equality',
  category: 'logic'
}

export const notEqualsGadget: PrimitiveGadget = {
  id: 'notEquals',
  name: 'Not Equals',
  inputs: ['a', 'b'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('a') && inputs.has('b'),
  body: async (inputs) => {
    const a = inputs.get('a')
    const b = inputs.get('b')
    return new Map([['result', a !== b]])
  },
  description: 'Tests inequality',
  category: 'logic'
}

export const greaterThanGadget: PrimitiveGadget = {
  id: 'greaterThan',
  name: 'Greater Than',
  inputs: ['a', 'b'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('a') && inputs.has('b') &&
    typeof inputs.get('a') === 'number' &&
    typeof inputs.get('b') === 'number',
  body: async (inputs) => {
    const a = inputs.get('a') as number
    const b = inputs.get('b') as number
    return new Map([['result', a > b]])
  },
  description: 'Tests if a > b',
  category: 'logic'
}

export const lessThanGadget: PrimitiveGadget = {
  id: 'lessThan',
  name: 'Less Than',
  inputs: ['a', 'b'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('a') && inputs.has('b') &&
    typeof inputs.get('a') === 'number' &&
    typeof inputs.get('b') === 'number',
  body: async (inputs) => {
    const a = inputs.get('a') as number
    const b = inputs.get('b') as number
    return new Map([['result', a < b]])
  },
  description: 'Tests if a < b',
  category: 'logic'
}

export const greaterOrEqualGadget: PrimitiveGadget = {
  id: 'greaterOrEqual',
  name: 'Greater or Equal',
  inputs: ['a', 'b'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('a') && inputs.has('b') &&
    typeof inputs.get('a') === 'number' &&
    typeof inputs.get('b') === 'number',
  body: async (inputs) => {
    const a = inputs.get('a') as number
    const b = inputs.get('b') as number
    return new Map([['result', a >= b]])
  },
  description: 'Tests if a >= b',
  category: 'logic'
}

export const lessOrEqualGadget: PrimitiveGadget = {
  id: 'lessOrEqual',
  name: 'Less or Equal',
  inputs: ['a', 'b'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('a') && inputs.has('b') &&
    typeof inputs.get('a') === 'number' &&
    typeof inputs.get('b') === 'number',
  body: async (inputs) => {
    const a = inputs.get('a') as number
    const b = inputs.get('b') as number
    return new Map([['result', a <= b]])
  },
  description: 'Tests if a <= b',
  category: 'logic'
}

export const xorGadget: PrimitiveGadget = {
  id: 'xor',
  name: 'XOR',
  inputs: ['a', 'b'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('a') && inputs.has('b'),
  body: async (inputs) => {
    const a = Boolean(inputs.get('a'))
    const b = Boolean(inputs.get('b'))
    return new Map([['result', a !== b]])
  },
  description: 'Logical XOR operation',
  category: 'logic'
}

// Export all logic gadgets
export const logicGadgets = [
  andGadget,
  orGadget,
  notGadget,
  xorGadget,
  equalsGadget,
  notEqualsGadget,
  greaterThanGadget,
  lessThanGadget,
  greaterOrEqualGadget,
  lessOrEqualGadget
]