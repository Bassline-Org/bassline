/**
 * VisualNode - A Network that includes visual properties
 * 
 * Visual properties (position, size, etc.) are just cells in the network,
 * allowing them to participate in the propagation system.
 */

import { Network } from '../src/network'
import { OrdinalCell } from '../src/cells/basic'
import type { Gadget } from '../src/gadget'
import { dict, num, bool } from '../src/lattice-types'

export class VisualNode extends Network {
  // Visual properties as cells
  position: OrdinalCell
  size: OrdinalCell
  selected: OrdinalCell
  collapsed: OrdinalCell
  
  // Optional content gadget
  content?: Gadget
  
  constructor(id: string, content?: Gadget) {
    super(id)
    
    // Create visual property cells
    this.position = new OrdinalCell(`${id}-position`)
    this.size = new OrdinalCell(`${id}-size`)
    this.selected = new OrdinalCell(`${id}-selected`)
    this.collapsed = new OrdinalCell(`${id}-collapsed`)
    
    // Initialize with default values
    this.position.userInput(dict({
      x: num(0),
      y: num(0)
    }))
    
    this.size.userInput(dict({
      width: num(150),
      height: num(100)
    }))
    
    this.selected.userInput(bool(false))
    this.collapsed.userInput(bool(false))
    
    // Add visual cells to this network
    this.add(this.position, this.size, this.selected, this.collapsed)
    
    // Add content if provided
    if (content) {
      this.content = content
      this.add(content)
    }
  }
  
  // Convenience method to set position
  setPosition(x: number, y: number): void {
    this.position.userInput(dict({
      x: num(x),
      y: num(y)
    }))
  }
  
  // Convenience method to set size
  setSize(width: number, height: number): void {
    this.size.userInput(dict({
      width: num(width),
      height: num(height)
    }))
  }
  
  // Convenience method to toggle selection
  setSelected(selected: boolean): void {
    this.selected.userInput(bool(selected))
  }
  
  // Convenience method to toggle collapsed state
  setCollapsed(collapsed: boolean): void {
    this.collapsed.userInput(bool(collapsed))
  }
  
  // Get all visual cells for easy access
  getVisualCells() {
    return {
      position: this.position,
      size: this.size,
      selected: this.selected,
      collapsed: this.collapsed
    }
  }
  
  // Serialize visual node to JSON
  serialize(): any {
    const base = super.serialize()
    
    // Visual properties are just cells in the network, 
    // they'll be serialized as part of the gadgets array
    // Just need to note which cells are visual properties
    base.visualProperties = {
      positionId: this.position.id,
      sizeId: this.size.id,
      selectedId: this.selected.id,
      collapsedId: this.collapsed.id
    }
    
    // Note content gadget if exists
    if (this.content) {
      base.contentId = this.content.id
    }
    
    return base
  }
  
  // Deserialize visual node from JSON
  static deserialize(data: any, registry: any): VisualNode {
    // Let the registry handle it
    return registry.deserializeNetwork(data)
  }
}