import type { Position } from './index'

export interface ContactTemplate {
  position: Position
  isBoundary: boolean
  boundaryDirection?: 'input' | 'output'
  name?: string
  blendMode: 'accept-last' | 'merge'
}

export interface WireTemplate {
  fromIndex: number // Index into the contacts array
  toIndex: number
  type: 'bidirectional' | 'directed'
}

export interface GadgetTemplate {
  name: string
  description?: string
  category?: string
  contacts: ContactTemplate[]
  wires: WireTemplate[]
  subgroupTemplates: GadgetTemplate[]
  // Store which contacts are boundaries for this template
  boundaryIndices: number[]
}