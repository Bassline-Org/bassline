import { SetValue, StringSet } from '../types/mergeable'

/**
 * Detects if a value is "fat" - containing multiple sub-parts
 * Fat values include: arrays, sets, objects with multiple properties
 */
export function isFatValue(value: any): boolean {
  if (value === null || value === undefined) return false
  
  // Arrays with more than 1 element
  if (Array.isArray(value) && value.length > 1) return true
  
  // Set types
  if (value instanceof SetValue || value instanceof StringSet) {
    return value.size > 1
  }
  
  // Native Set
  if (value instanceof Set) {
    return value.size > 1
  }
  
  // Plain objects with multiple properties (but not class instances)
  if (typeof value === 'object' && value.constructor === Object) {
    return Object.keys(value).length > 1
  }
  
  // Maps
  if (value instanceof Map) {
    return value.size > 1
  }
  
  return false
}

/**
 * Gets the "thickness" of a value for visual representation
 * Returns a number between 1 and 5 representing visual thickness
 */
export function getValueThickness(value: any): number {
  if (!isFatValue(value)) return 1
  
  let size = 0
  
  if (Array.isArray(value)) {
    size = value.length
  } else if (value instanceof SetValue || value instanceof StringSet) {
    size = value.size
  } else if (value instanceof Set || value instanceof Map) {
    size = value.size
  } else if (typeof value === 'object' && value.constructor === Object) {
    size = Object.keys(value).length
  }
  
  // Map size to thickness (1-5)
  if (size <= 2) return 2
  if (size <= 5) return 3
  if (size <= 10) return 4
  return 5
}