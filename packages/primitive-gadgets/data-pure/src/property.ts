/**
 * Pure property manipulation gadgets
 * These gadgets work with object properties and paths
 */

import type { PrimitiveGadget } from '@bassline/core'

export function getProperty(): PrimitiveGadget {
  return {
    id: 'get-property',
    name: 'Get Property',
    inputs: ['object', 'path'],
    outputs: ['value', 'exists'],
    activation: (inputs) => inputs.has('object') && inputs.has('path'),
    body: async (inputs) => {
      const obj = inputs.get('object')
      const path = String(inputs.get('path'))
      
      // Support dot notation and bracket notation
      const keys = path.split(/\.|\[|\]/).filter(k => k)
      
      let current: any = obj
      let exists = true
      
      for (const key of keys) {
        if (current == null || typeof current !== 'object') {
          exists = false
          current = undefined
          break
        }
        
        // Handle array indices
        const index = parseInt(key, 10)
        if (!isNaN(index) && Array.isArray(current)) {
          current = current[index]
        } else {
          current = current[key]
        }
        
        if (current === undefined) {
          exists = false
          break
        }
      }
      
      return new Map([
        ['value', current],
        ['exists', exists]
      ])
    },
    description: 'Gets nested property value from object',
    category: 'data',
    isPure: true
  }
}

export function setProperty(): PrimitiveGadget {
  return {
    id: 'set-property',
    name: 'Set Property',
    inputs: ['object', 'path', 'value'],
    outputs: ['result', 'error'],
    activation: (inputs) => inputs.has('object') && inputs.has('path') && inputs.has('value'),
    body: async (inputs) => {
      const obj = inputs.get('object')
      const path = String(inputs.get('path'))
      const value = inputs.get('value')
      
      if (obj == null || typeof obj !== 'object') {
        return new Map([
          ['result', null],
          ['error', 'Input must be an object']
        ])
      }
      
      // Create a deep clone to maintain immutability
      const result = JSON.parse(JSON.stringify(obj))
      
      // Support dot notation
      const keys = path.split(/\.|\[|\]/).filter(k => k)
      
      let current: any = result
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i]
        const nextKey = keys[i + 1]
        const nextIsIndex = !isNaN(parseInt(nextKey, 10))
        
        if (!(key in current)) {
          current[key] = nextIsIndex ? [] : {}
        }
        
        current = current[key]
      }
      
      const lastKey = keys[keys.length - 1]
      current[lastKey] = value
      
      return new Map([
        ['result', result],
        ['error', null]
      ])
    },
    description: 'Sets nested property value in object (returns new object)',
    category: 'data',
    isPure: true
  }
}

export function deleteProperty(): PrimitiveGadget {
  return {
    id: 'delete-property',
    name: 'Delete Property',
    inputs: ['object', 'path'],
    outputs: ['result', 'deleted'],
    activation: (inputs) => inputs.has('object') && inputs.has('path'),
    body: async (inputs) => {
      const obj = inputs.get('object')
      const path = String(inputs.get('path'))
      
      if (obj == null || typeof obj !== 'object') {
        return new Map([
          ['result', obj],
          ['deleted', false]
        ])
      }
      
      // Create a deep clone to maintain immutability
      const result = JSON.parse(JSON.stringify(obj))
      
      // Support dot notation
      const keys = path.split(/\.|\[|\]/).filter(k => k)
      
      let current: any = result
      let deleted = false
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i]
        if (!(key in current)) {
          return new Map([
            ['result', result],
            ['deleted', false]
          ])
        }
        current = current[key]
      }
      
      const lastKey = keys[keys.length - 1]
      if (lastKey in current) {
        delete current[lastKey]
        deleted = true
      }
      
      return new Map([
        ['result', result],
        ['deleted', deleted]
      ])
    },
    description: 'Deletes property from object (returns new object)',
    category: 'data',
    isPure: true
  }
}

export function mergeObjects(): PrimitiveGadget {
  return {
    id: 'merge-objects',
    name: 'Merge Objects',
    inputs: ['object1', 'object2', 'deep'],
    outputs: ['result'],
    activation: (inputs) => inputs.has('object1') && inputs.has('object2'),
    body: async (inputs) => {
      const obj1 = inputs.get('object1')
      const obj2 = inputs.get('object2')
      const deep = Boolean(inputs.get('deep'))
      
      if (deep) {
        // Deep merge
        const deepMerge = (target: any, source: any): any => {
          if (source == null) return target
          if (target == null) return source
          
          if (typeof source !== 'object' || typeof target !== 'object') {
            return source
          }
          
          if (Array.isArray(source)) {
            return source
          }
          
          const result = { ...target }
          
          for (const key in source) {
            if (source.hasOwnProperty(key)) {
              if (typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
                result[key] = deepMerge(target[key], source[key])
              } else {
                result[key] = source[key]
              }
            }
          }
          
          return result
        }
        
        return new Map([['result', deepMerge(obj1, obj2)]])
      } else {
        // Shallow merge
        return new Map([['result', { ...obj1 as any, ...obj2 as any }]])
      }
    },
    description: 'Merges two objects',
    category: 'data',
    isPure: true
  }
}

export function pickProperties(): PrimitiveGadget {
  return {
    id: 'pick-properties',
    name: 'Pick Properties',
    inputs: ['object', 'keys'],
    outputs: ['result'],
    activation: (inputs) => inputs.has('object') && inputs.has('keys'),
    body: async (inputs) => {
      const obj = inputs.get('object') as any
      const keys = inputs.get('keys') as string[]
      
      if (!obj || typeof obj !== 'object') {
        return new Map([['result', {}]])
      }
      
      const result: any = {}
      
      for (const key of keys) {
        if (key in obj) {
          result[key] = obj[key]
        }
      }
      
      return new Map([['result', result]])
    },
    description: 'Picks specified properties from object',
    category: 'data',
    isPure: true
  }
}

export function omitProperties(): PrimitiveGadget {
  return {
    id: 'omit-properties',
    name: 'Omit Properties',
    inputs: ['object', 'keys'],
    outputs: ['result'],
    activation: (inputs) => inputs.has('object') && inputs.has('keys'),
    body: async (inputs) => {
      const obj = inputs.get('object') as any
      const keys = inputs.get('keys') as string[]
      
      if (!obj || typeof obj !== 'object') {
        return new Map([['result', {}]])
      }
      
      const result = { ...obj }
      
      for (const key of keys) {
        delete result[key]
      }
      
      return new Map([['result', result]])
    },
    description: 'Omits specified properties from object',
    category: 'data',
    isPure: true
  }
}