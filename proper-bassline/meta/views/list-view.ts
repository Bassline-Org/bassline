/**
 * ListView - A FunctionGadget that renders query results as a vertical list
 * 
 * Inputs:
 * - items: Set of gadget IDs or values to display
 * - template: Function to create visual for each item
 * - spacing: Vertical spacing between items
 * - orientation: 'vertical' | 'horizontal'
 * 
 * Output:
 * - A Network containing positioned visual gadgets
 */

import { FunctionGadget } from '../../src/function'
import { Network } from '../../src/network'
import { RectGadget, TextGadget, GroupGadget } from '../visuals'
import { VisualGadget } from '../visual-gadget'
import { 
  LatticeValue, 
  LatticeSet,
  LatticeString,
  LatticeNumber,
  isSet, 
  isString, 
  isNumber,
  isDict,
  str,
  num,
  set as makeSet,
  dict,
  obj
} from '../../src/lattice-types'
import { OrdinalCell } from '../../src/cells/basic'

export class ListView extends FunctionGadget {
  // Keep the output container for rendered items
  container: Network
  
  constructor(id: string = 'list-view') {
    super(id, ['items', 'spacing', 'orientation', 'itemHeight'])
    this.container = new Network(`${id}-container`)
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    console.log('ListView.fn called with args:', args)
    const items = args.items
    const spacing = args.spacing
    const orientation = args.orientation 
    const itemHeight = args.itemHeight
    
    if (!items) {
      console.log('ListView.fn - no items provided')
      return obj(this.container)
    }
    
    // Extract values from ordinal cells if needed
    let actualItems = items
    if (isDict(items) && items.value.has('value')) {
      actualItems = items.value.get('value')!
    }
    
    let actualSpacing = spacing
    if (isDict(spacing) && spacing.value.has('value')) {
      actualSpacing = spacing.value.get('value')!
    }
    
    let actualOrientation = orientation
    if (isDict(orientation) && orientation.value.has('value')) {
      actualOrientation = orientation.value.get('value')!
    }
    
    let actualItemHeight = itemHeight
    if (isDict(itemHeight) && itemHeight.value.has('value')) {
      actualItemHeight = itemHeight.value.get('value')!
    }
    
    // Default values
    const spacingValue = isNumber(actualSpacing) ? actualSpacing.value : 10
    const orientationValue = isString(actualOrientation) ? actualOrientation.value : 'vertical'
    const itemHeightValue = isNumber(actualItemHeight) ? actualItemHeight.value : 40
    
    // Clear the container
    this.container = new Network(`${this.id}-container`)
    
    // Handle different item types
    console.log('ListView.fn - actualItems:', actualItems)
    console.log('ListView.fn - isSet(actualItems):', isSet(actualItems))
    if (!actualItems || !isSet(actualItems)) {
      console.log('ListView.fn - returning empty container because items is not a set')
      // Return empty container
      return obj(this.container)
    }
    
    // Render each item
    let position = 0
    let index = 0
    
    for (const item of actualItems.value) {
      // Create visual for this item
      const visual = this.createItemVisual(item, index, position, orientationValue)
      
      if (!visual) {
        console.warn('ListView.fn - createItemVisual returned null for item:', item)
        continue
      }
      
      console.log('ListView.fn - created visual:', visual.id, visual.constructor.name)
      
      // Add to container
      this.container.add(visual)
      
      // Update position for next item
      position += itemHeightValue + spacingValue
      index++
    }
    
    // Return the container as a value
    return obj(this.container)
  }
  
  /**
   * Create a visual gadget for an item
   * Can be overridden for custom rendering
   */
  protected createItemVisual(item: LatticeValue, index: number, position: number, orientation: string): VisualGadget {
    console.log('createItemVisual called:', { item, index, position, orientation })
    
    // Default: create a GroupGadget (which is a VisualGadget)
    const group = new GroupGadget(`item-${index}`)
    console.log('Created GroupGadget:', group.id, group)
    
    // Set the group's position based on orientation
    if (orientation === 'vertical') {
      group.setPosition(0, position)
    } else {
      group.setPosition(position, 0)
    }
    group.setSize(200, 35)
    
    // Background rect (relative to group)
    const bg = new RectGadget(`item-${index}-bg`)
    bg.setPosition(0, 0)  // Relative to group
    bg.setSize(200, 35)
    bg.setBackgroundColor('#f3f4f6')
    bg.setBorderRadius(4)
    bg.visible.userInput(true)
    
    // Text label (relative to group)
    const label = new TextGadget(`item-${index}-text`)
    label.setPosition(10, 5)  // Relative to group
    label.setSize(180, 25)
    
    // Extract text from item
    let text = 'Item'
    if (isString(item)) {
      text = item.value
    } else if (isNumber(item)) {
      text = item.value.toString()
    } else if (item && 'value' in item) {
      text = String(item.value)
    }
    
    label.setText(text)
    label.setFontSize(14)
    label.setColor('#1f2937')
    
    group.add(bg)
    group.add(label)
    
    // Return the group (GroupGadget is a VisualGadget)
    return group
  }
}

/**
 * TypedListView - A typed version with better item templates
 */
export class TypedListView<T> extends ListView {
  private itemTemplate?: (item: T, index: number) => VisualGadget
  
  setItemTemplate(template: (item: T, index: number) => VisualGadget): this {
    this.itemTemplate = template
    return this
  }
  
  protected createItemVisual(item: LatticeValue, index: number, position: number, orientation: string): VisualGadget {
    if (this.itemTemplate && item) {
      // Extract the actual value and use template
      const value = (item as any).value as T
      if (value !== undefined) {
        const visual = this.itemTemplate(value, index)
        // Set position on the returned visual
        if (orientation === 'vertical') {
          visual.setPosition(0, position)
        } else {
          visual.setPosition(position, 0)
        }
        return visual
      }
    }
    
    // Fallback to default
    return super.createItemVisual(item, index, position, orientation)
  }
}

/**
 * SelectableListView - ListView with selection support
 */
export class SelectableListView extends ListView {
  selectedIndex: OrdinalCell<number>
  selectedItem: OrdinalCell<LatticeValue | null>
  
  constructor(id: string = 'selectable-list') {
    super(id)
    this.selectedIndex = new OrdinalCell<number>(`${id}-selected-index`)
    this.selectedItem = new OrdinalCell<LatticeValue | null>(`${id}-selected-item`)
    
    // Initialize
    this.selectedIndex.setValue(-1)
    this.selectedItem.setValue(null)
  }
  
  protected createItemVisual(item: LatticeValue, index: number, position: number, orientation: string): VisualGadget {
    const visual = super.createItemVisual(item, index, position, orientation)
    
    // Add tap affordance for selection
    // (This would wire up to selection state)
    
    return visual
  }
  
  select(index: number, item: LatticeValue): void {
    this.selectedIndex.setValue(index)
    this.selectedItem.setValue(item)
  }
}