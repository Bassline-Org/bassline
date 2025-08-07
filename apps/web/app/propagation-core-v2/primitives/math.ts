import type { PrimitiveGadget } from '../types'

// Math primitive gadgets

export const addGadget: PrimitiveGadget = {
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

export const subtractGadget: PrimitiveGadget = {
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

export const multiplyGadget: PrimitiveGadget = {
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

export const divideGadget: PrimitiveGadget = {
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

export const powerGadget: PrimitiveGadget = {
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

export const sqrtGadget: PrimitiveGadget = {
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

export const absGadget: PrimitiveGadget = {
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

export const minGadget: PrimitiveGadget = {
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

export const maxGadget: PrimitiveGadget = {
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

// Export all math gadgets
export const mathGadgets = [
  addGadget,
  subtractGadget,
  multiplyGadget,
  divideGadget,
  powerGadget,
  sqrtGadget,
  absGadget,
  minGadget,
  maxGadget
]