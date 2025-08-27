/**
 * CustomControl - Wrapper for React components as Rete controls
 */

import React from 'react'
import { ClassicPreset } from 'rete'
import type { Cell } from 'proper-bassline/src/cell'
import { OrdinalCell } from 'proper-bassline/src/cells/basic'

/**
 * Type for custom React controls
 */
export interface ReactControl {
  component: React.ComponentType<any>
  props: any
}

/**
 * Control class that holds a reference to a cell and component
 */
export class CustomControl extends ClassicPreset.Control {
  component: React.ComponentType<any>
  props: any
  
  constructor(component: React.ComponentType<any>, props: any) {
    super()
    this.component = component
    this.props = props
  }
}

/**
 * React component to render custom controls in Rete
 */
export function CustomControlComponent({ data }: { data: CustomControl }) {
  const Component = data.component
  return <Component {...data.props} />
}

/**
 * Legacy control for backward compatibility
 */
export class CellControl extends ClassicPreset.InputControl<"text"> {
  cell: Cell
  
  constructor(cell: Cell, onUpdate?: () => void) {
    const value = cell.getOutput()
    const stringValue = value ? JSON.stringify(value.value) : ''
    super('text', { readonly: true, initial: stringValue })
    this.cell = cell
  }
}