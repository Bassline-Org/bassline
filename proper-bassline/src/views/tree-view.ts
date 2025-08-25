/**
 * TreeView - Hierarchical tree visualization
 * 
 * Shows nested data structures with expand/collapse support.
 * Perfect for displaying network hierarchies, file systems, etc.
 */

import { FunctionGadget } from '../function'
import { GroupGadget } from '../visuals/group'
import { TextGadget } from '../visuals/text'
import { RectGadget } from '../visuals/rect'
import { PathGadget } from '../visuals/path'
import { LatticeValue, nil, obj, num, str, bool, dict, array, isDict, isArray } from '../types'
import { Network } from '../network'
import type { Gadget } from '../gadget'

interface TreeNode {
  id: string
  label: string
  value: LatticeValue
  children: TreeNode[]
  expanded: boolean
}

export class TreeView extends FunctionGadget {
  public expandedNodes = new Set<string>()
  
  constructor(id: string) {
    super(id, ['root', 'width', 'height', 'nodeHeight', 'indent', 'expandedNodes'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const root = args.root
    const width = args.width
    const height = args.height
    const nodeHeight = args.nodeHeight
    const indent = args.indent
    const expandedNodes = args.expandedNodes
    
    // Extract values
    const widthVal = width?.type === 'number' ? width.value : 600
    const heightVal = height?.type === 'number' ? height.value : 800
    const nodeHeightVal = nodeHeight?.type === 'number' ? nodeHeight.value : 30
    const indentVal = indent?.type === 'number' ? indent.value : 20
    
    // Update expanded nodes if provided
    if (expandedNodes?.type === 'set') {
      this.expandedNodes = new Set(
        Array.from(expandedNodes.value).map((v: any) => 
          v.type === 'string' ? v.value : ''
        ).filter(Boolean)
      )
    }
    
    if (!root) {
      return nil()
    }
    
    // Create container
    const container = new GroupGadget(`tree-${this.id}`)
    container.setSize(widthVal, heightVal)
    
    // Background
    const bg = new RectGadget(`tree-bg`)
    bg.setPosition(0, 0)
    bg.setSize(widthVal, heightVal)
    bg.setBackgroundColor('#ffffff')
    bg.setBorderRadius(6)
    container.add(bg)
    
    // Build tree structure
    const rootNode = this.buildTreeNode('root', 'Root', root)
    
    // Render tree
    let yOffset = 10
    this.renderTreeNode(container, rootNode, 10, yOffset, widthVal, nodeHeightVal, indentVal)
    
    return obj(container)
  }
  
  private buildTreeNode(id: string, label: string, value: LatticeValue): TreeNode {
    const children: TreeNode[] = []
    
    // Extract children based on value type
    if (value?.type === 'object' && value.value instanceof Network) {
      // Network: show its gadgets as children
      const network = value.value as Network
      let childIndex = 0
      for (const gadget of network.gadgets) {
        children.push(this.buildTreeNode(
          `${id}-${childIndex}`,
          gadget.id,
          obj(gadget)
        ))
        childIndex++
      }
    } else if (value?.type === 'dict') {
      // Dict: show key-value pairs
      let childIndex = 0
      value.value.forEach((childValue: any, key: any) => {
        children.push(this.buildTreeNode(
          `${id}-${childIndex}`,
          String(key),
          childValue
        ))
        childIndex++
      })
    } else if (value?.type === 'array') {
      // Array: show elements
      value.value.forEach((item: any, index: any) => {
        children.push(this.buildTreeNode(
          `${id}-${index}`,
          `[${index}]`,
          item
        ))
      })
    } else if (value?.type === 'set') {
      // Set: show elements
      let index = 0
      value.value.forEach((item: any) => {
        children.push(this.buildTreeNode(
          `${id}-${index}`,
          `Item ${index}`,
          item
        ))
        index++
      })
    }
    
    return {
      id,
      label,
      value,
      children,
      expanded: this.expandedNodes.has(id)
    }
  }
  
  private renderTreeNode(
    container: GroupGadget,
    node: TreeNode,
    x: number,
    y: number,
    width: number,
    nodeHeight: number,
    indent: number
  ): number {
    // Create node group
    const nodeGroup = new GroupGadget(`node-${node.id}`)
    nodeGroup.setPosition(x, y)
    
    // Node background (for hover effect)
    const nodeBg = new RectGadget(`node-bg-${node.id}`)
    nodeBg.setPosition(0, 0)
    nodeBg.setSize(width - x - 10, nodeHeight)
    nodeBg.setBackgroundColor('#f9fafb')
    nodeBg.setBorderRadius(4)
    nodeGroup.add(nodeBg)
    
    // Expand/collapse icon if has children
    if (node.children.length > 0) {
      const icon = new TextGadget(`icon-${node.id}`)
      icon.setPosition(0, 5)
      icon.setSize(20, 20)
      icon.setText(node.expanded ? '▼' : '▶')
      icon.setFontSize(12)
      icon.setColor('#6b7280')
      nodeGroup.add(icon)
    }
    
    // Node label
    const label = new TextGadget(`label-${node.id}`)
    label.setPosition(node.children.length > 0 ? 25 : 5, 5)
    label.setSize(200, 20)
    label.setText(node.label)
    label.setFontSize(14)
    label.setColor('#111827')
    label.setFontWeight(node.children.length > 0 ? 'semibold' : 'normal')
    nodeGroup.add(label)
    
    // Value preview
    const valuePreview = this.getValuePreview(node.value)
    if (valuePreview) {
      const value = new TextGadget(`value-${node.id}`)
      value.setPosition(230, 5)
      value.setSize(width - x - 250, 20)
      value.setText(valuePreview)
      value.setFontSize(12)
      value.setColor('#9ca3af')
      nodeGroup.add(value)
    }
    
    container.add(nodeGroup)
    
    // Update y position for next node
    y += nodeHeight + 5
    
    // Render children if expanded
    if (node.expanded && node.children.length > 0) {
      for (const child of node.children) {
        y = this.renderTreeNode(
          container,
          child,
          x + indent,
          y,
          width,
          nodeHeight,
          indent
        )
      }
    }
    
    return y
  }
  
  private getValuePreview(value: LatticeValue): string | null {
    if (!value) return null
    
    switch (value.type) {
      case 'string':
        const str = value.value as string
        return str.length > 30 ? `"${str.substring(0, 30)}..."` : `"${str}"`
      case 'number':
        return String(value.value)
      case 'bool':
        return String(value.value)
      case 'set':
        return `Set(${value.value.size})`
      case 'array':
        return `Array(${value.value.length})`
      case 'dict':
        return `Dict(${value.value.size})`
      case 'object':
        const obj = value.value
        if (obj?.constructor?.name) {
          return obj.constructor.name
        }
        return 'Object'
      default:
        return null
    }
  }
}

/**
 * InteractiveTreeView - TreeView with expand/collapse interaction
 */
export class InteractiveTreeView extends TreeView {
  constructor(id: string) {
    super(id)
    // Add interaction inputs
    this.inputNames.push('clickedNodeId')
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    // Handle node clicks to toggle expansion
    const clickedNodeId = args.clickedNodeId
    if (clickedNodeId?.type === 'string' && clickedNodeId.value) {
      if (this.expandedNodes.has(clickedNodeId.value)) {
        this.expandedNodes.delete(clickedNodeId.value)
      } else {
        this.expandedNodes.add(clickedNodeId.value)
      }
    }
    
    // Render the tree
    return super.fn(args)
  }
}