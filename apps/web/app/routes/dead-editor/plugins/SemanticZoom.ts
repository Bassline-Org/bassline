import { BaseAreaPlugin } from 'rete-area-plugin'
import type { DeadSchemes, DeadNode } from '../types'

export class SemanticZoomPlugin extends BaseAreaPlugin<DeadSchemes, any> {
  private zoomLevel: number = 1
  private zoomCallbacks: ((level: number) => void)[] = []
  private groupVisibility: Map<string, boolean> = new Map()
  
  constructor() {
    super('semantic-zoom')
  }
  
  setParent(parent: any) {
    super.setParent(parent)
    
    // Listen to zoom events
    parent.addPipe((context: any) => {
      if (context.type === 'zoom') {
        this.onZoom(context.data.zoom)
      }
      return context
    })
  }
  
  onZoom(zoom: number) {
    this.zoomLevel = zoom
    this.updateZoomDisplay()
    this.updateNodeRendering()
    this.notifyCallbacks()
  }
  
  updateZoomDisplay() {
    const zoomElement = document.getElementById('zoom-level')
    if (zoomElement) {
      zoomElement.textContent = `${Math.round(this.zoomLevel * 100)}%`
    }
  }
  
  updateNodeRendering() {
    // Determine rendering mode based on zoom level
    const renderMode = this.getRenderMode()
    
    // Update all nodes
    const nodes = this.parent.nodeViews
    nodes.forEach((view: any, id: string) => {
      const node = view.node as DeadNode
      const element = view.element as HTMLElement
      
      // Apply rendering based on zoom level
      this.applyRenderMode(element, node, renderMode)
    })
  }
  
  getRenderMode(): 'dots' | 'compact' | 'normal' | 'detailed' {
    if (this.zoomLevel < 0.3) return 'dots'
    if (this.zoomLevel < 0.6) return 'compact'
    if (this.zoomLevel < 1.5) return 'normal'
    return 'detailed'
  }
  
  applyRenderMode(element: HTMLElement, node: DeadNode, mode: string) {
    // Remove all mode classes
    element.classList.remove('node-dots', 'node-compact', 'node-normal', 'node-detailed')
    
    // Add current mode class
    element.classList.add(`node-${mode}`)
    
    // Apply mode-specific styling
    switch(mode) {
      case 'dots':
        element.style.transform = 'scale(0.3)'
        element.style.opacity = '0.7'
        break
      case 'compact':
        element.style.transform = 'scale(0.6)'
        element.style.opacity = '0.85'
        break
      case 'normal':
        element.style.transform = 'scale(1)'
        element.style.opacity = '1'
        break
      case 'detailed':
        element.style.transform = 'scale(1.2)'
        element.style.opacity = '1'
        break
    }
  }
  
  onGroupToggle(prefix: string) {
    const isVisible = !this.groupVisibility.get(prefix)
    this.groupVisibility.set(prefix, isVisible)
    
    // Update visibility of nodes in this group
    const nodes = this.parent.nodeViews
    nodes.forEach((view: any) => {
      const node = view.node as DeadNode
      if (node.prefix === prefix) {
        const element = view.element as HTMLElement
        element.style.display = isVisible ? 'block' : 'none'
      }
    })
  }
  
  getZoomLevel() {
    return this.zoomLevel
  }
  
  onZoomChange(callback: (level: number) => void) {
    this.zoomCallbacks.push(callback)
  }
  
  private notifyCallbacks() {
    this.zoomCallbacks.forEach(cb => cb(this.zoomLevel))
  }
}