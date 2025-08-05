// Core mergeable types and infrastructure

export class Contradiction {
  constructor(
    public readonly reason: string,
    public readonly leftValue?: unknown,
    public readonly rightValue?: unknown
  ) {}
  
  toString(): string {
    return `Contradiction: ${this.reason}`
  }
}

// Tagged collection types for explicit merge behavior
export interface GrowSet<T> {
  _tag: 'GrowSet'
  values: Set<T>
}

export interface ShrinkSet<T> {
  _tag: 'ShrinkSet'
  values: Set<T>
}

export interface GrowArray<T> {
  _tag: 'GrowArray'
  items: T[]
}

export interface ShrinkArray<T> {
  _tag: 'ShrinkArray'
  items: T[]
}

export interface GrowMap<K, V> {
  _tag: 'GrowMap'
  entries: Map<K, V>
}

export interface ShrinkMap<K, V> {
  _tag: 'ShrinkMap'
  entries: Map<K, V>
}

// Union type for all tagged collections
export type TaggedCollection = 
  | GrowSet<any>
  | ShrinkSet<any>
  | GrowArray<any>
  | ShrinkArray<any>
  | GrowMap<any, any>
  | ShrinkMap<any, any>

// Type guard for tagged collections
export function isTaggedCollection(value: unknown): value is TaggedCollection {
  return typeof value === 'object' && 
         value !== null && 
         '_tag' in value &&
         typeof (value as any)._tag === 'string' &&
         ['GrowSet', 'ShrinkSet', 'GrowArray', 'ShrinkArray', 'GrowMap', 'ShrinkMap'].includes((value as any)._tag)
}

// Re-export from other modules
export { structuralEquals } from './equality'
export { grow, shrink } from './collections'
export { mergeContent } from './merge'