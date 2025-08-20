/**
 * List operations - Scheme-style list manipulation
 */

import { createPrimitiveGadget } from './gadgets'
import { Gadget, Value } from './types'
import { contradiction } from './tagged'

// ============================================================================
// Basic list operations
// ============================================================================

/**
 * car - Get first element of list
 */
export function createCar(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const list = inputs.get('list')
      
      if (!Array.isArray(list)) {
        return contradiction('Type error: expected list for car', [list], id)
      }
      
      if (list.length === 0) {
        return contradiction('Empty list for car', [list], id)
      }
      
      return list[0]
    },
    ['list'],
    ['output']
  )
}

/**
 * cdr - Get rest of list (tail)
 */
export function createCdr(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const list = inputs.get('list')
      
      if (!Array.isArray(list)) {
        return contradiction('Type error: expected list for cdr', [list], id)
      }
      
      if (list.length === 0) {
        return contradiction('Empty list for cdr', [list], id)
      }
      
      return list.slice(1)
    },
    ['list'],
    ['output']
  )
}

/**
 * cons - Prepend element to list
 */
export function createCons(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const head = inputs.get('head')
      const tail = inputs.get('tail')
      
      if (!Array.isArray(tail)) {
        return contradiction('Type error: expected list for cons tail', [tail], id)
      }
      
      return [head, ...tail]
    },
    ['head', 'tail'],
    ['output']
  )
}

/**
 * length - Get list length
 */
export function createLength(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const list = inputs.get('list')
      
      if (!Array.isArray(list)) {
        return contradiction('Type error: expected list for length', [list], id)
      }
      
      return list.length
    },
    ['list'],
    ['output']
  )
}

// ============================================================================
// Pair operations
// ============================================================================

/**
 * pair - Create a 2-element list
 */
export function createPair(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const first = inputs.get('first')
      const second = inputs.get('second')
      
      return [first, second]
    },
    ['first', 'second'],
    ['output']
  )
}

/**
 * first - Get first element of pair
 */
export function createFirst(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const pair = inputs.get('pair')
      
      if (!Array.isArray(pair) || pair.length !== 2) {
        return contradiction('Type error: expected pair for first', [pair], id)
      }
      
      return pair[0]
    },
    ['pair'],
    ['output']
  )
}

/**
 * second - Get second element of pair
 */
export function createSecond(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const pair = inputs.get('pair')
      
      if (!Array.isArray(pair) || pair.length !== 2) {
        return contradiction('Type error: expected pair for second', [pair], id)
      }
      
      return pair[1]
    },
    ['pair'],
    ['output']
  )
}

// ============================================================================
// List accessors
// ============================================================================

/**
 * nth - Get nth element of list (0-indexed)
 */
export function createNth(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const list = inputs.get('list')
      const n = inputs.get('n')
      
      if (!Array.isArray(list)) {
        return contradiction('Type error: expected list for nth', [list], id)
      }
      
      if (typeof n !== 'number') {
        return contradiction('Type error: expected number for index', [n], id)
      }
      
      if (n < 0 || n >= list.length) {
        return contradiction(`Index out of bounds: ${n}`, [list, n], id)
      }
      
      return list[Math.floor(n)]
    },
    ['list', 'n'],
    ['output']
  )
}

/**
 * append - Concatenate two lists
 */
export function createAppend(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const a = inputs.get('a')
      const b = inputs.get('b')
      
      if (!Array.isArray(a)) {
        return contradiction('Type error: expected list for first argument', [a], id)
      }
      
      if (!Array.isArray(b)) {
        return contradiction('Type error: expected list for second argument', [b], id)
      }
      
      return [...a, ...b]
    },
    ['a', 'b'],
    ['output']
  )
}

/**
 * reverse - Reverse a list
 */
export function createReverse(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const list = inputs.get('list')
      
      if (!Array.isArray(list)) {
        return contradiction('Type error: expected list for reverse', [list], id)
      }
      
      return [...list].reverse()
    },
    ['list'],
    ['output']
  )
}

// ============================================================================
// List queries
// ============================================================================

/**
 * member - Check if element is in list
 */
export function createMember(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const elem = inputs.get('element')
      const list = inputs.get('list')
      
      if (!Array.isArray(list)) {
        return contradiction('Type error: expected list for member', [list], id)
      }
      
      return list.includes(elem)
    },
    ['element', 'list'],
    ['output']
  )
}

/**
 * take - Take first n elements
 */
export function createTake(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const n = inputs.get('n')
      const list = inputs.get('list')
      
      if (!Array.isArray(list)) {
        return contradiction('Type error: expected list for take', [list], id)
      }
      
      if (typeof n !== 'number') {
        return contradiction('Type error: expected number for take count', [n], id)
      }
      
      return list.slice(0, Math.max(0, Math.floor(n)))
    },
    ['n', 'list'],
    ['output']
  )
}

/**
 * drop - Drop first n elements
 */
export function createDrop(id: string): Gadget {
  return createPrimitiveGadget(
    id,
    (inputs) => {
      const n = inputs.get('n')
      const list = inputs.get('list')
      
      if (!Array.isArray(list)) {
        return contradiction('Type error: expected list for drop', [list], id)
      }
      
      if (typeof n !== 'number') {
        return contradiction('Type error: expected number for drop count', [n], id)
      }
      
      return list.slice(Math.max(0, Math.floor(n)))
    },
    ['n', 'list'],
    ['output']
  )
}