import type { PrimitiveGadget } from '../types'

// Array primitive gadgets

export const firstGadget: PrimitiveGadget = {
  id: 'first',
  name: 'First',
  inputs: ['array'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('array') && Array.isArray(inputs.get('array')),
  body: async (inputs) => {
    const array = inputs.get('array') as unknown[]
    return new Map([['result', array[0]]])
  },
  description: 'Gets first element of array',
  category: 'array'
}

export const lastGadget: PrimitiveGadget = {
  id: 'last',
  name: 'Last',
  inputs: ['array'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('array') && Array.isArray(inputs.get('array')),
  body: async (inputs) => {
    const array = inputs.get('array') as unknown[]
    return new Map([['result', array[array.length - 1]]])
  },
  description: 'Gets last element of array',
  category: 'array'
}

export const nthGadget: PrimitiveGadget = {
  id: 'nth',
  name: 'Nth',
  inputs: ['array', 'index'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('array') && Array.isArray(inputs.get('array')) &&
    inputs.has('index') && typeof inputs.get('index') === 'number',
  body: async (inputs) => {
    const array = inputs.get('array') as unknown[]
    const index = inputs.get('index') as number
    return new Map([['result', array[index]]])
  },
  description: 'Gets nth element of array',
  category: 'array'
}

export const arraySizeGadget: PrimitiveGadget = {
  id: 'arraySize',
  name: 'Array Size',
  inputs: ['array'],
  outputs: ['size'],
  activation: (inputs) =>
    inputs.has('array') && Array.isArray(inputs.get('array')),
  body: async (inputs) => {
    const array = inputs.get('array') as unknown[]
    return new Map([['size', array.length]])
  },
  description: 'Gets array length',
  category: 'array'
}

export const appendGadget: PrimitiveGadget = {
  id: 'append',
  name: 'Append',
  inputs: ['array', 'value'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('array') && Array.isArray(inputs.get('array')) &&
    inputs.has('value'),
  body: async (inputs) => {
    const array = inputs.get('array') as unknown[]
    const value = inputs.get('value')
    return new Map([['result', [...array, value]]])
  },
  description: 'Appends value to array',
  category: 'array'
}

export const prependGadget: PrimitiveGadget = {
  id: 'prepend',
  name: 'Prepend',
  inputs: ['array', 'value'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('array') && Array.isArray(inputs.get('array')) &&
    inputs.has('value'),
  body: async (inputs) => {
    const array = inputs.get('array') as unknown[]
    const value = inputs.get('value')
    return new Map([['result', [value, ...array]]])
  },
  description: 'Prepends value to array',
  category: 'array'
}

export const reverseGadget: PrimitiveGadget = {
  id: 'reverse',
  name: 'Reverse',
  inputs: ['array'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('array') && Array.isArray(inputs.get('array')),
  body: async (inputs) => {
    const array = inputs.get('array') as unknown[]
    return new Map([['result', [...array].reverse()]])
  },
  description: 'Reverses array',
  category: 'array'
}

export const sliceGadget: PrimitiveGadget = {
  id: 'slice',
  name: 'Slice',
  inputs: ['array', 'start', 'end'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('array') && Array.isArray(inputs.get('array')) &&
    inputs.has('start') && typeof inputs.get('start') === 'number',
  body: async (inputs) => {
    const array = inputs.get('array') as unknown[]
    const start = inputs.get('start') as number
    const end = inputs.has('end') && typeof inputs.get('end') === 'number'
      ? inputs.get('end') as number
      : undefined
    return new Map([['result', array.slice(start, end)]])
  },
  description: 'Slices array',
  category: 'array'
}

export const filterEmptyGadget: PrimitiveGadget = {
  id: 'filterEmpty',
  name: 'Filter Empty',
  inputs: ['array'],
  outputs: ['result'],
  activation: (inputs) =>
    inputs.has('array') && Array.isArray(inputs.get('array')),
  body: async (inputs) => {
    const array = inputs.get('array') as unknown[]
    const filtered = array.filter(item => 
      item !== null && 
      item !== undefined && 
      item !== ''
    )
    return new Map([['result', filtered]])
  },
  description: 'Removes empty values from array',
  category: 'array'
}

// Export all array gadgets
export const arrayGadgets = [
  firstGadget,
  lastGadget,
  nthGadget,
  arraySizeGadget,
  appendGadget,
  prependGadget,
  reverseGadget,
  sliceGadget,
  filterEmptyGadget
]