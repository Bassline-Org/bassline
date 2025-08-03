import { SetValue, Interval } from '../types/mergeable'
import { Contradiction } from '../types'

const BASSLINE_TYPE_KEY = '@bassline-type@'

interface SerializedValue {
  [BASSLINE_TYPE_KEY]: string
  data: any
}

/**
 * Serialize special value types for JSON storage
 */
export function serializeValue(value: any): any {
  if (value === undefined || value === null) {
    return value
  }
  
  // Handle Set
  if (value instanceof Set) {
    return {
      [BASSLINE_TYPE_KEY]: 'Set',
      data: Array.from(value)
    }
  }
  
  // Handle SetValue (our custom mergeable set)
  if (value instanceof SetValue) {
    return {
      [BASSLINE_TYPE_KEY]: 'SetValue',
      data: value.toArray()
    }
  }
  
  // Handle Interval
  if (value instanceof Interval) {
    return {
      [BASSLINE_TYPE_KEY]: 'Interval',
      data: {
        min: value.min,
        max: value.max
      }
    }
  }
  
  // Handle Contradiction
  if (value instanceof Contradiction) {
    return {
      [BASSLINE_TYPE_KEY]: 'Contradiction',
      data: value.reason
    }
  }
  
  // Handle Map
  if (value instanceof Map) {
    return {
      [BASSLINE_TYPE_KEY]: 'Map',
      data: Array.from(value.entries())
    }
  }
  
  // Handle Date
  if (value instanceof Date) {
    return {
      [BASSLINE_TYPE_KEY]: 'Date',
      data: value.toISOString()
    }
  }
  
  // Handle arrays recursively
  if (Array.isArray(value)) {
    return value.map(item => serializeValue(item))
  }
  
  // Handle plain objects recursively
  if (value !== null && typeof value === 'object' && value.constructor === Object) {
    const result: any = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeValue(val)
    }
    return result
  }
  
  // Return primitives as-is
  return value
}

/**
 * Deserialize special value types from JSON storage
 */
export function deserializeValue(value: any): any {
  if (value === undefined || value === null) {
    return value
  }
  
  // Check if it's a serialized special type
  if (value && typeof value === 'object' && BASSLINE_TYPE_KEY in value) {
    const serialized = value as SerializedValue
    
    switch (serialized[BASSLINE_TYPE_KEY]) {
      case 'Set':
        return new Set(serialized.data)
        
      case 'SetValue':
        return new SetValue(serialized.data)
        
      case 'Interval':
        return new Interval(serialized.data.min, serialized.data.max)
        
      case 'Contradiction':
        return new Contradiction(serialized.data)
        
      case 'Map':
        return new Map(serialized.data)
        
      case 'Date':
        return new Date(serialized.data)
        
      default:
        console.warn(`Unknown serialized type: ${serialized[BASSLINE_TYPE_KEY]}`)
        return value
    }
  }
  
  // Handle arrays recursively
  if (Array.isArray(value)) {
    return value.map(item => deserializeValue(item))
  }
  
  // Handle plain objects recursively
  if (value !== null && typeof value === 'object' && value.constructor === Object) {
    const result: any = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = deserializeValue(val)
    }
    return result
  }
  
  // Return primitives as-is
  return value
}