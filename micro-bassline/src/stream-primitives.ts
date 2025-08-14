/**
 * Default primitive gadgets for StreamRuntime
 */

import { guards } from './micro-stream'
import { GadgetConfig } from './stream-contact'

/**
 * Math primitives
 */
export const mathPrimitives: Record<string, GadgetConfig> = {
  add: {
    inputs: ['a', 'b'],
    outputs: ['sum'],
    guards: [
      guards.hasInputs('a', 'b'),
      guards.hasTypes({ a: 'number', b: 'number' }),
      guards.isFinite('a', 'b')
    ],
    execute: ({a, b}) => ({sum: a + b})
  },
  
  subtract: {
    inputs: ['a', 'b'],
    outputs: ['difference'],
    guards: [
      guards.hasInputs('a', 'b'),
      guards.hasTypes({ a: 'number', b: 'number' }),
      guards.isFinite('a', 'b')
    ],
    execute: ({a, b}) => ({difference: a - b})
  },
  
  multiply: {
    inputs: ['a', 'b'],
    outputs: ['product'],
    guards: [
      guards.hasInputs('a', 'b'),
      guards.hasTypes({ a: 'number', b: 'number' }),
      guards.isFinite('a', 'b')
    ],
    execute: ({a, b}) => ({product: a * b})
  },
  
  divide: {
    inputs: ['numerator', 'denominator'],
    outputs: ['quotient'],
    guards: [
      guards.hasInputs('numerator', 'denominator'),
      guards.hasTypes({ numerator: 'number', denominator: 'number' }),
      guards.isFinite('numerator'),
      (inputs: any) => inputs.denominator !== 0
    ],
    execute: ({numerator, denominator}) => ({quotient: numerator / denominator})
  }
}

/**
 * String primitives
 */
export const stringPrimitives: Record<string, GadgetConfig> = {
  concat: {
    inputs: ['a', 'b'],
    outputs: ['result'],
    guards: [
      guards.hasInputs('a', 'b'),
      guards.hasTypes({ a: 'string', b: 'string' })
    ],
    execute: ({a, b}) => ({result: a + b})
  },
  
  split: {
    inputs: ['text', 'separator'],
    outputs: ['parts'],
    guards: [
      guards.hasInputs('text', 'separator'),
      guards.hasTypes({ text: 'string', separator: 'string' })
    ],
    execute: ({text, separator}) => ({parts: text.split(separator)})
  },
  
  join: {
    inputs: ['items', 'separator'],
    outputs: ['result'],
    guards: [
      guards.hasInputs('items', 'separator'),
      (inputs: any) => Array.isArray(inputs.items),
      guards.hasTypes({ separator: 'string' })
    ],
    execute: ({items, separator}) => ({result: items.join(separator)})
  }
}

/**
 * Logic primitives
 */
export const logicPrimitives: Record<string, GadgetConfig> = {
  and: {
    inputs: ['a', 'b'],
    outputs: ['result'],
    guards: [guards.hasInputs('a', 'b')],
    execute: ({a, b}) => ({result: a && b})
  },
  
  or: {
    inputs: ['a', 'b'],
    outputs: ['result'],
    guards: [guards.hasInputs('a', 'b')],
    execute: ({a, b}) => ({result: a || b})
  },
  
  not: {
    inputs: ['value'],
    outputs: ['result'],
    guards: [guards.hasInputs('value')],
    execute: ({value}) => ({result: !value})
  },
  
  equals: {
    inputs: ['a', 'b'],
    outputs: ['result'],
    guards: [guards.hasInputs('a', 'b')],
    execute: ({a, b}) => ({result: a === b})
  }
}

/**
 * Control flow primitives
 */
export const controlPrimitives: Record<string, GadgetConfig> = {
  gate: {
    inputs: ['value', 'open'],
    outputs: ['output'],
    guards: [guards.hasInputs('value', 'open')],
    execute: ({value, open}) => ({output: open ? value : undefined})
  },
  
  select: {
    inputs: ['condition', 'ifTrue', 'ifFalse'],
    outputs: ['result'],
    guards: [guards.hasInputs('condition', 'ifTrue', 'ifFalse')],
    execute: ({condition, ifTrue, ifFalse}) => ({result: condition ? ifTrue : ifFalse})
  }
}

/**
 * Array primitives
 */
export const arrayPrimitives: Record<string, GadgetConfig> = {
  length: {
    inputs: ['array'],
    outputs: ['length'],
    guards: [
      guards.hasInputs('array'),
      (inputs: any) => Array.isArray(inputs.array)
    ],
    execute: ({array}) => ({length: array.length})
  },
  
  index: {
    inputs: ['array', 'index'],
    outputs: ['value'],
    guards: [
      guards.hasInputs('array', 'index'),
      (inputs: any) => Array.isArray(inputs.array),
      guards.hasTypes({ index: 'number' })
    ],
    execute: ({array, index}) => ({value: array[index]})
  },
  
  push: {
    inputs: ['array', 'item'],
    outputs: ['result'],
    guards: [
      guards.hasInputs('array', 'item'),
      (inputs: any) => Array.isArray(inputs.array)
    ],
    execute: ({array, item}) => ({result: [...array, item]})
  },
  
  pop: {
    inputs: ['array'],
    outputs: ['result', 'item'],
    guards: [
      guards.hasInputs('array'),
      (inputs: any) => Array.isArray(inputs.array) && inputs.array.length > 0
    ],
    execute: ({array}) => {
      const copy = [...array]
      const item = copy.pop()
      return {result: copy, item}
    }
  }
}

/**
 * All default primitives combined
 */
export const defaultPrimitives: Record<string, GadgetConfig> = {
  ...mathPrimitives,
  ...stringPrimitives,
  ...logicPrimitives,
  ...controlPrimitives,
  ...arrayPrimitives
}

/**
 * Create a Map of all default primitives (for backward compatibility)
 */
export function getStreamPrimitives(): Map<string, GadgetConfig> {
  return new Map(Object.entries(defaultPrimitives))
}