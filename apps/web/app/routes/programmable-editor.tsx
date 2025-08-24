/**
 * Programmable Editor - An editor that is itself a gadget in the network
 * 
 * This demonstrates bidirectional control between UI and propagation network.
 * The editor's state is exposed as cells that can be manipulated programmatically.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { 
  NetworkProvider, 
  useNetwork, 
  useGadget, 
  useCell
} from '../../../../proper-bassline/src/react-integration'
import { EditorGadget } from '../../../../proper-bassline/src/editor-gadget'
import { GadgetRegistryGadget } from '../../../../proper-bassline/src/gadget-registry'
import { Network } from '../../../../proper-bassline/src/network'
import { str, num, bool, set, array, dict, obj, nil } from '../../../../proper-bassline/src/types'

// shadcn UI components
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Badge } from '~/components/ui/badge'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { Label } from '~/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Switch } from '~/components/ui/switch'

function ProgrammableEditorContent() {
  const network = useNetwork()
  
  // Create the editor and registry gadgets
  const editor = useGadget(() => new EditorGadget('editor'), 'editor')
  const registry = useGadget(() => new GadgetRegistryGadget('registry'), 'registry')
  
  // Hook into editor state cells
  const [selectedNodes] = useCell(editor.selectedNodes)
  const [editMode] = useCell(editor.editMode)
  const [hoveredNode, setHoveredNode] = useCell(editor.hoveredNode)
  const [nodes] = useCell(editor.nodes)
  const [edges] = useCell(editor.edges)
  const [clipboard] = useCell(editor.clipboard)
  const [availableTypes] = useCell(registry.availableTypes)
  const [selectedGadgetType] = useCell(registry.selectedType)
  
  
  // Local state for UI interactions only
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const [connectionStart, setConnectionStart] = useState<string | null>(null)
  const [connectionStartPort, setConnectionStartPort] = useState<string | null>(null)
  const [connectionPreviewPos, setConnectionPreviewPos] = useState<{x: number, y: number} | null>(null)
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, nodeId: string} | null>(null)
  
  // Value edit dialog state
  const [valueEditDialog, setValueEditDialog] = useState<{
    nodeId: string,
    gadget: any,
    nodeType: string
  } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  
  // Bookmark/snapshot state
  const [bookmarks, setBookmarks] = useState<Array<{id: string, name: string, data: any}>>(() => {
    const stored = localStorage.getItem('bassline-bookmarks')
    return stored ? JSON.parse(stored) : []
  })
  
  // Pan and zoom state with viewport
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 800 })
  const [focusedNetwork, setFocusedNetwork] = useState<string | null>(null)
  
  // Calculate visible bounds for viewport culling
  const getVisibleBounds = useCallback(() => {
    return {
      minX: -viewTransform.x / viewTransform.scale,
      minY: -viewTransform.y / viewTransform.scale,
      maxX: (-viewTransform.x + canvasSize.width) / viewTransform.scale,
      maxY: (-viewTransform.y + canvasSize.height) / viewTransform.scale
    }
  }, [viewTransform, canvasSize])
  
  // Check if a node is visible in viewport
  const isNodeVisible = useCallback((node: any) => {
    const bounds = getVisibleBounds()
    const nodeSize = 96 // Approximate node width/height
    return !(
      node.x + nodeSize < bounds.minX ||
      node.x > bounds.maxX ||
      node.y + nodeSize < bounds.minY ||
      node.y > bounds.maxY
    )
  }, [getVisibleBounds])
  
  // Get the actual arrays from the cell values
  const nodeArray = Array.isArray(nodes) ? nodes : []
  const edgeArray = Array.isArray(edges) ? edges : []
  
  // Debug selected type
  console.log('Selected gadget type from useCell:', selectedGadgetType)
  
  // Initialize with demo content - use a ref to ensure it only runs once
  const demoInitialized = useRef(false)
  useEffect(() => {
    // Check if canvas is empty and we haven't initialized yet
    if (nodeArray.length === 0 && !demoInitialized.current) {
      demoInitialized.current = true
      // Create a demo network structure
      const demoNodes = [
        // Main network container
        { id: 'main-network', type: 'Network', x: 400, y: 300 },
        
        // Input cells
        { id: 'input1', type: 'OrdinalCell', x: 100, y: 200 },
        { id: 'input2', type: 'OrdinalCell', x: 100, y: 350 },
        
        // Processing functions
        { id: 'add-func', type: 'AddFunction', x: 250, y: 275 },
        { id: 'multiply-func', type: 'MultiplyFunction', x: 550, y: 200 },
        
        // Aggregation cells
        { id: 'max-cell', type: 'MaxCell', x: 700, y: 275 },
        { id: 'min-cell', type: 'MinCell', x: 700, y: 375 },
        
        // Another network for composition
        { id: 'sub-network', type: 'Network', x: 400, y: 500 },
        
        // Output cell
        { id: 'output', type: 'OrdinalCell', x: 850, y: 325 }
      ]
      
      // Add nodes
      demoNodes.forEach(node => {
        const gadget = registry.createGadget(node.type, node.id)
        if (gadget) {
          editor.addNode(node.id, node.type, node.x, node.y, gadget, 1)
          
          // Initialize some values
          if (node.id === 'input1') {
            const cell = gadget as any
            if (cell.userInput) {
              cell.userInput(num(5))
            }
          }
          if (node.id === 'input2') {
            const cell = gadget as any
            if (cell.userInput) {
              cell.userInput(num(3))
            }
          }
          
          // Add some internal nodes to networks
          if (node.type === 'Network') {
            const net = gadget as any
            if (net.add) {
              for (let i = 0; i < 3; i++) {
                const internalCell = registry.createGadget('OrdinalCell', `${node.id}-cell-${i}`)
                if (internalCell) {
                  net.add(internalCell)
                  if (i === 0 || i === 2) {
                    net.addBoundary(internalCell)
                  }
                }
              }
            }
          }
        }
      })
      
      // Create connections - need to specify ports for functions
      const demoEdges = [
        { id: 'edge1', source: 'input1', target: 'add-func', targetPort: 'a' },
        { id: 'edge2', source: 'input2', target: 'add-func', targetPort: 'b' },
        { id: 'edge3', source: 'add-func', target: 'multiply-func', targetPort: 'a' },
        { id: 'edge3b', source: 'input2', target: 'multiply-func', targetPort: 'b' },
        { id: 'edge4', source: 'multiply-func', target: 'max-cell' },
        { id: 'edge5', source: 'multiply-func', target: 'min-cell' },
        { id: 'edge6', source: 'max-cell', target: 'output' },
        { id: 'edge7', source: 'input1', target: 'sub-network' },
        { id: 'edge8', source: 'sub-network', target: 'min-cell' }
      ]
      
      demoEdges.forEach(edge => {
        editor.addEdge(edge.id, edge.source, edge.target, undefined, edge.targetPort)
      })
      
      // Trigger propagation
      network.propagate()
    }
  }, []) // Only run once on mount
  
  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top
    // Transform canvas coordinates to world coordinates
    const x = (canvasX - viewTransform.x) / viewTransform.scale
    const y = (canvasY - viewTransform.y) / viewTransform.scale
    
    const mode = typeof editMode === 'string' ? editMode : 'select'
    
    if (mode === 'create' || mode === 'stamp') {
      // Create a new node with the selected gadget type
      const nodeId = `node-${Date.now()}`
      
      // Get the selected type from registry - useCell already extracts the value
      const gadgetType = typeof selectedGadgetType === 'string' ? selectedGadgetType : 'OrdinalCell'
      
      // Create the actual gadget using the registry
      const gadget = registry.createGadget(gadgetType, nodeId)
      if (gadget) {
        // Scale the node size based on current zoom so it appears normal size visually
        // At 1x zoom: node is 96x64 pixels
        // At 10x zoom: node should be 9.6x6.4 world units to appear the same size
        const visualWidth = 96
        const visualHeight = 64
        const worldWidth = visualWidth / viewTransform.scale
        const worldHeight = visualHeight / viewTransform.scale
        
        // Store the scale at which this node was created for proper rendering
        const nodeWithScale = {
          id: nodeId,
          type: gadgetType,
          x: x,
          y: y,
          createdAtScale: viewTransform.scale,
          width: worldWidth,
          height: worldHeight
        }
        
        editor.addNode(nodeId, gadgetType, x, y, gadget, viewTransform.scale)
        
        // If it's a network, add some initial cells to it
        if (gadgetType === 'Network' || gadgetType === 'NestFunction') {
          const net = gadget as any
          if (net.add) {
            // Add two example cells with a connection
            const cell1 = registry.createGadget('OrdinalCell', `${nodeId}-input`)
            const cell2 = registry.createGadget('OrdinalCell', `${nodeId}-output`)
            if (cell1 && cell2) {
              net.add(cell1, cell2)
              net.addBoundary(cell1)
              net.addBoundary(cell2)
            }
          }
        }
      } else {
        // Fallback to just visual node if gadget creation fails
        editor.addNode(nodeId, gadgetType, x, y)
      }
      
      // In create mode, switch back to select. In stamp mode, stay in stamp
      if (mode === 'create') {
        editor.setEditMode('select')
      }
      network.propagate()
    } else if (mode === 'wire') {
      // Wire mode - clicking empty space cancels current wire
      setConnectionStart(null)
      setConnectionStartPort(null)
      setConnectionPreviewPos(null)
    } else if (mode === 'select') {
      // Clear selection when clicking empty space
      editor.clearSelection()
      setConnectionStart(null)
      network.propagate()
    }
  }, [editMode, editor, network, registry, selectedGadgetType, viewTransform])
  
  
  // Handle node mouse down for simplified LODs
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, node: any) => {
    e.stopPropagation()
    const mode = typeof editMode === 'string' ? editMode : 'select'
    
    if (mode === 'select') {
      if (e.shiftKey) {
        editor.selectNode(node.id)
      } else {
        editor.clearSelection()
        editor.selectNode(node.id)
      }
      network.propagate()
      setDraggedNode(node.id)
    } else if (mode === 'delete') {
      editor.removeNode(node.id)
      network.propagate()
    } else if (mode === 'wire') {
      if (!connectionStart) {
        // Start a new connection
        setConnectionStart(node.id)
        setConnectionStartPort(null)
      } else if (connectionStart !== node.id) {
        // Complete the connection
        const edgeId = `edge-${Date.now()}`
        editor.addEdge(edgeId, connectionStart, node.id)
        network.propagate()
        setConnectionStart(null)
        setConnectionStartPort(null)
        setConnectionPreviewPos(null)
      }
    }
  }, [editMode, editor, network, connectionStart])
  
  // Handle node drag (account for zoom)
  const handleNodeDrag = useCallback((nodeId: string, deltaX: number, deltaY: number) => {
    const node = nodeArray.find((n: any) => n.id === nodeId)
    if (node) {
      const newX = node.x + deltaX / viewTransform.scale
      const newY = node.y + deltaY / viewTransform.scale
      editor.updateNodePosition(nodeId, newX, newY)
    }
  }, [nodeArray, editor, viewTransform.scale])
  
  // Handle wheel zoom with logarithmic scaling for smoothness
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Use logarithmic scale for smooth zooming at all levels
    const logScale = Math.log(viewTransform.scale)
    const zoomSpeed = 0.002 // Adjust for sensitivity
    const newLogScale = logScale - e.deltaY * zoomSpeed
    const newScale = Math.exp(newLogScale)
    
    // No bounds - truly infinite zoom
    // Zoom around mouse position
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setViewTransform(prev => ({
      scale: newScale,
      x: x - (x - prev.x) * (newScale / prev.scale),
      y: y - (y - prev.y) * (newScale / prev.scale)
    }))
  }, [viewTransform.scale])
  
  // Add wheel event listener with passive: false
  useEffect(() => {
    const canvasEl = document.getElementById('main-canvas')
    if (!canvasEl) return
    
    const handleWheelNonPassive = (e: WheelEvent) => {
      e.preventDefault()
      
      // Use logarithmic scale for smooth zooming at all levels
      const currentScale = viewTransform.scale
      const logScale = Math.log(currentScale)
      const zoomSpeed = 0.002 // Adjust for sensitivity
      const newLogScale = logScale - e.deltaY * zoomSpeed
      const newScale = Math.exp(newLogScale)
      
      // No bounds - truly infinite zoom
      const rect = canvasEl.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      setViewTransform(prev => ({
        scale: newScale,
        x: x - (x - prev.x) * (newScale / prev.scale),
        y: y - (y - prev.y) * (newScale / prev.scale)
      }))
    }
    
    canvasEl.addEventListener('wheel', handleWheelNonPassive, { passive: false })
    return () => canvasEl.removeEventListener('wheel', handleWheelNonPassive)
  }, [viewTransform.scale])
  
  // Track canvas size
  useEffect(() => {
    const canvasEl = document.getElementById('main-canvas')
    if (!canvasEl) return
    
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setCanvasSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        })
      }
    })
    
    observer.observe(canvasEl)
    return () => observer.disconnect()
  }, [])
  
  // Programmatic control panel
  const runAutoLayout = useCallback(() => {
    // Simple grid layout
    const gridSize = 150
    const cols = 3
    
    nodeArray.forEach((node: any, i: number) => {
      const x = (i % cols) * gridSize + 100
      const y = Math.floor(i / cols) * gridSize + 100
      editor.updateNodePosition(node.id, x, y)
    })
  }, [nodeArray, editor])
  
  const createRandomNodes = useCallback(() => {
    const count = 5
    
    // Get selected gadget type - useCell already extracts the value
    const gadgetType = typeof selectedGadgetType === 'string' ? selectedGadgetType : 'OrdinalCell'
    console.log('Creating nodes with type:', gadgetType, 'from selectedGadgetType:', selectedGadgetType)
    
    for (let i = 0; i < count; i++) {
      const nodeId = `node-${Date.now()}-${i}`
      const x = Math.random() * 600 + 100
      const y = Math.random() * 400 + 100
      
      // Create the actual gadget using the registry
      const gadget = registry.createGadget(gadgetType, nodeId)
      if (gadget) {
        editor.addNode(nodeId, gadgetType, x, y, gadget, viewTransform.scale)
        
        // If it's a network, add some initial cells to it
        if (gadgetType === 'Network' || gadgetType === 'NestFunction') {
          const net = gadget as any
          if (net.add) {
            // Add two example cells with a connection
            const cell1 = registry.createGadget('OrdinalCell', `${nodeId}-input`)
            const cell2 = registry.createGadget('OrdinalCell', `${nodeId}-output`)
            if (cell1 && cell2) {
              net.add(cell1, cell2)
              net.addBoundary(cell1)
              net.addBoundary(cell2)
            }
          }
        }
      } else {
        // Fallback to just visual node if gadget creation fails
        editor.addNode(nodeId, gadgetType, x, y)
      }
    }
    
    // Force a propagation cycle to ensure updates flow
    network.propagate()
  }, [editor, network, registry, selectedGadgetType])
  
  // Check if a node is selected
  const isNodeSelected = (nodeId: string) => {
    // selectedNodes comes from useCell which extracts the value
    // It should be a Set with LatticeValue items
    if (selectedNodes && typeof selectedNodes === 'object' && selectedNodes instanceof Set) {
      return Array.from(selectedNodes).some((item: any) => 
        item?.type === 'string' && item.value === nodeId
      )
    }
    return false
  }
  
  // Get current edit mode string
  const currentMode = typeof editMode === 'string' ? editMode : 'select'
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey
      
      if (ctrlOrCmd) {
        switch (e.key.toLowerCase()) {
          case 'c':
            e.preventDefault()
            editor.copySelected()
            break
          case 'v':
            e.preventDefault()
            editor.paste()
            network.propagate()
            break
          case 'x':
            e.preventDefault()
            editor.cut()
            network.propagate()
            break
          case 'a':
            e.preventDefault()
            // Select all nodes
            const nodesCurrent = editor.nodes.getOutput()
            let currentNodes: any[] = []
            if (nodesCurrent?.type === 'dict') {
              const innerValue = nodesCurrent.value.get('value')
              if (innerValue?.type === 'object' && Array.isArray(innerValue.value)) {
                currentNodes = innerValue.value
              }
            } else if (nodesCurrent?.type === 'object' && Array.isArray(nodesCurrent.value)) {
              currentNodes = nodesCurrent.value
            }
            editor.clearSelection()
            currentNodes.forEach((node: any) => editor.selectNode(node.id))
            network.propagate()
            break
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete selected nodes
        const selected = editor.selectedNodes.getOutput()
        if (selected?.type === 'set' && selected.value.size > 0) {
          e.preventDefault()
          const idsToDelete: string[] = []
          selected.value.forEach((item: any) => {
            if (item.type === 'string') {
              idsToDelete.push(item.value)
            }
          })
          idsToDelete.forEach(id => editor.removeNode(id))
          editor.clearSelection()
          network.propagate()
        }
      } else if (e.key === 'Escape') {
        // If we're focused on a network, zoom out
        if (focusedNetwork) {
          setFocusedNetwork(null)
          setViewTransform(prev => ({
            ...prev,
            scale: 1
          }))
        } else {
          // Clear selection and return to select mode
          editor.clearSelection()
          editor.setEditMode('select')
          setConnectionStart(null)
          network.propagate()
        }
      } else if (!ctrlOrCmd) {
        // Mode switching with single keys
        switch (e.key.toLowerCase()) {
          case 's':
            if (currentMode !== 'stamp') {
              e.preventDefault()
              editor.setEditMode('stamp')
              network.propagate()
            }
            break
          case 'w':
            if (currentMode !== 'wire') {
              e.preventDefault()
              editor.setEditMode('wire')
              setConnectionStart(null)
              network.propagate()
            }
            break
          case 'd':
            if (currentMode !== 'delete') {
              e.preventDefault()
              editor.setEditMode('delete')
              network.propagate()
            }
            break
          case 'l':
            if (currentMode !== 'lasso') {
              e.preventDefault()
              editor.setEditMode('lasso')
              network.propagate()
            }
            break
          case 'v':
            if (currentMode !== 'select') {
              e.preventDefault()
              editor.setEditMode('select')
              network.propagate()
            }
            break
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editor, network, setConnectionStart, currentMode, focusedNetwork])
  
  // Bookmark functions
  const saveBookmark = () => {
    const name = prompt('Name this bookmark:', `Snapshot ${bookmarks.length + 1}`)
    if (!name) return
    
    const bookmark = {
      id: `bookmark-${Date.now()}`,
      name,
      data: {
        nodes: nodeArray,
        edges: edgeArray,
        viewPosition: editor.viewPosition.getOutput(),
        // Could add more state here
      }
    }
    
    const newBookmarks = [...bookmarks, bookmark]
    setBookmarks(newBookmarks)
    localStorage.setItem('bassline-bookmarks', JSON.stringify(newBookmarks))
  }
  
  const loadBookmark = (bookmark: any) => {
    // Clear current state
    nodeArray.forEach((node: any) => editor.removeNode(node.id))
    
    // Load nodes
    bookmark.data.nodes.forEach((node: any) => {
      // Try to recreate the gadget
      const gadget = registry.createGadget(node.type, node.id)
      editor.addNode(node.id, node.type, node.x, node.y, gadget || undefined)
    })
    
    // Load edges
    bookmark.data.edges.forEach((edge: any) => {
      editor.addEdge(edge.id, edge.source, edge.target)
    })
    
    // Load view position if available
    if (bookmark.data.viewPosition) {
      const view = bookmark.data.viewPosition
      if (view.type === 'object') {
        editor.panTo(view.value.x, view.value.y, view.value.zoom)
      }
    }
    
    network.propagate()
  }
  
  const deleteBookmark = (id: string) => {
    const newBookmarks = bookmarks.filter(b => b.id !== id)
    setBookmarks(newBookmarks)
    localStorage.setItem('bassline-bookmarks', JSON.stringify(newBookmarks))
  }
  
  return (
    <TooltipProvider>
    <div className="h-screen flex flex-col bg-background">
      {/* Bookmarks Bar */}
      <div className="border-b bg-muted/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Bookmarks:</span>
          {bookmarks.map(bookmark => (
            <div key={bookmark.id} className="group relative">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => loadBookmark(bookmark)}
              >
                {bookmark.name}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="absolute -top-1 -right-1 h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => deleteBookmark(bookmark.id)}
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={saveBookmark}
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Save Bookmark
          </Button>
        </div>
      </div>
      
      {/* Toolbar */}
      <div className="border-b bg-card">
        <div className="p-2 flex gap-4 items-center">
          {/* Mode Selection */}
          <Tabs 
            value={currentMode} 
            onValueChange={(value) => {
              editor.setEditMode(value as any)
              network.propagate()
            }}
            className="h-9"
          >
            <TabsList className="h-9">
              <TabsTrigger value="select" className="text-xs" title="Select mode (V)">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-6 6v-3H5a2 2 0 01-2-2v-6a2 2 0 012-2h14a2 2 0 012 2v6a2 2 0 01-2 2h-4v3l-6-6z" />
                </svg>
                Select
              </TabsTrigger>
              <TabsTrigger value="stamp" className="text-xs" title="Stamp mode (S)">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Stamp
              </TabsTrigger>
              <TabsTrigger value="wire" className="text-xs" title="Wire mode (W)">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Wire
              </TabsTrigger>
              <TabsTrigger value="delete" className="text-xs text-destructive" title="Delete mode (D)">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {/* Edit Actions */}
          <div className="border-l pl-4 flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => editor.copySelected()}
                  size="sm"
                  variant="outline"
                >
                  Copy
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy selected (⌘C)</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => {
                    editor.paste()
                    network.propagate()
                  }}
                  size="sm"
                  variant="outline"
                >
                  Paste
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Paste (⌘V)</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => {
                    editor.cut()
                    network.propagate()
                  }}
                  size="sm"
                  variant="outline"
                >
                  Cut
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Cut selected (⌘X)</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          {/* Gadget Type Selector */}
          <div className="border-l pl-4 flex gap-2 items-center">
            <Label className="text-sm">Type:</Label>
            <Select
              value={typeof selectedGadgetType === 'string' ? selectedGadgetType : 'OrdinalCell'}
              onValueChange={(value) => {
                console.log('Selecting type:', value)
                registry.selectType(value)
                network.propagate()
              }}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  // useCell already extracts the value from OrdinalCell
                  // and unwraps the LatticeValue, so availableTypes should be a plain JS array
                  const types = Array.isArray(availableTypes) ? availableTypes : []
                  
                  // Group by category
                  const categories: Record<string, any[]> = {}
                  types.forEach((typeObj: any) => {
                    // Check if it's a LatticeValue object or already extracted
                    let t = typeObj
                    if (typeObj?.type === 'object') {
                      t = typeObj.value
                    }
                    
                    const category = t?.category || 'Other'
                    if (!categories[category]) {
                      categories[category] = []
                    }
                    categories[category].push(t)
                  })
                  console.log('Categories:', categories)
                  
                  return Object.entries(categories).map(([category, items]) => (
                    <div key={category}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {category}
                      </div>
                      {items.map((item: any) => (
                        <SelectItem key={item.className} value={item.className}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))
                })()}
              </SelectContent>
            </Select>
          </div>
          
          {/* View Actions */}
          <div className="border-l pl-4 flex gap-1">
            <Button
              onClick={() => {
                runAutoLayout()
                network.propagate()
              }}
              size="sm"
              variant="outline"
            >
              Auto Layout
            </Button>
            <Button
              onClick={createRandomNodes}
              size="sm"
              variant="outline"
            >
              Add 5 Nodes
            </Button>
            <Button
              onClick={() => {
                editor.clearSelection()
                network.propagate()
              }}
              size="sm"
              variant="ghost"
            >
              Clear Selection
            </Button>
          </div>
          
          {/* Save/Load Actions */}
          <div className="border-l pl-4 flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => {
                    const state = {
                      nodes: nodeArray,
                      edges: edgeArray,
                      timestamp: Date.now()
                    }
                    localStorage.setItem('bassline-network-state', JSON.stringify(state))
                    alert('Network saved to browser storage!')
                  }}
                  size="sm"
                  variant="outline"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
                  </svg>
                  Save
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save network to browser storage</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => {
                    const stored = localStorage.getItem('bassline-network-state')
                    if (!stored) {
                      alert('No saved network found!')
                      return
                    }
                    
                    const state = JSON.parse(stored)
                    
                    // Clear current state
                    nodeArray.forEach((node: any) => editor.removeNode(node.id))
                    
                    // Load nodes
                    state.nodes.forEach((node: any) => {
                      const gadget = registry.createGadget(node.type, node.id)
                      editor.addNode(node.id, node.type, node.x, node.y, gadget || undefined)
                    })
                    
                    // Load edges
                    state.edges.forEach((edge: any) => {
                      editor.addEdge(edge.id, edge.source, edge.target)
                    })
                    
                    network.propagate()
                    alert('Network loaded!')
                  }}
                  size="sm"
                  variant="outline"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Load
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Load network from browser storage</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          {/* Status */}
          <div className="ml-auto flex items-center gap-2 pr-2">
            <Badge variant="outline" className="font-mono">
              {currentMode}
            </Badge>
            {selectedNodes && typeof selectedNodes === 'object' && selectedNodes instanceof Set && selectedNodes.size > 0 && (
              <Badge variant="secondary">
                {selectedNodes.size} selected
              </Badge>
            )}
          </div>
        </div>
      </div>
      
      {/* Canvas */}
      <div className="flex-1 flex">
        {/* Main canvas area */}
        <div 
          id="main-canvas"
          className={`flex-1 relative overflow-hidden bg-gray-50 ${
            currentMode === 'delete' ? 'border-4 border-red-300' :
            currentMode === 'stamp' ? 'border-4 border-green-300' :
            currentMode === 'wire' ? 'border-4 border-blue-300' :
            currentMode === 'lasso' ? 'border-4 border-purple-300' :
            ''
          }`}
          onClick={handleCanvasClick}
          onMouseDown={(e) => {
            // Middle mouse or space+drag for pan
            if (e.button === 1 || (e.button === 0 && e.shiftKey && e.altKey)) {
              e.preventDefault()
              setIsPanning(true)
              setPanStart({ x: e.clientX, y: e.clientY })
            }
          }}
          onMouseMove={(e) => {
            if (isPanning) {
              const dx = e.clientX - panStart.x
              const dy = e.clientY - panStart.y
              setViewTransform(prev => ({
                ...prev,
                x: prev.x + dx,
                y: prev.y + dy
              }))
              setPanStart({ x: e.clientX, y: e.clientY })
            } else if (connectionStart) {
              // Track mouse position for connection preview
              const rect = e.currentTarget.getBoundingClientRect()
              const canvasX = e.clientX - rect.left
              const canvasY = e.clientY - rect.top
              // Transform to world coordinates
              const worldX = (canvasX - viewTransform.x) / viewTransform.scale
              const worldY = (canvasY - viewTransform.y) / viewTransform.scale
              setConnectionPreviewPos({ x: worldX, y: worldY })
            }
          }}
          onMouseUp={() => {
            setIsPanning(false)
          }}
          onMouseLeave={() => {
            setIsPanning(false)
          }}
          style={{ 
            cursor: isPanning ? 'move' :
                    currentMode === 'create' || currentMode === 'stamp' ? 'crosshair' : 
                    currentMode === 'wire' ? 'cell' :
                    currentMode === 'delete' ? 'not-allowed' :
                    currentMode === 'lasso' ? 'copy' :
                    'default' 
          }}
        >
          {/* Mode indicator */}
          {currentMode !== 'select' && (
            <div className="absolute top-4 right-4 z-10">
              <Badge 
                variant={currentMode === 'delete' ? 'destructive' : 'default'}
                className={`text-lg px-4 py-2 ${
                  currentMode === 'stamp' ? 'bg-green-500' :
                  currentMode === 'wire' ? 'bg-blue-500' :
                  currentMode === 'lasso' ? 'bg-purple-500' :
                  ''
                }`}
              >
                {currentMode.toUpperCase()} MODE
                <span className="ml-2 text-xs opacity-75">(ESC to exit)</span>
              </Badge>
            </div>
          )}
          
          {/* Zoom indicator */}
          <div className="absolute bottom-4 right-4 z-10">
            <Badge variant="outline" className="bg-white/90">
              {Math.round(viewTransform.scale * 100)}%
            </Badge>
          </div>
          
          {/* Grid background */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.5" fill="#ccc" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          
          {/* Transformed container for nodes and edges */}
          <div 
            className="absolute inset-0"
            style={{
              transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`,
              transformOrigin: '0 0'
            }}
          >
          {/* Edges - now inside transform so they scale properly */}
          <svg className="absolute inset-0 pointer-events-none" style={{ width: '10000px', height: '10000px' }}>
            {edgeArray.map((edge: any) => {
              const source = nodeArray.find((n: any) => n.id === edge.source)
              const target = nodeArray.find((n: any) => n.id === edge.target)
              if (!source || !target) return null
              
              // The nodes store their center position
              // Since nodes are rendered with offsets to center them visually,
              // we connect edges directly to the stored x,y positions
              return (
                <line
                  key={edge.id}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="#999"
                  strokeWidth="2"
                />
              )
            })}
            
            {/* Connection preview */}
            {connectionStart && connectionPreviewPos && (
              <line
                x1={nodeArray.find((n: any) => n.id === connectionStart)?.x || 0}
                y1={nodeArray.find((n: any) => n.id === connectionStart)?.y || 0}
                x2={connectionPreviewPos.x}
                y2={connectionPreviewPos.y}
                stroke="#4CAF50"
                strokeWidth="2"
                strokeDasharray="5,5"
                className="connection-preview"
              />
            )}
          </svg>
          
          {/* Nodes - with viewport culling and LOD */}
          {nodeArray.filter(isNodeVisible).map((node: any) => {
            // Determine node category for styling
            const getNodeCategory = (type: string) => {
              if (type.endsWith('Cell')) return 'cell'
              if (type.endsWith('Function')) return 'function'
              if (type === 'Network' || type === 'NestFunction') return 'network'
              return 'default'
            }
            
            const category = getNodeCategory(node.type)
            const scale = viewTransform.scale
            
            // Level of Detail based on zoom
            const getLOD = () => {
              if (scale < 0.1) return 'dot'
              if (scale < 0.3) return 'icon'
              if (scale < 0.6) return 'simple'
              if (scale < 2.0) return 'normal'
              return 'detailed'
            }
            
            const lod = getLOD()
            
            // Check if we should show network internals (when zoomed in close)
            const shouldShowInternals = 
              category === 'network' && 
              scale > 3  // Show internals when zoomed in past 3x
            
            // Get style based on category
            const getNodeStyle = () => {
              const baseStyle = 'absolute w-24 h-16 rounded-lg border-2 flex flex-col items-center justify-center text-xs font-medium cursor-move select-none shadow-sm'
              
              if (isNodeSelected(node.id)) {
                switch (category) {
                  case 'cell':
                    return `${baseStyle} bg-blue-100 border-blue-500 ring-2 ring-blue-300 shadow-md`
                  case 'function':
                    return `${baseStyle} bg-green-100 border-green-500 ring-2 ring-green-300 shadow-md`
                  case 'network':
                    return `${baseStyle} bg-purple-100 border-purple-500 ring-2 ring-purple-300 shadow-md`
                  default:
                    return `${baseStyle} bg-gray-100 border-gray-500 ring-2 ring-gray-300 shadow-md`
                }
              } else {
                switch (category) {
                  case 'cell':
                    return `${baseStyle} bg-blue-50 border-blue-300 hover:border-blue-400 hover:shadow-md`
                  case 'function':
                    return `${baseStyle} bg-green-50 border-green-300 hover:border-green-400 hover:shadow-md`
                  case 'network':
                    return `${baseStyle} bg-purple-50 border-purple-300 hover:border-purple-400 hover:shadow-md`
                  default:
                    return `${baseStyle} bg-white border-gray-300 hover:border-gray-400 hover:shadow-md`
                }
              }
            }
            
            // Get the live value from the gadget
            const getNodeValue = () => {
              const gadget = editor.getGadget(node.id)
              if (!gadget) return null
              
              const cell = gadget as any
              if (cell.getOutput) {
                const value = cell.getOutput()
                if (!value) return null
                
                // Check if it's an ordinal dict and extract the actual value
                if (value.type === 'dict' && value.value.has('ordinal') && value.value.has('value')) {
                  const actualValue = value.value.get('value')
                  if (!actualValue) return 'nil'
                  
                  // Format the actual value
                  switch (actualValue.type) {
                    case 'number':
                      return actualValue.value
                    case 'string':
                      return `"${actualValue.value}"`
                    case 'bool':
                      return actualValue.value ? 'true' : 'false'
                    case 'nil':
                      return 'nil'
                    case 'set':
                      return `Set(${actualValue.value.size})`
                    case 'array':
                      return `[${actualValue.value.length}]`
                    case 'object':
                      return 'Object'
                    default:
                      return actualValue.type
                  }
                }
                
                // Format the value for display (non-ordinal)
                switch (value.type) {
                  case 'number':
                    return value.value
                  case 'string':
                    return `"${value.value}"`
                  case 'bool':
                    return value.value ? 'true' : 'false'
                  case 'nil':
                    return 'nil'
                  case 'set':
                    return `Set(${value.value.size})`
                  case 'dict':
                    return `Dict(${value.value.size})`
                  case 'array':
                    return `[${value.value.length}]`
                  case 'object':
                    return 'Object'
                  default:
                    return value.type
                }
              }
              return null
            }
            
            const nodeValue = getNodeValue()
            
            // Get ports for this node
            const ports = editor.getGadgetPorts(node.id)
            
            // Get the node's visual size based on when it was created
            const nodeScale = node.createdAtScale || 1
            const sizeMultiplier = nodeScale / viewTransform.scale
            
            // Render based on LOD
            if (lod === 'dot') {
              // Ultra-zoomed out: just a dot
              const dotSize = Math.max(2, 8 * sizeMultiplier)
              return (
                <div
                  key={node.id}
                  className={`absolute rounded-full ${
                    category === 'network' ? 'bg-purple-500' :
                    category === 'function' ? 'bg-green-500' :
                    category === 'cell' ? 'bg-blue-500' :
                    'bg-gray-500'
                  }`}
                  style={{ 
                    left: node.x - dotSize/2, 
                    top: node.y - dotSize/2,
                    width: dotSize,
                    height: dotSize
                  }}
                />
              )
            }
            
            if (lod === 'icon') {
              // Zoomed out: small icon
              return (
                <div
                  key={node.id}
                  className={`absolute w-8 h-8 rounded-md border flex items-center justify-center text-[8px] font-bold ${
                    category === 'network' ? 'bg-purple-100 border-purple-400' :
                    category === 'function' ? 'bg-green-100 border-green-400' :
                    category === 'cell' ? 'bg-blue-100 border-blue-400' :
                    'bg-gray-100 border-gray-400'
                  }`}
                  style={{ 
                    left: node.x - 16, 
                    top: node.y - 16
                  }}
                  title={node.type}
                >
                  {node.type[0]}
                </div>
              )
            }
            
            if (lod === 'simple') {
              // Medium zoom: simplified node
              return (
                <div
                  key={node.id}
                  className={`absolute w-16 h-12 rounded-md border-2 flex items-center justify-center text-[10px] font-medium ${
                    isNodeSelected(node.id) ? 'ring-2' : ''
                  } ${
                    category === 'network' ? 'bg-purple-50 border-purple-300' :
                    category === 'function' ? 'bg-green-50 border-green-300' :
                    category === 'cell' ? 'bg-blue-50 border-blue-300' :
                    'bg-white border-gray-300'
                  }`}
                  style={{ 
                    left: node.x - 32, 
                    top: node.y - 24
                  }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                >
                  <span className="truncate px-1">
                    {node.type.replace(/Cell|Function/, '')}
                  </span>
                </div>
              )
            }
            
            // Special rendering for zoomed-in networks
            if (shouldShowInternals) {
              const networkGadget = editor.getGadget(node.id) as any
              const internalGadgets = networkGadget?.gadgets ? Array.from(networkGadget.gadgets) : []
              
              // Calculate opacity based on zoom level (fade in as we zoom)
              const internalOpacity = Math.min(1, (scale - 3) / 2)
              const containerOpacity = Math.max(0.3, 1 - (scale - 3) / 3)
              
              return (
                <div key={node.id}>
                  {/* Network container - becomes more transparent as we zoom in */}
                  <div
                    className={getNodeStyle()}
                    style={{ 
                      left: node.x - 48,
                      top: node.y - 32,
                      opacity: containerOpacity
                    }}
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setFocusedNetwork(node.id)
                    }}
                  >
                    <div className="text-[10px] text-gray-500">
                      {node.type}
                    </div>
                    <div className="font-semibold truncate px-2">
                      {node.id}
                    </div>
                    {nodeValue !== null && (
                      <div className="text-[10px] text-gray-600 truncate px-2">
                        {nodeValue}
                      </div>
                    )}
                  </div>
                  
                  {/* Render internal gadgets in a grid layout */}
                  {internalGadgets.length > 0 && internalOpacity > 0 && (
                    <div 
                      className="absolute"
                      style={{
                        left: node.x - 100,
                        top: node.y - 50,
                        opacity: internalOpacity
                      }}
                    >
                      {internalGadgets.map((internalGadget: any, idx: number) => {
                        // Create a grid layout for internal nodes
                        const cols = Math.ceil(Math.sqrt(internalGadgets.length))
                        const col = idx % cols
                        const row = Math.floor(idx / cols)
                        const spacing = 70
                        const internalX = col * spacing
                        const internalY = row * spacing
                        
                        // Get the internal gadget's type
                        const gadgetType = internalGadget.constructor?.name || 'Unknown'
                        const isCell = gadgetType.endsWith('Cell')
                        const isFunction = gadgetType.endsWith('Function')
                        
                        // Get the internal gadget's value if it has one
                        let internalValue = null
                        if (internalGadget.getOutput) {
                          const output = internalGadget.getOutput()
                          if (output && output.type !== 'nil') {
                            if (output.type === 'number') internalValue = output.value
                            else if (output.type === 'string') internalValue = `"${output.value}"`
                            else if (output.type === 'bool') internalValue = output.value.toString()
                            else internalValue = output.type
                          }
                        }
                        
                        return (
                          <div
                            key={`${node.id}-internal-${idx}`}
                            className={`absolute w-14 h-10 rounded border flex flex-col items-center justify-center text-[9px] ${
                              isCell ? 'bg-blue-50 border-blue-200' :
                              isFunction ? 'bg-green-50 border-green-200' :
                              'bg-gray-50 border-gray-200'
                            }`}
                            style={{
                              left: internalX,
                              top: internalY
                            }}
                            title={`${gadgetType} (${internalGadget.id})`}
                          >
                            <div className="font-medium truncate px-1">
                              {gadgetType.replace(/Cell|Function/, '').slice(0, 8)}
                            </div>
                            {internalValue && (
                              <div className="text-[8px] text-gray-500 truncate px-1">
                                {internalValue}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }
            
            // Normal and detailed rendering
            return (
              <div
                key={node.id}
                className={getNodeStyle()}
                style={{ 
                  left: node.x - 48, 
                  top: node.y - 32,
                  cursor: currentMode === 'delete' ? 'pointer' : 'move'
                }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id })
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                const mode = typeof editMode === 'string' ? editMode : 'select'
                
                if (mode === 'select') {
                  // Handle selection on mousedown instead of click
                  if (e.shiftKey) {
                    // Multi-select with shift
                    editor.selectNode(node.id)
                  } else {
                    // Single select
                    editor.clearSelection()
                    editor.selectNode(node.id)
                  }
                  network.propagate()
                  // Set up for dragging
                  setDraggedNode(node.id)
                } else if (mode === 'connect' || mode === 'wire') {
                  if (!connectionStart) {
                    setConnectionStart(node.id)
                  } else if (connectionStart !== node.id) {
                    // Create connection
                    const edgeId = `edge-${Date.now()}`
                    editor.addEdge(edgeId, connectionStart, node.id)
                    // In wire mode, start new connection from target
                    if (mode === 'wire') {
                      setConnectionStart(node.id)
                    } else {
                      setConnectionStart(null)
                    }
                    network.propagate()
                  }
                } else if (mode === 'delete') {
                  // Delete the node
                  editor.removeNode(node.id)
                  network.propagate()
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                
                // Check if it's a network node - if so, focus on it for zooming
                if (category === 'network') {
                  setFocusedNetwork(node.id)
                  // Zoom in to start entering the network
                  const rect = e.currentTarget.getBoundingClientRect()
                  const nodeCenter = {
                    x: node.x,
                    y: node.y
                  }
                  
                  // Animate zoom to network
                  const targetScale = 6
                  setViewTransform({
                    scale: targetScale,
                    x: canvasSize.width / 2 - nodeCenter.x * targetScale,
                    y: canvasSize.height / 2 - nodeCenter.y * targetScale
                  })
                  return
                }
                
                // Get the actual gadget for value editing
                const gadget = editor.getGadget(node.id)
                if (gadget) {
                  // If it's a cell, allow editing the value
                  const cellTypes = ['OrdinalCell', 'MaxCell', 'MinCell', 'SetCell']
                  if (cellTypes.includes(node.type)) {
                    // Get current value to pre-fill
                    const currentOutput = (gadget as any).getOutput?.()
                    let initialValue = ''
                    if (currentOutput) {
                      switch (currentOutput.type) {
                        case 'number':
                          initialValue = String(currentOutput.value)
                          break
                        case 'string':
                          initialValue = currentOutput.value
                          break
                        case 'bool':
                          initialValue = currentOutput.value ? 'true' : 'false'
                          break
                        case 'set':
                          initialValue = Array.from(currentOutput.value).map((v: any) => 
                            v.value !== undefined ? v.value : v
                          ).join(', ')
                          break
                      }
                    }
                    setEditValue(initialValue)
                    setValueEditDialog({ nodeId: node.id, gadget, nodeType: node.type })
                  }
                }
              }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Input ports */}
                {ports.inputs.length > 0 && (
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
                    {ports.inputs.map((port, i) => (
                      <div
                        key={port}
                        className="w-3 h-3 bg-white border-2 border-gray-400 rounded-full hover:border-blue-500 cursor-crosshair"
                        title={port}
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          if ((currentMode === 'connect' || currentMode === 'wire') && connectionStart) {
                            // Complete connection to this input port
                            const edgeId = `edge-${Date.now()}`
                            editor.addEdge(edgeId, connectionStart, node.id, connectionStartPort || undefined, port)
                            setConnectionStart(null)
                            setConnectionStartPort(null)
                            network.propagate()
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
                
                {/* Output ports */}
                {ports.outputs.length > 0 && (
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
                    {ports.outputs.map((port, i) => (
                      <div
                        key={port}
                        className="w-3 h-3 bg-white border-2 border-gray-400 rounded-full hover:border-green-500 cursor-crosshair"
                        title={port}
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          if ((currentMode === 'connect' || currentMode === 'wire') && !connectionStart) {
                            // Start connection from this output port
                            setConnectionStart(node.id)
                            setConnectionStartPort(port)
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
                
                <div className="flex flex-col items-center gap-0.5">
                  {/* Type row */}
                  <div className="flex items-center gap-1">
                    {/* Icon based on category */}
                    {category === 'cell' && (
                      <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <circle cx="10" cy="10" r="8" />
                      </svg>
                    )}
                    {category === 'function' && (
                      <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    )}
                    {category === 'network' && (
                      <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                    )}
                    
                    {/* Node label */}
                    <span className={`${
                      category === 'cell' ? 'text-blue-700' :
                      category === 'function' ? 'text-green-700' :
                      category === 'network' ? 'text-purple-700' :
                      'text-gray-700'
                    }`}>
                      {(() => {
                        const typeMap: Record<string, string> = {
                          'OrdinalCell': 'Ordinal',
                          'MaxCell': 'Max',
                          'MinCell': 'Min',
                          'SetCell': 'Set',
                          'OrCell': 'OR',
                          'AndCell': 'AND',
                          'UnionCell': 'Union',
                          'LatestCell': 'Latest',
                          'AddFunction': 'Add',
                          'MultiplyFunction': 'Multiply',
                          'SubtractFunction': 'Subtract',
                          'DivideFunction': 'Divide',
                          'EqualFunction': '=',
                          'GreaterThanFunction': '>',
                          'ExtractValue': 'Extract',
                          'ExtractOrdinal': 'Ord#',
                          'NestFunction': 'Nest',
                          'Network': 'Net'
                        }
                        return typeMap[node.type] || node.type
                      })()}
                    </span>
                  </div>
                  
                  {/* Value row */}
                  {nodeValue !== null && (
                    <div className="text-[10px] font-mono text-gray-600 max-w-[88px] truncate">
                      {nodeValue}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          </div>{/* Close transform container */}
        </div>
        
        {/* Side panel - Shows editor state */}
        <div className="w-80 border-l bg-background">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Status Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Editor State</CardTitle>
                  <CardDescription className="text-xs">Live network status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Selected</span>
                    <Badge variant={selectedNodes && selectedNodes instanceof Set && selectedNodes.size > 0 ? "default" : "outline"}>
                      {selectedNodes && typeof selectedNodes === 'object' && selectedNodes instanceof Set 
                        ? selectedNodes.size
                        : 0} nodes
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Hovered</span>
                    <span className="text-sm font-mono">
                      {hoveredNode?.type === 'string' ? hoveredNode.value : '—'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Nodes</span>
                    <Badge variant="secondary">{nodeArray.length}</Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Edges</span>
                    <Badge variant="secondary">{edgeArray.length}</Badge>
                  </div>
                </CardContent>
              </Card>
              
              {/* Clipboard Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Clipboard</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    {(() => {
                      let clipData: any = null
                      if (clipboard?.type === 'dict') {
                        const innerValue = clipboard.value.get('value')
                        if (innerValue?.type === 'object') {
                          clipData = innerValue.value
                        }
                      } else if (clipboard?.type === 'object') {
                        clipData = clipboard.value
                      }
                      
                      if (clipData?.nodes) {
                        const nodeCount = clipData.nodes.length
                        const edgeCount = clipData.edges?.length || 0
                        return (
                          <div className="flex gap-2">
                            <Badge>{nodeCount} nodes</Badge>
                            <Badge>{edgeCount} edges</Badge>
                          </div>
                        )
                      }
                      return <span className="text-muted-foreground">Empty</span>
                    })()}
                  </div>
                </CardContent>
              </Card>
              
              {/* Programmatic Control Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Programmatic Control</CardTitle>
                  <CardDescription className="text-xs">
                    Control the editor via the network
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
{`// Example:
editor.selectNode('node-1')
editor.setEditMode('create')
editor.copySelected()
editor.paste(100, 200)`}
                  </pre>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </div>
      
      {/* Handle global mouse events for dragging */}
      {draggedNode && (
        <div
          className="fixed inset-0 z-50"
          onMouseMove={(e) => {
            if (draggedNode) {
              handleNodeDrag(draggedNode, e.movementX, e.movementY)
            }
          }}
          onMouseUp={() => setDraggedNode(null)}
          style={{ cursor: 'move' }}
        />
      )}
      
      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[150px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <div className="px-3 py-1 text-xs font-semibold text-gray-500 border-b">
            Node: {contextMenu.nodeId}
          </div>
          
          {(() => {
            const gadget = editor.getGadget(contextMenu.nodeId)
            const ports = editor.getGadgetPorts(contextMenu.nodeId)
            const node = nodeArray.find((n: any) => n.id === contextMenu.nodeId)
            
            return (
              <>
                <button
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100"
                  onClick={() => {
                    // Edit value for cells
                    if (gadget && node) {
                      const cellTypes = ['OrdinalCell', 'MaxCell', 'MinCell', 'SetCell']
                      if (cellTypes.includes(node.type)) {
                        // Get current value to pre-fill
                        const currentOutput = (gadget as any).getOutput?.()
                        let initialValue = ''
                        if (currentOutput) {
                          switch (currentOutput.type) {
                            case 'number':
                              initialValue = String(currentOutput.value)
                              break
                            case 'string':
                              initialValue = currentOutput.value
                              break
                            case 'bool':
                              initialValue = currentOutput.value ? 'true' : 'false'
                              break
                            case 'set':
                              initialValue = Array.from(currentOutput.value).map((v: any) => 
                                v.value !== undefined ? v.value : v
                              ).join(', ')
                              break
                          }
                        }
                        setEditValue(initialValue)
                        setValueEditDialog({ nodeId: contextMenu.nodeId, gadget, nodeType: node.type })
                      }
                    }
                    setContextMenu(null)
                  }}
                >
                  Edit Value
                </button>
                
                <button
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100"
                  onClick={() => {
                    // Show ports info
                    alert(`Input ports: ${ports.inputs.join(', ')}\nOutput ports: ${ports.outputs.join(', ')}`)
                    setContextMenu(null)
                  }}
                >
                  Show Ports
                </button>
                
                <button
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100"
                  onClick={() => {
                    // Show current value
                    const g = gadget as any
                    if (g && g.getOutput) {
                      const output = g.getOutput()
                      alert(`Current value: ${JSON.stringify(output, null, 2)}`)
                    }
                    setContextMenu(null)
                  }}
                >
                  Inspect Value
                </button>
                
                {/* For networks, show option to enter */}
                {node && (node.type === 'Network' || node.type === 'NestFunction') && (
                  <button
                    className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 font-semibold"
                    onClick={() => {
                      alert(`Would enter network: ${contextMenu.nodeId}`)
                      // TODO: Implement network navigation
                      setContextMenu(null)
                    }}
                  >
                    Enter Network →
                  </button>
                )}
                
                <div className="border-t my-1"></div>
                
                <button
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100"
                  onClick={() => {
                    editor.selectNode(contextMenu.nodeId)
                    editor.copySelected()
                    network.propagate()
                    setContextMenu(null)
                  }}
                >
                  Copy
                </button>
                
                <button
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 text-red-600"
                  onClick={() => {
                    editor.removeNode(contextMenu.nodeId)
                    network.propagate()
                    setContextMenu(null)
                  }}
                >
                  Delete
                </button>
              </>
            )
          })()}
        </div>
      )}
      
      {/* Value Edit Dialog */}
      <Dialog open={!!valueEditDialog} onOpenChange={(open) => !open && setValueEditDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {valueEditDialog?.nodeType} Value</DialogTitle>
            <DialogDescription>
              Configure the value for {valueEditDialog?.nodeId}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Type-specific input forms */}
            {(() => {
              const nodeType = valueEditDialog?.nodeType
              
              // MaxCell / MinCell - number input with slider
              if (nodeType === 'MaxCell' || nodeType === 'MinCell') {
                const numVal = parseFloat(editValue) || 0
                return (
                  <div className="space-y-2">
                    <Label>Numeric Value</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground">{nodeType === 'MaxCell' ? 'Max' : 'Min'}</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={numVal}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full"
                    />
                  </div>
                )
              }
              
              // OrCell / AndCell - boolean with toggle
              if (nodeType === 'OrCell' || nodeType === 'AndCell') {
                const boolVal = editValue === 'true'
                return (
                  <div className="space-y-2">
                    <Label>Boolean Value</Label>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="text-sm">{boolVal ? 'True' : 'False'}</span>
                      <Switch
                        checked={boolVal}
                        onCheckedChange={(checked) => setEditValue(checked ? 'true' : 'false')}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {nodeType === 'OrCell' ? 'OR operation: any true → true' : 'AND operation: all true → true'}
                    </p>
                  </div>
                )
              }
              
              // SetCell / UnionCell - multi-value input
              if (nodeType === 'SetCell' || nodeType === 'UnionCell') {
                const items = editValue.split(',').map(s => s.trim()).filter(s => s)
                return (
                  <div className="space-y-2">
                    <Label>Set Values</Label>
                    <div className="space-y-2">
                      {items.map((item, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            value={item}
                            onChange={(e) => {
                              const newItems = [...items]
                              newItems[i] = e.target.value
                              setEditValue(newItems.join(', '))
                            }}
                            placeholder="Value"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const newItems = items.filter((_, idx) => idx !== i)
                              setEditValue(newItems.join(', '))
                            }}
                          >
                            ✕
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setEditValue(editValue ? editValue + ', ' : '')
                        }}
                      >
                        + Add Item
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {nodeType === 'SetCell' ? 'Grow-only set with deduplication' : 'Union of all input sets'}
                    </p>
                  </div>
                )
              }
              
              // OrdinalCell - rich value input with type detection
              if (nodeType === 'OrdinalCell' || nodeType === 'LatestCell') {
                return (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Value Type</Label>
                      <Select 
                        value={
                          !isNaN(parseFloat(editValue)) ? 'number' :
                          editValue === 'true' || editValue === 'false' ? 'boolean' :
                          'string'
                        }
                        onValueChange={(type) => {
                          switch(type) {
                            case 'number': setEditValue('0'); break
                            case 'boolean': setEditValue('false'); break
                            case 'string': setEditValue(''); break
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">String</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="boolean">Boolean</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Value</Label>
                      {editValue === 'true' || editValue === 'false' ? (
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <span className="text-sm">{editValue === 'true' ? 'True' : 'False'}</span>
                          <Switch
                            checked={editValue === 'true'}
                            onCheckedChange={(checked) => setEditValue(checked ? 'true' : 'false')}
                          />
                        </div>
                      ) : !isNaN(parseFloat(editValue)) && editValue !== '' ? (
                        <Input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder="Enter a number"
                        />
                      ) : (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder="Enter text"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              const submitButton = document.querySelector('[data-submit-value]') as HTMLButtonElement
                              submitButton?.click()
                            }
                          }}
                        />
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      {nodeType === 'OrdinalCell' ? 'Last-write-wins with ordinal tracking' : 'Keeps the most recent value'}
                    </p>
                  </div>
                )
              }
              
              // Default fallback for other cell types
              return (
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="Enter a value"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const submitButton = document.querySelector('[data-submit-value]') as HTMLButtonElement
                        submitButton?.click()
                      }
                    }}
                  />
                </div>
              )
            })()}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setValueEditDialog(null)}
            >
              Cancel
            </Button>
            <Button
              data-submit-value
              onClick={() => {
                if (valueEditDialog) {
                  const { gadget, nodeType } = valueEditDialog
                  const cell = gadget as any
                  
                  if (cell.userInput || cell.accept) {
                    // Handle different types
                    if (nodeType === 'SetCell' || nodeType === 'UnionCell') {
                      // Parse comma-separated values for sets
                      const items = editValue.split(',').map(s => s.trim()).filter(s => s)
                      const setItems: any[] = []
                      items.forEach(item => {
                        const numVal = parseFloat(item)
                        if (!isNaN(numVal) && item !== '') {
                          setItems.push(num(numVal))
                        } else if (item === 'true' || item === 'false') {
                          setItems.push(bool(item === 'true'))
                        } else {
                          setItems.push(str(item))
                        }
                      })
                      
                      // SetCell has an add method, others use accept
                      if (cell.add && nodeType === 'SetCell') {
                        // Clear and re-add all items
                        setItems.forEach(item => cell.add(item))
                      } else if (cell.accept) {
                        cell.accept(set(setItems), cell)
                      } else if (cell.userInput) {
                        cell.userInput(set(setItems))
                      }
                    } else if (nodeType === 'MaxCell' || nodeType === 'MinCell') {
                      // Numeric cells
                      const numVal = parseFloat(editValue)
                      if (!isNaN(numVal)) {
                        if (cell.accept) {
                          cell.accept(num(numVal), cell)
                        } else if (cell.userInput) {
                          cell.userInput(num(numVal))
                        }
                      }
                    } else if (nodeType === 'OrCell' || nodeType === 'AndCell') {
                      // Boolean cells
                      const boolVal = editValue === 'true'
                      if (cell.accept) {
                        cell.accept(bool(boolVal), cell)
                      } else if (cell.userInput) {
                        cell.userInput(bool(boolVal))
                      }
                    } else {
                      // OrdinalCell, LatestCell, and default handling
                      const trimmed = editValue.trim()
                      
                      // Try as number first
                      const numVal = parseFloat(trimmed)
                      let value
                      if (!isNaN(numVal) && trimmed !== '') {
                        value = num(numVal)
                      } else if (trimmed === 'true' || trimmed === 'false') {
                        value = bool(trimmed === 'true')
                      } else if (trimmed === '') {
                        value = nil()
                      } else {
                        // Remove quotes if present
                        const unquoted = trimmed.replace(/^["']|["']$/g, '')
                        value = str(unquoted)
                      }
                      
                      if (cell.userInput) {
                        cell.userInput(value)
                      } else if (cell.accept) {
                        cell.accept(value, cell)
                      }
                    }
                    
                    network.propagate()
                  }
                  
                  setValueEditDialog(null)
                  setEditValue('')
                }
              }}
            >
              Set Value
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  )
}

// Create network outside component to persist across re-renders
const persistentNetwork = new Network('programmable-editor-network')

export default function ProgrammableEditor() {
  return (
    <NetworkProvider network={persistentNetwork}>
      <ProgrammableEditorContent />
    </NetworkProvider>
  )
}