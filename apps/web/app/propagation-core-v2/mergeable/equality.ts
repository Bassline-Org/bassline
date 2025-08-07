// Structural equality implementation for wire-safe comparisons

import type { TaggedCollection } from './index'

// Structural equality helper - compares values, not references
export function structuralEquals(a: unknown, b: unknown): boolean {
  // Reference equality (handles primitives and same object references)
  if (a === b) return true
  
  // Handle null/undefined cases
  if (a === null || b === null) return a === b
  if (a === undefined || b === undefined) return a === b
  
  // Different types
  if (typeof a !== typeof b) return false
  
  // Primitives are already handled by === above
  if (typeof a !== 'object') return false
  
  // Both are objects from here on
  const objA = a as any
  const objB = b as any
  
  // Arrays
  if (Array.isArray(objA) && Array.isArray(objB)) {
    if (objA.length !== objB.length) return false
    return objA.every((val: unknown, i: number) => structuralEquals(val, objB[i]))
  }
  
  // Sets
  if (objA instanceof Set && objB instanceof Set) {
    if (objA.size !== objB.size) return false
    for (const val of objA) {
      if (!objB.has(val)) return false
    }
    return true
  }
  
  // Maps
  if (objA instanceof Map && objB instanceof Map) {
    if (objA.size !== objB.size) return false
    for (const [key, val] of objA) {
      if (!objB.has(key) || !structuralEquals(val, objB.get(key))) {
        return false
      }
    }
    return true
  }
  
  // Tagged collections
  if ('_tag' in objA && '_tag' in objB) {
    if (objA._tag !== objB._tag) return false
    
    switch (objA._tag) {
      case 'GrowSet':
      case 'ShrinkSet':
        return structuralEquals(objA.values, objB.values)
      
      case 'GrowArray':
      case 'ShrinkArray':
        return structuralEquals(objA.items, objB.items)
      
      case 'GrowMap':
      case 'ShrinkMap':
        return structuralEquals(objA.entries, objB.entries)
      
      default:
        // Unknown tag - fall through to generic object comparison
        break
    }
  }
  
  // Generic object comparison (for plain objects)
  const keysA = Object.keys(objA)
  const keysB = Object.keys(objB)
  
  if (keysA.length !== keysB.length) return false
  
  for (const key of keysA) {
    if (!(key in objB) || !structuralEquals(objA[key], objB[key])) {
      return false
    }
  }
  
  return true
}

// Helper to detect circular references (future enhancement)
export function hasCircularReference(obj: unknown, seen = new WeakSet()): boolean {
  if (typeof obj !== 'object' || obj === null) return false
  
  if (seen.has(obj)) return true
  seen.add(obj)
  
  if (Array.isArray(obj)) {
    return obj.some(item => hasCircularReference(item, seen))
  }
  
  if (obj instanceof Set) {
    for (const value of obj) {
      if (hasCircularReference(value, seen)) return true
    }
    return false
  }
  
  if (obj instanceof Map) {
    for (const [key, value] of obj) {
      if (hasCircularReference(key, seen) || hasCircularReference(value, seen)) {
        return true
      }
    }
    return false
  }
  
  // Tagged collections
  const tagged = obj as any
  if ('_tag' in tagged) {
    const data = tagged.values || tagged.items || tagged.entries
    return hasCircularReference(data, seen)
  }
  
  // Generic object
  for (const value of Object.values(obj)) {
    if (hasCircularReference(value, seen)) return true
  }
  
  return false
}