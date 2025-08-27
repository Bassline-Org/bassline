import { ClassicPreset, GetSchemes } from 'rete'

// Node socket types
export const cellSocket = new ClassicPreset.Socket('cell')
export const propagatorSocket = new ClassicPreset.Socket('propagator')

// Base node class
export abstract class DeadNode extends ClassicPreset.Node {
  nodeType: 'cell' | 'propagator'
  prefix: string
  
  constructor(id: string, nodeType: 'cell' | 'propagator') {
    super(id)
    this.nodeType = nodeType
    this.prefix = id.split('.')[0] || 'main'
  }
}

// Connection type
export type DeadConnection = ClassicPreset.Connection<DeadNode, DeadNode>

// Schemes type
export type DeadSchemes = GetSchemes<DeadNode, DeadConnection>

// Export format types
export interface DeadCellExport {
  id: string
  merge: string
  initial?: any
  position?: { x: number; y: number }
}

export interface DeadPropagatorExport {
  id: string
  fn: string
  inputs: string[]
  outputs: string[]
  position?: { x: number; y: number }
}

export interface DeadNetworkExport {
  cells: DeadCellExport[]
  propagators: DeadPropagatorExport[]
  metadata?: {
    created: string
    version: string
    prefixes?: string[]
  }
}