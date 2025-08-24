/**
 * ProjectionGadget - Transforms query results into visual layouts
 * 
 * Takes three inputs:
 * - results: Set of gadget IDs from a query
 * - layout: Layout type ('list' | 'grid' | 'tree')
 * - params: Layout parameters (spacing, columns, etc.)
 * 
 * Outputs a reference to the container with visual gadgets
 */

import { FunctionGadget } from './function'
import { GroupGadget, RectGadget, TextGadget } from './visuals'
import { getGadgetValue } from './value-helpers'
import { str, dict, num } from './types'
import type { LatticeValue } from './types'

/**
 * ProjectionGadget - Generates visual layouts from query results
 */
export class ProjectionGadget extends FunctionGadget {
  // Container that holds the generated visuals
  container: GroupGadget
  
  constructor(id: string = 'projection') {
    super(id, ['results', 'layout', 'params'])
    this.container = new GroupGadget(`${id}-container`)
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    // Extract actual values from OrdinalCell outputs
    let results = args.results
    if (results?.type === 'dict' && results.value.has('value')) {
      results = results.value.get('value')
    }
    
    let layout = args.layout
    if (layout?.type === 'dict' && layout.value.has('value')) {
      layout = layout.value.get('value')
    }
    
    let params = args.params
    if (params?.type === 'dict' && params.value.has('value')) {
      params = params.value.get('value')
    }
    
    // Clear container
    this.container.gadgets.clear()
    
    // Extract results set
    if (!results || results.type !== 'set') {
      return dict(new Map([['container', str(this.container.id)]]))
    }
    
    // Extract layout type
    let layoutType = 'list'
    if (layout && layout.type === 'string') {
      layoutType = layout.value
    }
    
    // Extract params (convert from dict)
    const layoutParams = getGadgetValue({ getOutput: () => params } as any) || {}
    
    // Generate layout based on type
    switch (layoutType) {
      case 'grid':
        this.generateGridLayout(results.value, layoutParams)
        break
      case 'tree':
        this.generateTreeLayout(results.value, layoutParams)
        break
      default:
        this.generateListLayout(results.value, layoutParams)
    }
    
    // Return reference to container
    return dict(new Map([
      ['container', str(this.container.id)],
      ['count', num(this.container.gadgets.size)]
    ]))
  }
  
  private generateListLayout(ids: Set<LatticeValue>, params: any): void {
    const spacing = params?.spacing || 10
    const orientation = params?.orientation || 'vertical'
    
    let offset = 0
    let index = 0
    
    for (const idValue of ids) {
      const visual = new RectGadget(`${this.container.id}-item-${index}`)
      
      if (orientation === 'vertical') {
        visual.setPosition(0, offset)
        offset += 50 + spacing
      } else {
        visual.setPosition(offset, 0)
        offset += 100 + spacing
      }
      
      visual.setSize(100, 50)
      
      // Add label if ID is a string
      if (idValue.type === 'string') {
        const label = new TextGadget(`${this.container.id}-label-${index}`)
        label.setText(idValue.value)
        label.setPosition(5, 15)
        visual.add(label)
      }
      
      this.container.add(visual)
      index++
    }
  }
  
  private generateGridLayout(ids: Set<LatticeValue>, params: any): void {
    const columns = params?.columns || 3
    const spacing = params?.spacing || 10
    const cellWidth = params?.cellWidth || 100
    const cellHeight = params?.cellHeight || 100
    
    let index = 0
    
    for (const idValue of ids) {
      const row = Math.floor(index / columns)
      const col = index % columns
      
      const x = col * (cellWidth + spacing)
      const y = row * (cellHeight + spacing)
      
      const visual = new RectGadget(`${this.container.id}-grid-${index}`)
      visual.setPosition(x, y)
      visual.setSize(cellWidth, cellHeight)
      
      // Add label
      if (idValue.type === 'string') {
        const label = new TextGadget(`${this.container.id}-glabel-${index}`)
        label.setText(idValue.value)
        label.setPosition(5, 15)
        visual.add(label)
      }
      
      this.container.add(visual)
      index++
    }
  }
  
  private generateTreeLayout(ids: Set<LatticeValue>, params: any): void {
    const indent = params?.indent || 20
    const spacing = params?.spacing || 5
    
    let yOffset = 0
    let index = 0
    
    for (const idValue of ids) {
      const visual = new RectGadget(`${this.container.id}-tree-${index}`)
      
      // Simple tree layout - indent based on index modulo for demo
      const depth = index % 3
      visual.setPosition(depth * indent, yOffset)
      visual.setSize(150, 30)
      
      // Add label
      if (idValue.type === 'string') {
        const label = new TextGadget(`${this.container.id}-tlabel-${index}`)
        label.setText(idValue.value)
        label.setPosition(5, 8)
        visual.add(label)
      }
      
      this.container.add(visual)
      yOffset += 30 + spacing
      index++
    }
  }
}