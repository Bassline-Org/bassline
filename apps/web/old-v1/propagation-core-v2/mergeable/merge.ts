// Core merge logic for tagged collections and primitives

import { Contradiction, isTaggedCollection } from './index'
import { structuralEquals } from './equality'
import type { 
  GrowSet, ShrinkSet, 
  GrowArray, ShrinkArray, 
  GrowMap, ShrinkMap 
} from './index'

// Main merge function - handles all mergeable types
export async function mergeContent(a: unknown, b: unknown): Promise<unknown> {
  // Handle null/undefined
  if (a === undefined || a === null) return b
  if (b === undefined || b === null) return a
  
  // Structural equality check - if same value, return it
  if (structuralEquals(a, b)) return a
  
  // Handle tagged collections
  if (isTaggedCollection(a) && isTaggedCollection(b)) {
    return mergeTaggedCollections(a, b)
  }
  
  // Mixed tagged and untagged - try to handle gracefully
  if (isTaggedCollection(a) && !isTaggedCollection(b)) {
    return mergeTaggedWithUntagged(a, b)
  }
  
  if (!isTaggedCollection(a) && isTaggedCollection(b)) {
    return mergeTaggedWithUntagged(b, a)
  }
  
  // Plain JavaScript collections (legacy support - treat as growing)
  if (a instanceof Set && b instanceof Set) {
    return new Set([...a, ...b])
  }
  
  if (a instanceof Map && b instanceof Map) {
    const result = new Map(a)
    for (const [key, valueB] of b) {
      if (result.has(key)) {
        const valueA = result.get(key)
        const merged = await mergeContent(valueA, valueB)
        result.set(key, merged)
      } else {
        result.set(key, valueB)
      }
    }
    return result
  }
  
  if (Array.isArray(a) && Array.isArray(b)) {
    return [...a, ...b]
  }
  
  // Different scalar values or incompatible types
  throw new Contradiction('Values cannot be merged', a, b)
}

// Merge two tagged collections
function mergeTaggedCollections(a: any, b: any): unknown {
  // Must be same type to merge
  if (a._tag !== b._tag) {
    throw new Contradiction('Cannot merge different collection types', a, b)
  }
  
  switch (a._tag) {
    case 'GrowSet':
      return mergeGrowSets(a as GrowSet<any>, b as GrowSet<any>)
    
    case 'ShrinkSet':
      return mergeShrinkSets(a as ShrinkSet<any>, b as ShrinkSet<any>)
    
    case 'GrowArray':
      return mergeGrowArrays(a as GrowArray<any>, b as GrowArray<any>)
    
    case 'ShrinkArray':
      return mergeShrinkArrays(a as ShrinkArray<any>, b as ShrinkArray<any>)
    
    case 'GrowMap':
      return mergeGrowMaps(a as GrowMap<any, any>, b as GrowMap<any, any>)
    
    case 'ShrinkMap':
      return mergeShrinkMaps(a as ShrinkMap<any, any>, b as ShrinkMap<any, any>)
    
    default:
      throw new Contradiction(`Unknown collection type: ${a._tag}`, a, b)
  }
}

// Merge tagged collection with untagged value
function mergeTaggedWithUntagged(tagged: any, untagged: unknown): unknown {
  switch (tagged._tag) {
    case 'GrowSet':
      if (untagged instanceof Set) {
        return {
          _tag: 'GrowSet',
          values: new Set([...tagged.values, ...untagged])
        }
      }
      break
    
    case 'ShrinkSet':
      if (untagged instanceof Set) {
        const intersection = new Set([...tagged.values].filter(x => untagged.has(x)))
        if (intersection.size === 0) {
          throw new Contradiction('Empty set intersection', tagged, untagged)
        }
        return {
          _tag: 'ShrinkSet',
          values: intersection
        }
      }
      break
    
    case 'GrowArray':
      if (Array.isArray(untagged)) {
        return {
          _tag: 'GrowArray',
          items: [...tagged.items, ...untagged]
        }
      }
      break
    
    case 'ShrinkArray':
      if (Array.isArray(untagged)) {
        const taggedSet = new Set(tagged.items)
        const untaggedSet = new Set(untagged)
        const intersection = [...taggedSet].filter(x => untaggedSet.has(x))
        if (intersection.length === 0) {
          throw new Contradiction('Empty array intersection', tagged, untagged)
        }
        return {
          _tag: 'ShrinkArray',
          items: intersection
        }
      }
      break
    
    case 'GrowMap':
      if (untagged instanceof Map) {
        const result = new Map(tagged.entries)
        for (const [key, value] of untagged) {
          if (result.has(key)) {
            const merged = mergeContent(result.get(key), value)
            result.set(key, merged)
          } else {
            result.set(key, value)
          }
        }
        return {
          _tag: 'GrowMap',
          entries: result
        }
      }
      break
    
    case 'ShrinkMap':
      if (untagged instanceof Map) {
        const result = new Map()
        for (const [key, valueA] of tagged.entries) {
          if (untagged.has(key)) {
            const valueB = untagged.get(key)
            const merged = mergeContent(valueA, valueB)
            result.set(key, merged)
          }
        }
        if (result.size === 0) {
          throw new Contradiction('Empty map intersection', tagged, untagged)
        }
        return {
          _tag: 'ShrinkMap',
          entries: result
        }
      }
      break
  }
  
  throw new Contradiction('Cannot merge tagged collection with incompatible type', tagged, untagged)
}

// Individual merge functions for each collection type

function mergeGrowSets<T>(a: GrowSet<T>, b: GrowSet<T>): GrowSet<T> {
  return {
    _tag: 'GrowSet',
    values: new Set([...a.values, ...b.values])
  }
}

function mergeShrinkSets<T>(a: ShrinkSet<T>, b: ShrinkSet<T>): ShrinkSet<T> {
  const intersection = new Set([...a.values].filter(x => b.values.has(x)))
  if (intersection.size === 0) {
    throw new Contradiction('Empty set intersection', a, b)
  }
  return {
    _tag: 'ShrinkSet',
    values: intersection
  }
}

function mergeGrowArrays<T>(a: GrowArray<T>, b: GrowArray<T>): GrowArray<T> {
  return {
    _tag: 'GrowArray',
    items: [...a.items, ...b.items]
  }
}

function mergeShrinkArrays<T>(a: ShrinkArray<T>, b: ShrinkArray<T>): ShrinkArray<T> {
  const aSet = new Set(a.items)
  const bSet = new Set(b.items)
  const intersection = [...aSet].filter(x => bSet.has(x))
  if (intersection.length === 0) {
    throw new Contradiction('Empty array intersection', a, b)
  }
  return {
    _tag: 'ShrinkArray',
    items: intersection
  }
}

async function mergeGrowMaps<K, V>(a: GrowMap<K, V>, b: GrowMap<K, V>): Promise<GrowMap<K, V>> {
  const result = new Map(a.entries)
  for (const [key, valueB] of b.entries) {
    if (result.has(key)) {
      const valueA = result.get(key)
      const merged = await mergeContent(valueA, valueB)
      result.set(key, merged)
    } else {
      result.set(key, valueB)
    }
  }
  return {
    _tag: 'GrowMap',
    entries: result
  }
}

async function mergeShrinkMaps<K, V>(a: ShrinkMap<K, V>, b: ShrinkMap<K, V>): Promise<ShrinkMap<K, V>> {
  const result = new Map<K, V>()
  
  // Only keep keys present in both maps
  for (const [key, valueA] of a.entries) {
    if (b.entries.has(key)) {
      const valueB = b.entries.get(key)
      const merged = await mergeContent(valueA, valueB)
      result.set(key, merged as V)
    }
  }
  
  if (result.size === 0) {
    throw new Contradiction('Empty map intersection', a, b)
  }
  return {
    _tag: 'ShrinkMap',
    entries: result
  }
}