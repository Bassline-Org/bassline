/**
 * EditorGadget - A propagation network that represents a visual editor
 * 
 * The editor itself is a gadget that exposes its state as cells,
 * enabling bidirectional control between UI and network.
 */

import { Network } from './network'
import { OrdinalCell, UnionCell } from './cells/basic'
import { FunctionGadget } from './function'
import { Gadget } from './gadget'
import { str, num, dict, set as setVal, obj, nil, LatticeValue } from './types'

export interface ViewPosition {
  x: number
  y: number
  zoom: number
}

export interface NodePosition {
  id: string
  x: number
  y: number
}

export type EditMode = 'select' | 'connect' | 'create' | 'pan' | 'delete' | 'stamp' | 'wire' | 'lasso'

/**
 * EditorGadget - The editor as a network participant
 */
export class EditorGadget extends Network {
  // Editor state cells
  readonly selectedNodes: OrdinalCell  // Set of selected node IDs
  readonly viewPosition: OrdinalCell
  readonly editMode: OrdinalCell
  readonly nodePositions: OrdinalCell  // Dict of id -> {x, y}
  readonly clipboard: UnionCell
  readonly hoveredNode: OrdinalCell
  readonly nodes: OrdinalCell  // Array of {id, type, x, y}
  readonly edges: OrdinalCell  // Array of {id, source, target}
  
  // Map of node IDs to actual gadgets (don't conflict with parent's gadgets Set)
  private nodeGadgets: Map<string, Gadget> = new Map()
  
  // Editor configuration
  readonly gridSize: OrdinalCell
  readonly snapToGrid: OrdinalCell
  readonly showMinimap: OrdinalCell
  readonly theme: OrdinalCell
  
  constructor(id: string) {
    super(id)
    
    // Initialize state cells
    this.selectedNodes = new OrdinalCell(`${id}-selected`)
    this.viewPosition = new OrdinalCell(`${id}-view`)
    this.editMode = new OrdinalCell(`${id}-mode`)
    this.nodePositions = new OrdinalCell(`${id}-positions`)
    this.clipboard = new UnionCell(`${id}-clipboard`)
    this.hoveredNode = new OrdinalCell(`${id}-hovered`)
    this.nodes = new OrdinalCell(`${id}-nodes`)
    this.edges = new OrdinalCell(`${id}-edges`)
    
    // Initialize config cells
    this.gridSize = new OrdinalCell(`${id}-grid`)
    this.snapToGrid = new OrdinalCell(`${id}-snap`)
    this.showMinimap = new OrdinalCell(`${id}-minimap`)
    this.theme = new OrdinalCell(`${id}-theme`)
    
    // Set defaults
    this.viewPosition.userInput(obj({ x: 0, y: 0, zoom: 1 }))
    this.editMode.userInput(str('select'))
    this.nodePositions.userInput(dict(new Map<string, LatticeValue>()))
    this.gridSize.userInput(num(20))
    this.snapToGrid.userInput(obj(true))
    this.showMinimap.userInput(obj(false))
    this.theme.userInput(str('light'))
    this.hoveredNode.userInput(nil())
    this.nodes.userInput(obj([]))
    this.edges.userInput(obj([]))
    this.selectedNodes.userInput(setVal([]))
    
    // Add all cells to the network
    this.add(
      this.selectedNodes,
      this.viewPosition,
      this.editMode,
      this.nodePositions,
      this.clipboard,
      this.hoveredNode,
      this.nodes,
      this.edges,
      this.gridSize,
      this.snapToGrid,
      this.showMinimap,
      this.theme
    )
    
    // Mark them as boundaries so they're accessible
    this.addBoundary(this.selectedNodes)
    this.addBoundary(this.viewPosition)
    this.addBoundary(this.editMode)
    this.addBoundary(this.nodePositions)
    this.addBoundary(this.clipboard)
    this.addBoundary(this.hoveredNode)
    this.addBoundary(this.nodes)
    this.addBoundary(this.edges)
  }
  
  // Helper methods for common operations
  
  selectNode(nodeId: string) {
    const current = this.selectedNodes.getOutput()
    
    // Extract the set from ordinal dictionary
    let currentSet: Set<LatticeValue> = new Set()
    if (current?.type === 'dict') {
      const innerValue = current.value.get('value')
      if (innerValue?.type === 'set') {
        currentSet = new Set(innerValue.value)
      }
    } else if (current?.type === 'set') {
      currentSet = new Set(current.value)
    }
    
    // Add the new node to the set
    currentSet.add(str(nodeId))
    this.selectedNodes.userInput(setVal(Array.from(currentSet)))
  }
  
  deselectNode(nodeId: string) {
    const current = this.selectedNodes.getOutput()
    
    // Extract the set from ordinal dictionary
    let currentSet: Set<LatticeValue> = new Set()
    if (current?.type === 'dict') {
      const innerValue = current.value.get('value')
      if (innerValue?.type === 'set') {
        currentSet = new Set(innerValue.value)
      }
    } else if (current?.type === 'set') {
      currentSet = new Set(current.value)
    }
    
    // Find and remove the node
    currentSet.forEach(item => {
      if (item.type === 'string' && item.value === nodeId) {
        currentSet.delete(item)
      }
    })
    this.selectedNodes.userInput(setVal(Array.from(currentSet)))
  }
  
  clearSelection() {
    this.selectedNodes.userInput(setVal([]))
  }
  
  setNodePosition(nodeId: string, x: number, y: number) {
    const current = this.nodePositions.getOutput()
    if (current?.type === 'dict') {
      const newMap = new Map(current.value)
      newMap.set(nodeId, obj({ x, y }))
      this.nodePositions.userInput(dict(newMap as Map<string, LatticeValue>))
    } else {
      const newMap = new Map<string, LatticeValue>()
      newMap.set(nodeId, obj({ x, y }))
      this.nodePositions.userInput(dict(newMap))
    }
  }
  
  panTo(x: number, y: number, zoom?: number) {
    const current = this.viewPosition.getOutput()
    const currentObj = current?.type === 'object' ? current.value : { x: 0, y: 0, zoom: 1 }
    this.viewPosition.userInput(obj({
      x,
      y,
      zoom: zoom ?? currentObj.zoom
    }))
  }
  
  setEditMode(mode: EditMode) {
    this.editMode.userInput(str(mode))
  }
  
  copySelected() {
    const selected = this.selectedNodes.getOutput()
    if (selected?.type === 'set' && selected.value.size > 0) {
      // Get the actual node data for selected nodes
      const nodesCurrent = this.nodes.getOutput()
      const edgesCurrent = this.edges.getOutput()
      
      // Extract arrays
      let currentNodes: any[] = []
      if (nodesCurrent?.type === 'dict') {
        const innerValue = nodesCurrent.value.get('value')
        if (innerValue?.type === 'object' && Array.isArray(innerValue.value)) {
          currentNodes = innerValue.value
        }
      } else if (nodesCurrent?.type === 'object' && Array.isArray(nodesCurrent.value)) {
        currentNodes = nodesCurrent.value
      }
      
      let currentEdges: any[] = []
      if (edgesCurrent?.type === 'dict') {
        const innerValue = edgesCurrent.value.get('value')
        if (innerValue?.type === 'object' && Array.isArray(innerValue.value)) {
          currentEdges = innerValue.value
        }
      } else if (edgesCurrent?.type === 'object' && Array.isArray(edgesCurrent.value)) {
        currentEdges = edgesCurrent.value
      }
      
      // Get selected node IDs
      const selectedIds = new Set<string>()
      selected.value.forEach((item: LatticeValue) => {
        if (item.type === 'string') {
          selectedIds.add(item.value)
        }
      })
      
      // Filter nodes and edges that are selected
      const copiedNodes = currentNodes.filter((n: any) => selectedIds.has(n.id))
      const copiedEdges = currentEdges.filter((e: any) => 
        selectedIds.has(e.source) && selectedIds.has(e.target)
      )
      
      // Store in clipboard
      // @ts-ignore - UnionCell doesn't have userInput yet
      this.clipboard.userInput(obj({
        nodes: copiedNodes,
        edges: copiedEdges
      }))
    }
  }
  
  paste(offsetX: number = 20, offsetY: number = 20) {
    const clipboardContent = this.clipboard.getOutput()
    
    // Extract from ordinal if needed
    let clipData: any = null
    if (clipboardContent?.type === 'dict') {
      const innerValue = clipboardContent.value.get('value')
      if (innerValue?.type === 'object') {
        clipData = innerValue.value
      }
    } else if (clipboardContent?.type === 'object') {
      clipData = clipboardContent.value
    }
    
    if (!clipData || !clipData.nodes) return
    
    // Create ID mapping for nodes and edges
    const idMap = new Map<string, string>()
    const timestamp = Date.now()
    
    // Paste nodes with new IDs and offset positions
    clipData.nodes.forEach((node: any, i: number) => {
      const newId = `${node.id}-copy-${timestamp}-${i}`
      idMap.set(node.id, newId)
      
      this.addNode(
        newId,
        node.type,
        node.x + offsetX,
        node.y + offsetY
      )
    })
    
    // Paste edges with remapped IDs
    if (clipData.edges) {
      clipData.edges.forEach((edge: any, i: number) => {
        const newSource = idMap.get(edge.source)
        const newTarget = idMap.get(edge.target)
        if (newSource && newTarget) {
          const newEdgeId = `${edge.id}-copy-${timestamp}-${i}`
          this.addEdge(newEdgeId, newSource, newTarget)
        }
      })
    }
    
    // Clear selection and select the newly pasted nodes
    this.clearSelection()
    idMap.forEach((newId) => {
      this.selectNode(newId)
    })
  }
  
  cut() {
    this.copySelected()
    
    // Get selected node IDs
    const selected = this.selectedNodes.getOutput()
    if (selected?.type === 'set') {
      const idsToDelete: string[] = []
      selected.value.forEach((item: LatticeValue) => {
        if (item.type === 'string') {
          idsToDelete.push(item.value)
        }
      })
      
      // Delete each selected node
      idsToDelete.forEach(id => this.removeNode(id))
      
      // Clear selection
      this.clearSelection()
    }
  }
  
  addNode(id: string, type: string, x: number, y: number, gadget?: Gadget, createdAtScale?: number) {
    const current = this.nodes.getOutput()
    
    // Extract from ordinal dict if needed
    let currentNodes: any[] = []
    if (current?.type === 'dict') {
      const innerValue = current.value.get('value')
      if (innerValue?.type === 'object' && Array.isArray(innerValue.value)) {
        currentNodes = innerValue.value
      }
    } else if (current?.type === 'object' && Array.isArray(current.value)) {
      currentNodes = current.value
    }
    
    // Store the actual gadget if provided
    if (gadget) {
      this.nodeGadgets.set(id, gadget)
      // Add the gadget to our network
      this.add(gadget)
    }
    
    const nodeData: any = { id, type, x, y }
    if (createdAtScale !== undefined) {
      nodeData.createdAtScale = createdAtScale
    }
    
    const newNodes = [...currentNodes, nodeData]
    this.nodes.userInput(obj(newNodes))
    this.setNodePosition(id, x, y)
  }
  
  removeNode(id: string) {
    const current = this.nodes.getOutput()
    
    // Extract from ordinal dict if needed
    let currentNodes: any[] = []
    if (current?.type === 'dict') {
      const innerValue = current.value.get('value')
      if (innerValue?.type === 'object' && Array.isArray(innerValue.value)) {
        currentNodes = innerValue.value
      }
    } else if (current?.type === 'object' && Array.isArray(current.value)) {
      currentNodes = current.value
    }
    
    // Remove the actual gadget from the network
    const gadget = this.nodeGadgets.get(id)
    if (gadget) {
      // Remove from the network's gadget set
      this.gadgets.delete(gadget)
      this.nodeGadgets.delete(id)
    }
    
    const newNodes = currentNodes.filter((n: any) => n.id !== id)
    this.nodes.userInput(obj(newNodes))
    
    // Also remove edges connected to this node
    const edgesCurrent = this.edges.getOutput()
    
    let currentEdges: any[] = []
    if (edgesCurrent?.type === 'dict') {
      const innerValue = edgesCurrent.value.get('value')
      if (innerValue?.type === 'object' && Array.isArray(innerValue.value)) {
        currentEdges = innerValue.value
      }
    } else if (edgesCurrent?.type === 'object' && Array.isArray(edgesCurrent.value)) {
      currentEdges = edgesCurrent.value
    }
    
    const newEdges = currentEdges.filter((e: any) => e.source !== id && e.target !== id)
    this.edges.userInput(obj(newEdges))
  }
  
  addEdge(id: string, source: string, target: string, sourcePort?: string, targetPort?: string) {
    const current = this.edges.getOutput()
    
    // Extract from ordinal dict if needed
    let currentEdges: any[] = []
    if (current?.type === 'dict') {
      const innerValue = current.value.get('value')
      if (innerValue?.type === 'object' && Array.isArray(innerValue.value)) {
        currentEdges = innerValue.value
      }
    } else if (current?.type === 'object' && Array.isArray(current.value)) {
      currentEdges = current.value
    }
    
    // Actually wire the gadgets together if they exist
    const sourceGadget = this.nodeGadgets.get(source)
    const targetGadget = this.nodeGadgets.get(target)
    
    if (sourceGadget && targetGadget) {
      // Check if target is a function that needs port specification
      const targetFunc = targetGadget as any
      if (targetFunc.inputNames && targetPort) {
        // It's a function - connect to specific input
        sourceGadget.addDownstream(targetGadget)
        if (targetFunc.connectInput) {
          targetFunc.connectInput(targetPort, sourceGadget)
        }
      } else {
        // Regular cell-to-cell connection
        const targetCell = targetGadget as any
        
        if (targetCell.connectFrom) {
          // Use the proper connection method
          // This handles WeakRefs, downstream tracking, and initial value pull
          targetCell.connectFrom(sourceGadget)
        } else {
          // Fallback: just register downstream
          sourceGadget.addDownstream(targetGadget)
        }
      }
    }
    
    const newEdges = [...currentEdges, { id, source, target, sourcePort, targetPort }]
    this.edges.userInput(obj(newEdges))
    
    // Trigger propagation to ensure values flow through new connection
    if (sourceGadget) {
      sourceGadget.emit()
    }
  }
  
  updateNodePosition(id: string, x: number, y: number) {
    const current = this.nodes.getOutput()
    
    // Extract from ordinal dict if needed
    let currentNodes: any[] = []
    if (current?.type === 'dict') {
      const innerValue = current.value.get('value')
      if (innerValue?.type === 'object' && Array.isArray(innerValue.value)) {
        currentNodes = innerValue.value
      }
    } else if (current?.type === 'object' && Array.isArray(current.value)) {
      currentNodes = current.value
    }
    
    const newNodes = currentNodes.map((n: any) => 
      n.id === id ? { ...n, x, y } : n
    )
    this.nodes.userInput(obj(newNodes))
    this.setNodePosition(id, x, y)
  }
  
  getGadget(id: string): Gadget | undefined {
    return this.nodeGadgets.get(id)
  }
  
  getAllGadgets(): Map<string, Gadget> {
    return new Map(this.nodeGadgets)
  }
  
  getGadgetPorts(id: string): { inputs: string[], outputs: string[] } {
    const gadget = this.nodeGadgets.get(id)
    if (!gadget) return { inputs: [], outputs: [] }
    
    const g = gadget as any
    
    // Functions have named inputs
    if (g.inputNames) {
      return {
        inputs: g.inputNames,
        outputs: ['output']
      }
    }
    
    // Networks have boundary cells as ports
    if (g.getBoundaries) {
      const boundaries = g.getBoundaries()
      const boundaryIds = boundaries.map((b: any) => b.id)
      return {
        inputs: boundaryIds,
        outputs: boundaryIds  // bidirectional
      }
    }
    
    // Regular cells have single port
    return {
      inputs: ['input'],
      outputs: ['output']
    }
  }
}

/**
 * CreateNodeFunction - Creates a new node in the editor
 */
export class CreateNodeFunction extends FunctionGadget {
  constructor(id: string) {
    super(id, ['nodeType', 'x', 'y', 'editor'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const nodeType = args.nodeType
    const x = args.x
    const y = args.y
    const editor = args.editor
    
    if (!nodeType || !x || !y || !editor) return nil()
    
    // Extract values
    const typeStr = nodeType.type === 'string' ? nodeType.value : 'ordinal'
    const xNum = x.type === 'number' ? x.value : 0
    const yNum = y.type === 'number' ? y.value : 0
    
    // In a real implementation, this would create the actual node
    // For now, return info about what would be created
    return obj({
      action: 'create',
      type: typeStr,
      position: { x: xNum, y: yNum }
    })
  }
}

/**
 * ConnectNodesFunction - Creates a connection between two nodes
 */
export class ConnectNodesFunction extends FunctionGadget {
  constructor(id: string) {
    super(id, ['source', 'target', 'editor'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const source = args.source
    const target = args.target
    const editor = args.editor
    
    if (!source || !target || !editor) return nil()
    
    const sourceId = source.type === 'string' ? source.value : null
    const targetId = target.type === 'string' ? target.value : null
    
    if (!sourceId || !targetId) return nil()
    
    // In a real implementation, this would create the connection
    return obj({
      action: 'connect',
      source: sourceId,
      target: targetId
    })
  }
}

/**
 * AutoLayoutFunction - Automatically arranges nodes
 */
export class AutoLayoutFunction extends FunctionGadget {
  constructor(id: string) {
    super(id, ['editor', 'algorithm'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const editor = args.editor
    const algorithm = args.algorithm
    
    if (!editor) return nil()
    
    const algo = algorithm?.type === 'string' ? algorithm.value : 'grid'
    
    // In a real implementation, this would calculate new positions
    // based on the chosen algorithm (grid, tree, force-directed, etc.)
    return obj({
      action: 'layout',
      algorithm: algo
    })
  }
}

/**
 * DeleteSelectedFunction - Deletes currently selected nodes
 */
export class DeleteSelectedFunction extends FunctionGadget {
  constructor(id: string) {
    super(id, ['editor'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const editor = args.editor
    
    if (!editor || editor.type !== 'object') return nil()
    
    // Get the EditorGadget instance
    const editorGadget = editor.value as EditorGadget
    const selected = editorGadget.selectedNodes.getOutput()
    
    if (!selected || selected.type !== 'set') return nil()
    
    // Return the nodes that would be deleted
    return obj({
      action: 'delete',
      nodes: Array.from(selected.value)
    })
  }
}