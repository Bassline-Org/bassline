import { BaseAreaPlugin } from 'rete-area-plugin'
import type { DeadSchemes, DeadNode } from '../types'

interface NodeGroup {
  prefix: string
  nodes: DeadNode[]
  bounds: { x: number, y: number, width: number, height: number }
  collapsed: boolean
}

export class PrefixGroupingPlugin extends BaseAreaPlugin<DeadSchemes, any> {
  private groups: Map<string, NodeGroup> = new Map()
  private groupElements: Map<string, HTMLElement> = new Map()
  
  constructor() {
    super('prefix-grouping')
  }
  
  setParent(parent: any) {
    super.setParent(parent)
    
    // Listen to node events
    parent.addPipe((context: any) => {
      if (context.type === 'nodeadded' || context.type === 'noderemoved') {
        this.updateGroups()
      }
      if (context.type === 'nodetranslated') {
        this.updateGroupBounds()
      }
      return context
    })
  }
  
  updateGroups() {
    const nodes = Array.from(this.parent.nodeViews.values()).map((v: any) => v.node as DeadNode)
    
    // Clear existing groups
    this.groups.clear()
    
    // Group nodes by prefix
    nodes.forEach(node => {
      const prefix = node.prefix
      if (!this.groups.has(prefix)) {
        this.groups.set(prefix, {
          prefix,
          nodes: [],
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          collapsed: false
        })
      }
      this.groups.get(prefix)!.nodes.push(node)
    })
    
    // Update bounds for each group
    this.updateGroupBounds()
    
    // Render group boundaries
    this.renderGroups()
  }
  
  updateGroupBounds() {
    this.groups.forEach(group => {
      if (group.nodes.length === 0) return
      
      let minX = Infinity, minY = Infinity
      let maxX = -Infinity, maxY = -Infinity
      
      group.nodes.forEach(node => {
        const view = this.parent.nodeViews.get(node.id)
        if (view) {
          const pos = view.position
          minX = Math.min(minX, pos.x)
          minY = Math.min(minY, pos.y)
          maxX = Math.max(maxX, pos.x + 200) // Approximate node width
          maxY = Math.max(maxY, pos.y + 100) // Approximate node height
        }
      })
      
      group.bounds = {
        x: minX - 20,
        y: minY - 40,
        width: maxX - minX + 40,
        height: maxY - minY + 60
      }
    })
  }
  
  renderGroups() {
    // Remove old group elements
    this.groupElements.forEach(el => el.remove())
    this.groupElements.clear()
    
    // Create new group elements
    this.groups.forEach(group => {
      if (group.nodes.length < 2) return // Don't show groups with single nodes
      
      const groupEl = document.createElement('div')
      groupEl.className = 'group-boundary'
      groupEl.style.cssText = `
        position: absolute;
        left: ${group.bounds.x}px;
        top: ${group.bounds.y}px;
        width: ${group.bounds.width}px;
        height: ${group.bounds.height}px;
        border: 2px dashed rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.02);
        pointer-events: none;
        z-index: -1;
      `
      
      // Add label
      const label = document.createElement('div')
      label.className = 'group-label'
      label.textContent = group.prefix
      label.style.cssText = `
        position: absolute;
        top: -20px;
        left: 10px;
        padding: 2px 8px;
        background: white;
        border: 1px solid rgba(0, 0, 0, 0.2);
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        color: #666;
      `
      groupEl.appendChild(label)
      
      // Add to canvas
      const canvas = this.parent.container
      canvas.appendChild(groupEl)
      this.groupElements.set(group.prefix, groupEl)
    })
  }
  
  getGroups(): NodeGroup[] {
    return Array.from(this.groups.values())
  }
  
  getGroupForNode(nodeId: string): NodeGroup | undefined {
    for (const group of this.groups.values()) {
      if (group.nodes.some(n => n.id === nodeId)) {
        return group
      }
    }
    return undefined
  }
  
  collapseGroup(prefix: string) {
    const group = this.groups.get(prefix)
    if (group) {
      group.collapsed = true
      this.updateGroupVisibility(group)
    }
  }
  
  expandGroup(prefix: string) {
    const group = this.groups.get(prefix)
    if (group) {
      group.collapsed = false
      this.updateGroupVisibility(group)
    }
  }
  
  private updateGroupVisibility(group: NodeGroup) {
    group.nodes.forEach(node => {
      const view = this.parent.nodeViews.get(node.id)
      if (view && view.element) {
        view.element.style.display = group.collapsed ? 'none' : 'block'
      }
    })
    
    // Update group boundary
    const groupEl = this.groupElements.get(group.prefix)
    if (groupEl) {
      if (group.collapsed) {
        groupEl.style.width = '120px'
        groupEl.style.height = '60px'
        groupEl.style.background = 'rgba(0, 0, 0, 0.1)'
      } else {
        groupEl.style.width = `${group.bounds.width}px`
        groupEl.style.height = `${group.bounds.height}px`
        groupEl.style.background = 'rgba(0, 0, 0, 0.02)'
      }
    }
  }
}