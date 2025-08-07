// Tagged collection constructors and helpers

import type { 
  GrowSet, ShrinkSet, 
  GrowArray, ShrinkArray, 
  GrowMap, ShrinkMap,
  TaggedCollection 
} from './index'
import { isTaggedCollection } from './index'

// Growing collections - accumulate values via union
export const grow = {
  set: <T>(values?: Iterable<T>): GrowSet<T> => ({
    _tag: 'GrowSet',
    values: new Set(values)
  }),
  
  array: <T>(items?: T[]): GrowArray<T> => ({
    _tag: 'GrowArray',
    items: items ? [...items] : []
  }),
  
  map: <K, V>(entries?: Iterable<[K, V]>): GrowMap<K, V> => ({
    _tag: 'GrowMap',
    entries: new Map(entries)
  })
}

// Shrinking collections - narrow down via intersection
export const shrink = {
  set: <T>(values?: Iterable<T>): ShrinkSet<T> => ({
    _tag: 'ShrinkSet',
    values: new Set(values)
  }),
  
  array: <T>(items?: T[]): ShrinkArray<T> => ({
    _tag: 'ShrinkArray',
    items: items ? [...items] : []
  }),
  
  map: <K, V>(entries?: Iterable<[K, V]>): ShrinkMap<K, V> => ({
    _tag: 'ShrinkMap',
    entries: new Map(entries)
  })
}

// Type guards for specific collection types
export function isGrowSet<T>(value: unknown): value is GrowSet<T> {
  return typeof value === 'object' && 
         value !== null && 
         (value as any)._tag === 'GrowSet'
}

export function isShrinkSet<T>(value: unknown): value is ShrinkSet<T> {
  return typeof value === 'object' && 
         value !== null && 
         (value as any)._tag === 'ShrinkSet'
}

export function isGrowArray<T>(value: unknown): value is GrowArray<T> {
  return typeof value === 'object' && 
         value !== null && 
         (value as any)._tag === 'GrowArray'
}

export function isShrinkArray<T>(value: unknown): value is ShrinkArray<T> {
  return typeof value === 'object' && 
         value !== null && 
         (value as any)._tag === 'ShrinkArray'
}

export function isGrowMap<K, V>(value: unknown): value is GrowMap<K, V> {
  return typeof value === 'object' && 
         value !== null && 
         (value as any)._tag === 'GrowMap'
}

export function isShrinkMap<K, V>(value: unknown): value is ShrinkMap<K, V> {
  return typeof value === 'object' && 
         value !== null && 
         (value as any)._tag === 'ShrinkMap'
}

// Helper to get the underlying data from a tagged collection
export function getCollectionData(collection: TaggedCollection): Set<any> | any[] | Map<any, any> {
  switch (collection._tag) {
    case 'GrowSet':
    case 'ShrinkSet':
      return collection.values
    case 'GrowArray':
    case 'ShrinkArray':
      return collection.items
    case 'GrowMap':
    case 'ShrinkMap':
      return collection.entries
  }
}

// Helper to check if collection is empty
export function isEmptyCollection(collection: TaggedCollection): boolean {
  const data = getCollectionData(collection)
  if (data instanceof Set || data instanceof Map) {
    return data.size === 0
  }
  if (Array.isArray(data)) {
    return data.length === 0
  }
  return false
}

// Convert tagged collections to plain JavaScript objects for serialization
export function serializeTaggedCollection(collection: TaggedCollection): any {
  switch (collection._tag) {
    case 'GrowSet':
    case 'ShrinkSet':
      return {
        _tag: collection._tag,
        values: Array.from(collection.values).map(serializeValue)
      }
    case 'GrowArray':
    case 'ShrinkArray':
      return {
        _tag: collection._tag,
        items: collection.items.map(serializeValue)
      }
    case 'GrowMap':
    case 'ShrinkMap':
      return {
        _tag: collection._tag,
        entries: Array.from(collection.entries).map(([key, value]) => [serializeValue(key), serializeValue(value)])
      }
  }
}

// Helper to recursively serialize values that might contain tagged collections
function serializeValue(value: unknown): unknown {
  if (isTaggedCollection(value)) {
    return serializeTaggedCollection(value)
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue)
  }
  if (value && typeof value === 'object' && value.constructor === Object) {
    const result: any = {}
    for (const [k, v] of Object.entries(value)) {
      result[k] = serializeValue(v)
    }
    return result
  }
  return value
}

// Deserialize from plain objects back to tagged collections
export function deserializeTaggedCollection(obj: any): TaggedCollection {
  switch (obj._tag) {
    case 'GrowSet':
      return grow.set(obj.values.map(deserializeValue))
    case 'ShrinkSet':
      return shrink.set(obj.values.map(deserializeValue))
    case 'GrowArray':
      return grow.array(obj.items.map(deserializeValue))
    case 'ShrinkArray':
      return shrink.array(obj.items.map(deserializeValue))
    case 'GrowMap':
      return grow.map(obj.entries.map(([key, value]: [any, any]) => [deserializeValue(key), deserializeValue(value)]))
    case 'ShrinkMap':
      return shrink.map(obj.entries.map(([key, value]: [any, any]) => [deserializeValue(key), deserializeValue(value)]))
    default:
      throw new Error(`Unknown tagged collection type: ${obj._tag}`)
  }
}

// Helper to recursively deserialize values that might contain tagged collections
function deserializeValue(value: unknown): unknown {
  if (value && typeof value === 'object' && '_tag' in value) {
    return deserializeTaggedCollection(value)
  }
  if (Array.isArray(value)) {
    return value.map(deserializeValue)
  }
  if (value && typeof value === 'object' && value.constructor === Object) {
    const result: any = {}
    for (const [k, v] of Object.entries(value)) {
      result[k] = deserializeValue(v)
    }
    return result
  }
  return value
}