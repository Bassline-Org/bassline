/**
 * VisualGadget - Networks with visual properties as cells
 * 
 * Visual properties (position, size, style, etc.) are cells in the network,
 * allowing them to be wired, computed, and animated just like any other data.
 * This is the foundation of "UI as computation."
 */

import { Network } from '../src/network'
import { OrdinalCell } from '../src/cells/basic'
import { dict, num, bool, str } from '../src/lattice-types'
import type { LatticeValue } from '../src/lattice-types'
import { getGadgetValue } from '../src/value-helpers'

/**
 * Point in 2D space
 */
export interface Point {
  x: number
  y: number
}

/**
 * Size dimensions
 */
export interface Size {
  width: number
  height: number
}

/**
 * Rectangle bounds
 */
export interface Rect extends Point, Size {}

/**
 * Style properties as a map
 */
export type StyleMap = Record<string, any>

/**
 * Base class for all visual gadgets
 * Extends Network so visual gadgets can contain other gadgets
 */
export class VisualGadget extends Network {
  // Type for query system
  type = 'VisualGadget'
  
  // Visual properties as cells - can be wired!
  position: OrdinalCell
  size: OrdinalCell
  visible: OrdinalCell
  opacity: OrdinalCell
  zIndex: OrdinalCell
  style: OrdinalCell
  
  // Visual hierarchy (separate from gadget hierarchy)
  visualParent?: VisualGadget
  visualChildren: Set<VisualGadget> = new Set()
  
  constructor(id: string) {
    super(id)
    
    // Create visual property cells
    this.position = new OrdinalCell(`${id}-position`)
    this.size = new OrdinalCell(`${id}-size`)
    this.visible = new OrdinalCell(`${id}-visible`)
    this.opacity = new OrdinalCell(`${id}-opacity`)
    this.zIndex = new OrdinalCell(`${id}-zIndex`)
    this.style = new OrdinalCell(`${id}-style`)
    
    // Set default values
    this.position.userInput(dict({
      x: num(0),
      y: num(0)
    }))
    
    this.size.userInput(dict({
      width: num(100),
      height: num(100)
    }))
    
    this.visible.userInput(bool(true))
    this.opacity.userInput(num(1.0))
    this.zIndex.userInput(num(0))
    this.style.userInput(dict(new Map()))
    
    // Add visual cells to this network
    this.add(this.position, this.size, this.visible, this.opacity, this.zIndex, this.style)
    
    // Set metadata for querying
    this.setMetadata('visual', true)
  }
  
  // ============================================================================
  // Convenience methods for setting visual properties
  // ============================================================================
  
  setPosition(x: number, y: number): this {
    this.position.userInput(dict({
      x: num(x),
      y: num(y)
    }))
    return this
  }
  
  setSize(width: number, height: number): this {
    this.size.userInput(dict({
      width: num(width),
      height: num(height)
    }))
    return this
  }
  
  setVisible(visible: boolean): this {
    this.visible.userInput(bool(visible))
    return this
  }
  
  setOpacity(opacity: number): this {
    this.opacity.userInput(num(opacity))
    return this
  }
  
  setZIndex(zIndex: number): this {
    this.zIndex.userInput(num(zIndex))
    return this
  }
  
  setStyle(style: StyleMap): this {
    const styleMap = new Map<string, LatticeValue>()
    for (const [key, value] of Object.entries(style)) {
      if (typeof value === 'string') {
        styleMap.set(key, str(value))
      } else if (typeof value === 'number') {
        styleMap.set(key, num(value))
      } else if (typeof value === 'boolean') {
        styleMap.set(key, bool(value))
      }
    }
    this.style.userInput(dict(styleMap))
    return this
  }
  
  // ============================================================================
  // Visual hierarchy management
  // ============================================================================
  
  addVisualChild(child: VisualGadget): this {
    // Remove from previous parent if any
    if (child.visualParent) {
      child.visualParent.removeVisualChild(child)
    }
    
    // Add to our visual children
    this.visualChildren.add(child)
    child.visualParent = this
    
    // Also add as a gadget
    this.add(child)
    
    return this
  }
  
  removeVisualChild(child: VisualGadget): boolean {
    if (this.visualChildren.delete(child)) {
      child.visualParent = undefined
      this.remove(child)
      return true
    }
    return false
  }
  
  // ============================================================================
  // Bounds calculation
  // ============================================================================
  
  /**
   * Get the current bounds of this visual gadget
   * Extracts values from the position and size cells
   */
  getBounds(): Rect | null {
    const pos = getGadgetValue(this.position)
    const size = getGadgetValue(this.size)
    
    if (!pos || !size) return null
    
    return {
      x: pos.x || 0,
      y: pos.y || 0,
      width: size.width || 0,
      height: size.height || 0
    }
  }
  
  /**
   * Check if a point is within this gadget's bounds
   */
  containsPoint(point: Point): boolean {
    const bounds = this.getBounds()
    if (!bounds) return false
    
    return point.x >= bounds.x && 
           point.x <= bounds.x + bounds.width &&
           point.y >= bounds.y && 
           point.y <= bounds.y + bounds.height
  }
  
  // ============================================================================
  // Rendering hint (for React bridge)
  // ============================================================================
  
  /**
   * Get the type of visual renderer to use
   * Subclasses override this to specify their renderer
   */
  getRendererType(): string {
    return 'generic'
  }
  
  // ============================================================================
  // Serialization
  // ============================================================================
  
  serialize(): any {
    const base = super.serialize()
    
    base.type = 'visual-gadget'
    base.visualProperties = {
      positionId: this.position.id,
      sizeId: this.size.id,
      visibleId: this.visible.id,
      opacityId: this.opacity.id,
      zIndexId: this.zIndex.id,
      styleId: this.style.id
    }
    
    // Note visual children
    base.visualChildren = Array.from(this.visualChildren).map(c => c.id)
    
    return base
  }
}