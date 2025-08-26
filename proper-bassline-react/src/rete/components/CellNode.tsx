/**
 * CellNode - Rete component for visualizing Cell gadgets
 * 
 * Displays cells with:
 * - Current value
 * - Multiple input sockets (cells can have many sources)
 * - Single output socket
 * - Different colors for cell types
 */

import { ClassicPreset } from 'rete'
import type { Cell, TypedCell } from 'proper-bassline/src/cell'
import { OrdinalCell, MaxCell, MinCell, UnionCell } from 'proper-bassline/src/cells/basic'
import type { LatticeValue } from 'proper-bassline/src/types'
import { CellControl } from './CustomControl'

export const VALUE_SOCKET = 'valueSocket'

export class CellNode extends ClassicPreset.Node {
  cell: Cell
  currentValue: LatticeValue | null = null
  
  constructor(cell: Cell) {
    super(cell.id)
    this.cell = cell
    
    // Add output socket
    this.addOutput('output', new ClassicPreset.Output(new ValueSocket(), 'Output', true))
    // Add input socket (cells can have multiple connections)
    this.addInput('input', new ClassicPreset.Input(new ValueSocket(), 'Input', true))
    
    // Store current value
    this.currentValue = this.cell.getOutput()
  }
}

/**
 * Socket for lattice values
 */
export class ValueSocket extends ClassicPreset.Socket {
  constructor() {
    super(VALUE_SOCKET)
  }
  
  isCompatibleWith(socket: ClassicPreset.Socket) {
    // All value sockets are compatible (lattice handles type merging)
    return socket instanceof ValueSocket
  }
}

/**
 * Legacy ValueControl for backward compatibility
 * New code should use CellControl with React components
 */
export class ValueControl extends ClassicPreset.Control {
  private cell: Cell
  public value: string = ''
  
  constructor(cell: Cell) {
    super()
    this.cell = cell
    this.updateValue()
  }
  
  updateValue() {
    const output = this.cell.getOutput()
    this.value = this.formatValue(output)
  }
  
  private formatValue(value: LatticeValue | null): string {
    if (!value) return 'nil'
    
    switch (value.type) {
      case 'number':
        return String(value.value)
      case 'string':
        return `"${value.value}"`
      case 'boolean':
        return value.value ? 'true' : 'false'
      case 'set':
        const items = Array.from(value.value as Set<any>)
          .map(v => this.formatValue(v))
          .join(', ')
        return `{${items}}`
      case 'array':
        const elements = (value.value as any[])
          .map(v => this.formatValue(v))
          .join(', ')
        return `[${elements}]`
      case 'dict':
        const entries = Array.from((value.value as Map<string, any>).entries())
          .map(([k, v]) => `${k}: ${this.formatValue(v)}`)
          .join(', ')
        return `{${entries}}`
      default:
        return JSON.stringify(value.value)
    }
  }
}