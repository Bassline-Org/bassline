export type ContactId = string
export type WireId = string
export type GroupId = string

export interface Position {
  x: number
  y: number
}

export interface Mergeable<T> {
  merge(other: T): T | Contradiction
}

export class Contradiction {
  constructor(public readonly reason: string) {}
  
  isContradiction(): boolean {
    return true
  }
}

export type BlendMode = 'accept-last' | 'merge'
export type WireType = 'bidirectional' | 'directed'

export * from './settings'