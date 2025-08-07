import type { Position } from './index'

export interface ContactTemplate {
  position: Position
  isBoundary: boolean
  boundaryDirection?: 'input' | 'output'
  name?: string
  blendMode: 'accept-last' | 'merge'
  content?: any // Store the contact's current value
}

export interface WireTemplate {
  fromIndex: number // Index into the contacts array
  toIndex: number
  type: 'bidirectional' | 'directed'
  // For connections to subgroup boundaries
  fromSubgroupIndex?: number // If fromIndex is -1, this indicates which subgroup
  toSubgroupIndex?: number   // If toIndex is -1, this indicates which subgroup
  // The actual boundary contact is identified by matching position/name in the subgroup
  fromBoundaryName?: string
  toBoundaryName?: string
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
  // Primitive gadgets need special handling during deserialization
  isPrimitive?: boolean
  primitiveType?: string // The specific primitive type (e.g., 'Adder', 'Splitter')
}