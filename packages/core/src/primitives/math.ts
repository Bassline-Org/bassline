import type { PrimitiveGadget } from '../types'

// Math primitive gadgets - exported as functions for modular loading

export function add(): PrimitiveGadget {
  return {
    id: 'add',
    name: 'Add',
    inputs: ['a', 'b'],
    outputs: ['sum'],
    activation: (inputs) => 
      inputs.has('a') && inputs.has('b') &&
      typeof inputs.get('a') === 'number' &&
      typeof inputs.get('b') === 'number',
    body: async (inputs) => {
      const a = inputs.get('a') as number
      const b = inputs.get('b') as number
      return new Map([['sum', a + b]])
    },
    description: 'Adds two numbers',
    category: 'math'
  }
}

export function subtract(): PrimitiveGadget {
  return {
    id: 'subtract',
    name: 'Subtract',
    inputs: ['a', 'b'],
    outputs: ['difference'],
    activation: (inputs) =>
      inputs.has('a') && inputs.has('b') &&
      typeof inputs.get('a') === 'number' &&
      typeof inputs.get('b') === 'number',
    body: async (inputs) => {
      const a = inputs.get('a') as number
      const b = inputs.get('b') as number
      return new Map([['difference', a - b]])
    },
    description: 'Subtracts b from a',
    category: 'math'
  }
}

export function multiply(): PrimitiveGadget {
  return {
    id: 'multiply',
    name: 'Multiply',
    inputs: ['a', 'b'],
    outputs: ['product'],
    activation: (inputs) =>
      inputs.has('a') && inputs.has('b') &&
      typeof inputs.get('a') === 'number' &&
      typeof inputs.get('b') === 'number',
    body: async (inputs) => {
      const a = inputs.get('a') as number
      const b = inputs.get('b') as number
      return new Map([['product', a * b]])
    },
    description: 'Multiplies two numbers',
    category: 'math'
  }
}

export function divide(): PrimitiveGadget {
  return {
    id: 'divide',
    name: 'Divide',
    inputs: ['a', 'b'],
    outputs: ['quotient'],
    activation: (inputs) =>
      inputs.has('a') && inputs.has('b') &&
      typeof inputs.get('a') === 'number' &&
      typeof inputs.get('b') === 'number' &&
      inputs.get('b') !== 0,
    body: async (inputs) => {
      const a = inputs.get('a') as number
      const b = inputs.get('b') as number
      return new Map([['quotient', a / b]])
    },
    description: 'Divides a by b',
    category: 'math'
  }
}

export function power(): PrimitiveGadget {
  return {
    id: 'power',
    name: 'Power',
    inputs: ['base', 'exponent'],
    outputs: ['result'],
    activation: (inputs) =>
      inputs.has('base') && inputs.has('exponent') &&
      typeof inputs.get('base') === 'number' &&
      typeof inputs.get('exponent') === 'number',
    body: async (inputs) => {
      const base = inputs.get('base') as number
      const exponent = inputs.get('exponent') as number
      return new Map([['result', Math.pow(base, exponent)]])
    },
    description: 'Raises base to the power of exponent',
    category: 'math'
  }
}

export function sqrt(): PrimitiveGadget {
  return {
    id: 'sqrt',
    name: 'Square Root',
    inputs: ['value'],
    outputs: ['result'],
    activation: (inputs) =>
      inputs.has('value') &&
      typeof inputs.get('value') === 'number' &&
      (inputs.get('value') as number) >= 0,
    body: async (inputs) => {
      const value = inputs.get('value') as number
      return new Map([['result', Math.sqrt(value)]])
    },
    description: 'Calculates square root',
    category: 'math'
  }
}

export function abs(): PrimitiveGadget {
  return {
    id: 'abs',
    name: 'Absolute Value',
    inputs: ['value'],
    outputs: ['result'],
    activation: (inputs) =>
      inputs.has('value') &&
      typeof inputs.get('value') === 'number',
    body: async (inputs) => {
      const value = inputs.get('value') as number
      return new Map([['result', Math.abs(value)]])
    },
    description: 'Returns absolute value',
    category: 'math'
  }
}

export function min(): PrimitiveGadget {
  return {
    id: 'min',
    name: 'Minimum',
    inputs: ['a', 'b'],
    outputs: ['min'],
    activation: (inputs) =>
      inputs.has('a') && inputs.has('b') &&
      typeof inputs.get('a') === 'number' &&
      typeof inputs.get('b') === 'number',
    body: async (inputs) => {
      const a = inputs.get('a') as number
      const b = inputs.get('b') as number
      return new Map([['min', Math.min(a, b)]])
    },
    description: 'Returns the minimum of two numbers',
    category: 'math'
  }
}

export function max(): PrimitiveGadget {
  return {
    id: 'max',
    name: 'Maximum',
    inputs: ['a', 'b'],
    outputs: ['max'],
    activation: (inputs) =>
      inputs.has('a') && inputs.has('b') &&
      typeof inputs.get('a') === 'number' &&
      typeof inputs.get('b') === 'number',
    body: async (inputs) => {
      const a = inputs.get('a') as number
      const b = inputs.get('b') as number
      return new Map([['max', Math.max(a, b)]])
    },
    description: 'Returns the maximum of two numbers',
    category: 'math'
  }
}

// Legacy export for backwards compatibility (will be removed)
export const mathGadgets = [
  add(),
  subtract(),
  multiply(),
  divide(),
  power(),
  sqrt(),
  abs(),
  min(),
  max()
]

// Legacy named exports for backwards compatibility
export const addGadget = add()
export const subtractGadget = subtract()
export const multiplyGadget = multiply()
export const divideGadget = divide()
export const powerGadget = power()
export const sqrtGadget = sqrt()
export const absGadget = abs()
export const minGadget = min()
export const maxGadget = max()