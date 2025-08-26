/**
 * CanvasView - The main editor canvas as a ViewGadget
 * 
 * This IS the editor - it takes a Network as input and provides
 * visual editing capabilities. Everything is a gadget!
 */

import { ViewGadget } from '../../meta/view-gadget'
import { Network } from '../../src/network'
import { GroupGadget } from '../visuals/group'
import { RectGadget } from '../visuals/rect'
import { TextGadget } from '../visuals/text'
import { VisualGadget } from '../../meta/visual-gadget'
import { LatticeValue, nil, obj, num, str, set, dict } from '../lattice-types'
import { OrdinalCell } from '../../src/cells/basic'

export class CanvasView extends ViewGadget {
  // Canvas properties
  private width: OrdinalCell<number>
  private height: OrdinalCell<number>
  private zoom: OrdinalCell<number>
  private panX: OrdinalCell<number>
  private panY: OrdinalCell<number>
  
  // Selection state
  private selectedGadgets: OrdinalCell<Set<string>>
  private hoveredGadget: OrdinalCell<string | null>
  
  // The network we're editing
  private editingNetwork: Network | null = null
  
  constructor(id: string = 'canvas-view') {
    super(id)
    
    // Initialize canvas properties
    this.width = new OrdinalCell(`${id}-width`)
    this.height = new OrdinalCell(`${id}-height`)
    this.zoom = new OrdinalCell(`${id}-zoom`)
    this.panX = new OrdinalCell(`${id}-pan-x`)
    this.panY = new OrdinalCell(`${id}-pan-y`)
    
    this.width.userInput(1200)
    this.height.userInput(800)
    this.zoom.userInput(1)
    this.panX.userInput(0)
    this.panY.userInput(0)
    
    // Initialize selection state
    this.selectedGadgets = new OrdinalCell(`${id}-selected`)
    this.hoveredGadget = new OrdinalCell(`${id}-hovered`)
    
    this.selectedGadgets.userInput(new Set())
    this.hoveredGadget.userInput(null)
    
    // Add cells to our network
    this.add(this.width, this.height, this.zoom, this.panX, this.panY)
    this.add(this.selectedGadgets, this.hoveredGadget)
  }
  
  /**
   * Set the network we're editing
   */
  setEditingNetwork(network: Network) {
    this.editingNetwork = network
    // Trigger recompute
    this.emit()
  }
  
  /**
   * Compute the visual representation of the canvas
   */
  compute(): LatticeValue {
    // Create the main canvas container
    const canvas = new GroupGadget(`${this.id}-canvas`)
    canvas.setSize(this.width.getValue() || 1200, this.height.getValue() || 800)
    
    // Add background
    const bg = new RectGadget(`${this.id}-bg`)
    bg.setPosition(0, 0)
    bg.setSize(this.width.getValue() || 1200, this.height.getValue() || 800)
    bg.setBackgroundColor('#fafafa')
    canvas.add(bg)
    
    // Add grid pattern (optional)
    const gridSize = 20
    const gridGroup = new GroupGadget(`${this.id}-grid`)
    gridGroup.setPosition(0, 0)
    
    // Vertical lines
    for (let x = 0; x <= (this.width.getValue() || 1200); x += gridSize) {
      const line = new RectGadget(`grid-v-${x}`)
      line.setPosition(x, 0)
      line.setSize(1, this.height.getValue() || 800)
      line.setBackgroundColor('#e5e7eb')
      gridGroup.add(line)
    }
    
    // Horizontal lines
    for (let y = 0; y <= (this.height.getValue() || 800); y += gridSize) {
      const line = new RectGadget(`grid-h-${y}`)
      line.setPosition(0, y)
      line.setSize(this.width.getValue() || 1200, 1)
      line.setBackgroundColor('#e5e7eb')
      gridGroup.add(line)
    }
    
    canvas.add(gridGroup)
    
    // Create viewport for pan/zoom
    const viewport = new GroupGadget(`${this.id}-viewport`)
    viewport.setTranslate(this.panX.getValue() || 0, this.panY.getValue() || 0)
    viewport.setScale(this.zoom.getValue() || 1)
    
    // Render the network being edited
    if (this.editingNetwork) {
      this.renderNetwork(viewport, this.editingNetwork)
    }
    
    canvas.add(viewport)
    
    // Add selection overlays
    this.renderSelection(canvas)
    
    return obj(canvas)
  }
  
  /**
   * Render gadgets from the network
   */
  private renderNetwork(container: GroupGadget, network: Network) {
    // Iterate through all gadgets in the network
    for (const gadget of network.gadgets) {
      if (gadget instanceof VisualGadget) {
        // Visual gadgets render themselves
        container.add(gadget)
      } else {
        // Non-visual gadgets get a default representation
        const gadgetGroup = this.createGadgetVisual(gadget)
        container.add(gadgetGroup)
      }
    }
    
    // TODO: Render connections between gadgets
  }
  
  /**
   * Create a visual representation for non-visual gadgets
   */
  private createGadgetVisual(gadget: any): GroupGadget {
    const group = new GroupGadget(`visual-${gadget.id}`)
    
    // Default position (could be stored in metadata)
    const x = Math.random() * 500
    const y = Math.random() * 300
    group.setPosition(x, y)
    
    // Background
    const bg = new RectGadget(`${gadget.id}-bg`)
    bg.setPosition(0, 0)
    bg.setSize(150, 60)
    bg.setBackgroundColor('#ffffff')
    bg.setBorderRadius(8)
    group.add(bg)
    
    // Border
    const border = new RectGadget(`${gadget.id}-border`)
    border.setPosition(0, 0)
    border.setSize(150, 60)
    border.setBackgroundColor('transparent')
    border.setBorderWidth(2)
    border.setBorderColor('#d1d5db')
    border.setBorderRadius(8)
    group.add(border)
    
    // Label
    const label = new TextGadget(`${gadget.id}-label`)
    label.setPosition(10, 20)
    label.setSize(130, 20)
    label.setText(gadget.id)
    label.setFontSize(14)
    label.setColor('#111827')
    group.add(label)
    
    return group
  }
  
  /**
   * Render selection overlays
   */
  private renderSelection(canvas: GroupGadget) {
    const selected = this.selectedGadgets.getValue()
    if (!selected || selected.size === 0) return
    
    // Add selection indicators
    for (const gadgetId of selected) {
      const selectionRect = new RectGadget(`selection-${gadgetId}`)
      // Position would be based on actual gadget position
      selectionRect.setPosition(0, 0)
      selectionRect.setSize(154, 64)
      selectionRect.setBackgroundColor('transparent')
      selectionRect.setBorderWidth(2)
      selectionRect.setBorderColor('#3b82f6')
      selectionRect.setBorderRadius(10)
      canvas.add(selectionRect)
    }
  }
  
  // Canvas manipulation methods
  
  setCanvasSize(width: number, height: number) {
    this.width.userInput(width)
    this.height.userInput(height)
    // Trigger recompute
    this.emit()
  }
  
  setZoom(zoom: number) {
    this.zoom.userInput(Math.max(0.1, Math.min(5, zoom)))
    // Trigger recompute
    this.emit()
  }
  
  setPan(x: number, y: number) {
    this.panX.userInput(x)
    this.panY.userInput(y)
    // Trigger recompute
    this.emit()
  }
  
  selectGadget(gadgetId: string, multi: boolean = false) {
    const current = this.selectedGadgets.getValue() || new Set()
    const newSelection = multi ? new Set(current) : new Set<string>()
    newSelection.add(gadgetId)
    this.selectedGadgets.userInput(newSelection)
    // Trigger recompute
    this.emit()
  }
  
  clearSelection() {
    this.selectedGadgets.userInput(new Set())
    // Trigger recompute
    this.emit()
  }
}