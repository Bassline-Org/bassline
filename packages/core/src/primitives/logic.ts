import type { PrimitiveGadget } from '../types'

// Logic primitive gadgets - exported as functions for modular loading

export function and(): PrimitiveGadget {
  return {
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
    category: 'logic',
    isPure: true
  }
}

export function or(): PrimitiveGadget {
  return {
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
    category: 'logic',
    isPure: true
  }
}

export function not(): PrimitiveGadget {
  return {
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
    category: 'logic',
    isPure: true
  }
}

export function equals(): PrimitiveGadget {
  return {
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
    category: 'logic',
    isPure: true
  }
}

export function notEquals(): PrimitiveGadget {
  return {
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
    category: 'logic',
    isPure: true
  }
}

export function greaterThan(): PrimitiveGadget {
  return {
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
    category: 'logic',
    isPure: true
  }
}

export function lessThan(): PrimitiveGadget {
  return {
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
    category: 'logic',
    isPure: true
  }
}

export function greaterOrEqual(): PrimitiveGadget {
  return {
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
    category: 'logic',
    isPure: true
  }
}

export function lessOrEqual(): PrimitiveGadget {
  return {
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
    category: 'logic',
    isPure: true
  }
}

export function xor(): PrimitiveGadget {
  return {
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
    category: 'logic',
    isPure: true
  }
}

// Legacy export for backwards compatibility (will be removed)
export const logicGadgets = [
  and(),
  or(),
  not(),
  xor(),
  equals(),
  notEquals(),
  greaterThan(),
  lessThan(),
  greaterOrEqual(),
  lessOrEqual()
]

// Legacy named exports for backwards compatibility
export const andGadget = and()
export const orGadget = or()
export const notGadget = not()
export const xorGadget = xor()
export const equalsGadget = equals()
export const notEqualsGadget = notEquals()
export const greaterThanGadget = greaterThan()
export const lessThanGadget = lessThan()
export const greaterOrEqualGadget = greaterOrEqual()
export const lessOrEqualGadget = lessOrEqual()