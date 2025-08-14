/**
 * Basic Primitive Gadgets
 * 
 * Essential computational primitives for the propagation network.
 */

import { PrimitiveGadget } from './types'

// ============================================================================
// Math Primitives
// ============================================================================

export const add: PrimitiveGadget = {
  type: 'add',
  inputs: ['a', 'b'],
  outputs: ['sum'],
  activation: (inputs) => {
    const a = inputs.get('a')
    const b = inputs.get('b')
    return a !== undefined && b !== undefined && 
           typeof a === 'number' && typeof b === 'number'
  },
  execute: (inputs) => {
    const a = Number(inputs.get('a'))
    const b = Number(inputs.get('b'))
    return new Map([['sum', a + b]])
  }
}

export const multiply: PrimitiveGadget = {
  type: 'multiply',
  inputs: ['a', 'b'],
  outputs: ['product'],
  activation: (inputs) => {
    const a = inputs.get('a')
    const b = inputs.get('b')
    return a !== undefined && b !== undefined && 
           typeof a === 'number' && typeof b === 'number'
  },
  execute: (inputs) => {
    const a = Number(inputs.get('a'))
    const b = Number(inputs.get('b'))
    return new Map([['product', a * b]])
  }
}

export const subtract: PrimitiveGadget = {
  type: 'subtract',
  inputs: ['a', 'b'],
  outputs: ['difference'],
  activation: (inputs) => {
    const a = inputs.get('a')
    const b = inputs.get('b')
    return a !== undefined && b !== undefined && 
           typeof a === 'number' && typeof b === 'number'
  },
  execute: (inputs) => {
    const a = Number(inputs.get('a'))
    const b = Number(inputs.get('b'))
    return new Map([['difference', a - b]])
  }
}

export const divide: PrimitiveGadget = {
  type: 'divide',
  inputs: ['a', 'b'],
  outputs: ['quotient'],
  activation: (inputs) => {
    const a = inputs.get('a')
    const b = inputs.get('b')
    return a !== undefined && b !== undefined && 
           typeof a === 'number' && typeof b === 'number' && b !== 0
  },
  execute: (inputs) => {
    const a = Number(inputs.get('a'))
    const b = Number(inputs.get('b'))
    return new Map([['quotient', a / b]])
  }
}

// ============================================================================
// Logic Primitives
// ============================================================================

export const and: PrimitiveGadget = {
  type: 'and',
  inputs: ['a', 'b'],
  outputs: ['result'],
  activation: (inputs) => inputs.has('a') && inputs.has('b'),
  execute: (inputs) => {
    const a = inputs.get('a')
    const b = inputs.get('b')
    return new Map([['result', a && b]])
  }
}

export const or: PrimitiveGadget = {
  type: 'or',
  inputs: ['a', 'b'],
  outputs: ['result'],
  activation: (inputs) => inputs.has('a') && inputs.has('b'),
  execute: (inputs) => {
    const a = inputs.get('a')
    const b = inputs.get('b')
    return new Map([['result', a || b]])
  }
}

export const not: PrimitiveGadget = {
  type: 'not',
  inputs: ['value'],
  outputs: ['result'],
  activation: (inputs) => inputs.has('value'),
  execute: (inputs) => {
    const value = inputs.get('value')
    return new Map([['result', !value]])
  }
}

export const gate: PrimitiveGadget = {
  type: 'gate',
  inputs: ['value', 'enabled'],
  outputs: ['output'],
  activation: (inputs) => inputs.has('value') && inputs.has('enabled') && inputs.get('enabled'),
  execute: (inputs) => {
    const value = inputs.get('value')
    return new Map([['output', value]])
  }
}

// ============================================================================
// String Primitives
// ============================================================================

export const concat: PrimitiveGadget = {
  type: 'concat',
  inputs: ['a', 'b'],
  outputs: ['result'],
  activation: (inputs) => {
    // Allow concat to work even with null/undefined
    return inputs.has('a') && inputs.has('b')
  },
  execute: (inputs) => {
    const a = inputs.get('a')
    const b = inputs.get('b')
    // Handle null/undefined gracefully
    const strA = a === null || a === undefined ? '' : String(a)
    const strB = b === null || b === undefined ? '' : String(b)
    return new Map([['result', strA + strB]])
  }
}

export const split: PrimitiveGadget = {
  type: 'split',
  inputs: ['text', 'separator'],
  outputs: ['parts'],
  activation: (inputs) => inputs.has('text') && inputs.has('separator'),
  execute: (inputs) => {
    const text = String(inputs.get('text'))
    const separator = String(inputs.get('separator'))
    return new Map([['parts', text.split(separator)]])
  }
}

// ============================================================================
// Stream Processing Primitives
// ============================================================================

/**
 * Filter events based on a predicate.
 * This is designed to work with stream contacts (blendMode: 'last').
 */
export const filterEvents: PrimitiveGadget = {
  type: 'filter-events',
  inputs: ['events', 'predicate'],
  outputs: ['filtered'],
  activation: (inputs) => inputs.has('events'),
  execute: (inputs) => {
    const events = inputs.get('events')
    const predicate = inputs.get('predicate')
    
    if (!Array.isArray(events)) {
      return new Map([['filtered', events]])
    }
    
    // If no predicate, pass through
    if (!predicate) {
      return new Map([['filtered', events]])
    }
    
    // Filter based on predicate
    const filtered = events.filter((event: any) => {
      if (typeof predicate === 'function') {
        return predicate(event)
      }
      // Simple string matching on event type
      if (typeof predicate === 'string' && Array.isArray(event)) {
        return event[0] === predicate
      }
      return true
    })
    
    return new Map([['filtered', filtered]])
  }
}

/**
 * Transform events to actions.
 * Useful for creating scheduler circuits.
 */
export const eventsToActions: PrimitiveGadget = {
  type: 'events-to-actions',
  inputs: ['events'],
  outputs: ['actions'],
  activation: (inputs) => inputs.has('events'),
  execute: (inputs) => {
    const events = inputs.get('events')
    
    if (!Array.isArray(events)) {
      return new Map([['actions', { actions: [] }]])
    }
    
    const actions: any[] = []
    
    for (const event of events) {
      if (!Array.isArray(event)) continue
      
      const [type, ...args] = event
      
      // Convert propagation events to actions
      switch (type) {
        case 'valueChanged':
          const [contactId, , newValue] = args
          actions.push(['setValue', contactId, newValue])
          break
        
        // Add more event-to-action transformations as needed
      }
    }
    
    return new Map([['actions', { actions, timestamp: Date.now() }]])
  }
}

// ============================================================================
// Comparison Primitives
// ============================================================================

export const equals: PrimitiveGadget = {
  type: 'equals',
  inputs: ['a', 'b'],
  outputs: ['result'],
  activation: (inputs) => inputs.has('a') && inputs.has('b'),
  execute: (inputs) => {
    const a = inputs.get('a')
    const b = inputs.get('b')
    return new Map([['result', a === b]])
  }
}

export const greaterThan: PrimitiveGadget = {
  type: 'greater-than',
  inputs: ['a', 'b'],
  outputs: ['result'],
  activation: (inputs) => inputs.has('a') && inputs.has('b'),
  execute: (inputs) => {
    const a = inputs.get('a')
    const b = inputs.get('b')
    return new Map([['result', a > b]])
  }
}

export const lessThan: PrimitiveGadget = {
  type: 'less-than',
  inputs: ['a', 'b'],
  outputs: ['result'],
  activation: (inputs) => inputs.has('a') && inputs.has('b'),
  execute: (inputs) => {
    const a = inputs.get('a')
    const b = inputs.get('b')
    return new Map([['result', a < b]])
  }
}

// ============================================================================
// Registry
// ============================================================================

/**
 * Get all primitive gadgets as a Map.
 */
export function getPrimitives(): Map<string, PrimitiveGadget> {
  return new Map([
    // Math
    ['add', add],
    ['multiply', multiply],
    ['subtract', subtract],
    ['divide', divide],
    
    // Logic
    ['and', and],
    ['or', or],
    ['not', not],
    ['gate', gate],
    
    // String
    ['concat', concat],
    ['split', split],
    
    // Stream
    ['filter-events', filterEvents],
    ['events-to-actions', eventsToActions],
    
    // Comparison
    ['equals', equals],
    ['greater-than', greaterThan],
    ['less-than', lessThan]
  ])
}