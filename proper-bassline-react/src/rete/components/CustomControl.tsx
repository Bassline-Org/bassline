/**
 * CustomControl - Wrapper for React components as Rete controls
 */

import React from 'react'
import { ClassicPreset } from 'rete'
import type { Cell } from 'proper-bassline/src/cell'
import { OrdinalCell } from 'proper-bassline/src/cells/basic'

export class CellControl extends ClassicPreset.InputControl<"text"> {
  constructor(cell: Cell, onUpdate?: () => void) {
    super('text', { readonly: true, initial: cell.getValue() })
  }
}
/**
 * React component to render custom controls in Rete
 */
export function CustomControlComponent({ data }: { data: ReactControl }) {
  const Component = data.component
  return <Component {...data.props} />
}