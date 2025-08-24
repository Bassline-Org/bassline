/**
 * PathGadget - SVG-like path for drawing edges and connections
 */

import { VisualGadget } from '../visual-gadget'
import { OrdinalCell } from '../cells/basic'
import { num, str, array } from '../types'
import type { Point } from '../visual-gadget'

export class PathGadget extends VisualGadget {
  // Path-specific properties
  points: OrdinalCell           // Array of points
  strokeColor: OrdinalCell
  strokeWidth: OrdinalCell
  strokeDasharray: OrdinalCell
  fillColor: OrdinalCell
  closed: OrdinalCell           // Whether to close the path
  smooth: OrdinalCell           // Whether to use smooth curves
  
  constructor(id: string = 'path') {
    super(id)
    
    // Create path-specific cells
    this.points = new OrdinalCell(`${id}-points`)
    this.strokeColor = new OrdinalCell(`${id}-strokeColor`)
    this.strokeWidth = new OrdinalCell(`${id}-strokeWidth`)
    this.strokeDasharray = new OrdinalCell(`${id}-strokeDasharray`)
    this.fillColor = new OrdinalCell(`${id}-fillColor`)
    this.closed = new OrdinalCell(`${id}-closed`)
    this.smooth = new OrdinalCell(`${id}-smooth`)
    
    // Set defaults
    this.points.userInput(array([]))
    this.strokeColor.userInput(str('#000000'))
    this.strokeWidth.userInput(num(2))
    this.strokeDasharray.userInput(str(''))
    this.fillColor.userInput(str('none'))
    this.closed.userInput({ type: 'bool', value: false })
    this.smooth.userInput({ type: 'bool', value: false })
    
    // Add to network
    this.add(
      this.points,
      this.strokeColor,
      this.strokeWidth,
      this.strokeDasharray,
      this.fillColor,
      this.closed,
      this.smooth
    )
    
    // Set metadata
    this.setMetadata('shape', 'path')
  }
  
  // Convenience setters
  setPoints(points: Point[]): this {
    const pointValues = points.map(p => ({
      type: 'dict' as const,
      value: new Map([
        ['x', num(p.x)],
        ['y', num(p.y)]
      ])
    }))
    this.points.userInput(array(pointValues))
    return this
  }
  
  addPoint(point: Point): this {
    const current = this.points.getOutput()
    const currentPoints = current?.type === 'array' ? current.value : []
    const newPoint = {
      type: 'dict' as const,
      value: new Map([
        ['x', num(point.x)],
        ['y', num(point.y)]
      ])
    }
    this.points.userInput(array([...currentPoints, newPoint]))
    return this
  }
  
  setStrokeColor(color: string): this {
    this.strokeColor.userInput(str(color))
    return this
  }
  
  setStrokeWidth(width: number): this {
    this.strokeWidth.userInput(num(width))
    return this
  }
  
  setStrokeDasharray(dasharray: string): this {
    this.strokeDasharray.userInput(str(dasharray))
    return this
  }
  
  setFillColor(color: string): this {
    this.fillColor.userInput(str(color))
    return this
  }
  
  setClosed(closed: boolean): this {
    this.closed.userInput({ type: 'bool', value: closed })
    return this
  }
  
  setSmooth(smooth: boolean): this {
    this.smooth.userInput({ type: 'bool', value: smooth })
    return this
  }
  
  /**
   * Create a bezier curve between two points
   */
  setBezier(start: Point, end: Point, control1?: Point, control2?: Point): this {
    const points = [start]
    if (control1) points.push(control1)
    if (control2) points.push(control2)
    points.push(end)
    
    this.setPoints(points)
    this.setSmooth(true)
    return this
  }
  
  getRendererType(): string {
    return 'path'
  }
  
  serialize(): any {
    const base = super.serialize()
    base.type = 'path-gadget'
    base.pathProperties = {
      pointsId: this.points.id,
      strokeColorId: this.strokeColor.id,
      strokeWidthId: this.strokeWidth.id,
      strokeDasharrayId: this.strokeDasharray.id,
      fillColorId: this.fillColor.id,
      closedId: this.closed.id,
      smoothId: this.smooth.id
    }
    return base
  }
}