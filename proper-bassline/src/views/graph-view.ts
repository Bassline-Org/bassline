/**
 * GraphView - Visualize propagation network structure
 * 
 * Shows nodes (gadgets) and edges (connections) of a network.
 * Useful for debugging and understanding network flow.
 */

import { FunctionGadget } from '../function'
import { Network } from '../network'
import { GroupGadget } from '../visuals/group'
import { TextGadget } from '../visuals/text'
import { RectGadget } from '../visuals/rect'
import { LatticeValue, nil, obj, num, str, LatticeObject } from '../types'
import type { Gadget } from '../gadget'
import type { Cell } from '../cell'

interface NodePosition {
  x: number
  y: number
  gadget: Gadget
}

export class GraphView extends FunctionGadget {
  constructor(id: string) {
    super(id, ['network', 'width', 'height', 'nodeSpacing'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const network = args.network
    const width = args.width
    const height = args.height
    const nodeSpacing = args.nodeSpacing || num(100)
    
    // Extract values
    let networkObj: Network | null = null
    if (network && network.type === 'object' && network.value instanceof Network) {
      networkObj = network.value
    }
    
    const widthVal = width?.type === 'number' ? width.value : 800
    const heightVal = height?.type === 'number' ? height.value : 600
    const spacingVal = nodeSpacing?.type === 'number' ? nodeSpacing.value : 100
    
    if (!networkObj) {
      return nil()
    }
    
    // Create container for the graph visualization
    const container = new GroupGadget(`graph-${this.id}`)
    container.setSize(widthVal, heightVal)
    
    // Layout nodes in a simple grid
    const positions = new Map<Gadget, NodePosition>()
    const gadgets = Array.from(networkObj.gadgets)
    const cols = Math.ceil(Math.sqrt(gadgets.length))
    
    gadgets.forEach((gadget, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      positions.set(gadget, {
        x: col * spacingVal * 1.5 + 50,
        y: row * spacingVal + 50,
        gadget
      })
    })
    
    // Draw connections first (so they appear behind nodes)
    // TODO: Add when LineGadget is implemented
    /*
    positions.forEach((fromPos, fromGadget) => {
      // Check for downstream connections
      if ('downstream' in fromGadget && (fromGadget as any).downstream) {
        const downstream = (fromGadget as any).downstream as Set<any>
        downstream.forEach((target: any) => {
          const toPos = positions.get(target)
          if (toPos) {
            const line = new LineGadget(`edge-${fromGadget.id}-${target.id}`)
            line.setStart(fromPos.x + 40, fromPos.y + 20)
            line.setEnd(toPos.x, toPos.y + 20)
            line.setStrokeColor('#94a3b8')
            line.setStrokeWidth(2)
            container.add(line)
          }
        })
      }
    })
    */
    
    // Draw nodes
    positions.forEach(({ x, y, gadget }) => {
      const nodeGroup = new GroupGadget(`node-${gadget.id}`)
      nodeGroup.setPosition(x, y)
      
      // Node background
      const bg = new RectGadget(`node-bg-${gadget.id}`)
      bg.setPosition(0, 0)
      bg.setSize(80, 40)
      bg.setBackgroundColor(this.getNodeColor(gadget))
      bg.setBorderRadius(8)
      nodeGroup.add(bg)
      
      // Node label
      const label = new TextGadget(`node-label-${gadget.id}`)
      label.setPosition(5, 10)
      label.setSize(70, 20)
      label.setText(this.getNodeLabel(gadget))
      label.setFontSize(12)
      label.setColor('#ffffff')
      nodeGroup.add(label)
      
      container.add(nodeGroup)
    })
    
    return obj(container)
  }
  
  private getNodeColor(gadget: Gadget): string {
    // Color based on gadget type
    if ('latticeOp' in gadget) {
      return '#3b82f6' // Blue for Cells
    } else if ('fn' in gadget) {
      return '#10b981' // Green for Functions
    } else if ('children' in gadget) {
      return '#8b5cf6' // Purple for Groups/Networks
    }
    return '#6b7280' // Gray for others
  }
  
  private getNodeLabel(gadget: Gadget): string {
    // Truncate long IDs
    const id = gadget.id
    if (id.length > 10) {
      return id.substring(0, 8) + '...'
    }
    return id
  }
}

/**
 * InteractiveGraphView - GraphView with hover and selection
 */
export class InteractiveGraphView extends GraphView {
  selectedNode: Cell | null = null
  hoveredNode: Cell | null = null
  
  constructor(id: string) {
    super(id)
    // Add interaction inputs
    this.inputNames.push('selectedNodeId', 'hoveredNodeId')
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    // Get base graph
    const baseGraph = super.fn(args)
    
    // Add interaction highlights if needed
    const selectedId = args.selectedNodeId
    const hoveredId = args.hoveredNodeId
    
    if (selectedId && selectedId.type === 'string') {
      // Would add selection highlight here
    }
    
    if (hoveredId && hoveredId.type === 'string') {
      // Would add hover highlight here
    }
    
    return baseGraph
  }
}