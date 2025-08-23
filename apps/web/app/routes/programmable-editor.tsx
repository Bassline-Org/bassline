/**
 * Programmable Editor - An editor that is itself a gadget in the network
 * 
 * This demonstrates bidirectional control between UI and propagation network.
 * The editor's state is exposed as cells that can be manipulated programmatically.
 */

import { useState, useCallback, useEffect } from 'react'
import { 
  NetworkProvider, 
  useNetwork, 
  useGadget, 
  useCell
} from '../../../../proper-bassline/src/react-integration'
import { EditorGadget } from '../../../../proper-bassline/src/editor-gadget'
import { GadgetRegistryGadget } from '../../../../proper-bassline/src/gadget-registry'
import { Network } from '../../../../proper-bassline/src/network'

// shadcn UI components
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Badge } from '~/components/ui/badge'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { Label } from '~/components/ui/label'

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
  
  // Get the actual arrays from the cell values
  const nodeArray = Array.isArray(nodes) ? nodes : []
  const edgeArray = Array.isArray(edges) ? edges : []
  
  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const mode = typeof editMode === 'string' ? editMode : 'select'
    
    if (mode === 'create') {
      // Create a new node with the selected gadget type
      const nodeId = `node-${Date.now()}`
      
      // Get the selected type from registry
      let gadgetType = 'OrdinalCell'
      if (selectedGadgetType?.type === 'dict') {
        const innerValue = selectedGadgetType.value.get('value')
        if (innerValue?.type === 'string') {
          gadgetType = innerValue.value
        }
      } else if (selectedGadgetType?.type === 'string') {
        gadgetType = selectedGadgetType.value
      }
      
      editor.addNode(nodeId, gadgetType, x, y)
      
      // Switch back to select mode
      editor.setEditMode('select')
    } else if (mode === 'select') {
      // Clear selection when clicking empty space
      editor.clearSelection()
      setConnectionStart(null)
      network.propagate()
    }
  }, [editMode, editor, network, selectedGadgetType])
  
  
  // Handle node drag
  const handleNodeDrag = useCallback((nodeId: string, deltaX: number, deltaY: number) => {
    const node = nodeArray.find((n: any) => n.id === nodeId)
    if (node) {
      const newX = node.x + deltaX
      const newY = node.y + deltaY
      editor.updateNodePosition(nodeId, newX, newY)
    }
  }, [nodeArray, editor])
  
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
    
    // Get selected gadget type
    let gadgetType = 'OrdinalCell'
    if (selectedGadgetType?.type === 'dict') {
      const innerValue = selectedGadgetType.value.get('value')
      if (innerValue?.type === 'string') {
        gadgetType = innerValue.value
      }
    } else if (selectedGadgetType?.type === 'string') {
      gadgetType = selectedGadgetType.value
    }
    
    for (let i = 0; i < count; i++) {
      const nodeId = `node-${Date.now()}-${i}`
      const x = Math.random() * 600 + 100
      const y = Math.random() * 400 + 100
      editor.addNode(nodeId, gadgetType, x, y)
    }
    
    // Force a propagation cycle to ensure updates flow
    network.propagate()
  }, [editor, network, selectedGadgetType])
  
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
        // Clear selection
        editor.clearSelection()
        editor.setEditMode('select')
        setConnectionStart(null)
        network.propagate()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editor, network, setConnectionStart])
  
  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="bg-gray-100 border-b p-4 flex gap-4 items-center">
        <div className="flex gap-2">
          <button
            onClick={() => {
              editor.setEditMode('select')
              network.propagate()
            }}
            className={`px-3 py-1 rounded ${currentMode === 'select' ? 'bg-blue-500 text-white' : 'bg-white'}`}
          >
            Select
          </button>
          <button
            onClick={() => {
              editor.setEditMode('create')
              network.propagate()
            }}
            className={`px-3 py-1 rounded ${currentMode === 'create' ? 'bg-blue-500 text-white' : 'bg-white'}`}
          >
            Create
          </button>
          <button
            onClick={() => {
              editor.setEditMode('connect')
              network.propagate()
            }}
            className={`px-3 py-1 rounded ${currentMode === 'connect' ? 'bg-blue-500 text-white' : 'bg-white'}`}
          >
            Connect
          </button>
          <button
            onClick={() => {
              editor.setEditMode('delete')
              network.propagate()
            }}
            className={`px-3 py-1 rounded ${currentMode === 'delete' ? 'bg-red-500 text-white' : 'bg-white'}`}
          >
            Delete
          </button>
        </div>
        
        <div className="border-l pl-4 flex gap-2">
          <button
            onClick={() => {
              editor.copySelected()
            }}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            title="Copy (Cmd/Ctrl+C)"
          >
            Copy
          </button>
          <button
            onClick={() => {
              editor.paste()
              network.propagate()
            }}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            title="Paste (Cmd/Ctrl+V)"
          >
            Paste
          </button>
          <button
            onClick={() => {
              editor.cut()
              network.propagate()
            }}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            title="Cut (Cmd/Ctrl+X)"
          >
            Cut
          </button>
        </div>
        
        <div className="border-l pl-4 flex gap-2 items-center">
          <label className="text-sm font-medium">Type:</label>
          <select
            value={(() => {
              let type = 'OrdinalCell'
              if (selectedGadgetType?.type === 'dict') {
                const innerValue = selectedGadgetType.value.get('value')
                if (innerValue?.type === 'string') {
                  type = innerValue.value
                }
              } else if (selectedGadgetType?.type === 'string') {
                type = selectedGadgetType.value
              }
              return type
            })()}
            onChange={(e) => {
              registry.selectType(e.target.value)
              network.propagate()
            }}
            className="px-2 py-1 border rounded text-sm"
          >
            {(() => {
              // Extract available types array
              let types: any[] = []
              if (availableTypes?.type === 'dict') {
                const innerValue = availableTypes.value.get('value')
                if (innerValue?.type === 'array') {
                  types = innerValue.value
                }
              } else if (availableTypes?.type === 'array') {
                types = availableTypes.value
              }
              
              // Group by category
              const categories: Record<string, any[]> = {}
              types.forEach((typeObj: any) => {
                if (typeObj?.type === 'object') {
                  const t = typeObj.value
                  const category = t.category || 'Other'
                  if (!categories[category]) {
                    categories[category] = []
                  }
                  categories[category].push(t)
                }
              })
              
              return Object.entries(categories).map(([category, items]) => (
                <optgroup key={category} label={category}>
                  {items.map((item: any) => (
                    <option key={item.className} value={item.className}>
                      {item.name}
                    </option>
                  ))}
                </optgroup>
              ))
            })()}
          </select>
        </div>
        
        <div className="border-l pl-4 flex gap-2">
          <button
            onClick={() => {
              runAutoLayout()
              network.propagate()
            }}
            className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Auto Layout
          </button>
          <button
            onClick={createRandomNodes}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Add 5 Nodes
          </button>
          <button
            onClick={() => {
              editor.clearSelection()
              network.propagate()
            }}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear Selection
          </button>
        </div>
        
        <div className="ml-auto text-sm text-gray-600">
          Mode: <span className="font-bold">{currentMode}</span>
          {selectedNodes && typeof selectedNodes === 'object' && selectedNodes instanceof Set && selectedNodes.size > 0 && (
            <span className="ml-2">
              | Selected: {selectedNodes.size} node(s)
            </span>
          )}
        </div>
      </div>
      
      {/* Canvas */}
      <div className="flex-1 flex">
        {/* Main canvas area */}
        <div 
          className="flex-1 relative overflow-hidden bg-gray-50"
          onClick={handleCanvasClick}
          style={{ cursor: currentMode === 'create' ? 'crosshair' : 'default' }}
        >
          {/* Grid background */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.5" fill="#ccc" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          
          {/* Edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {edgeArray.map((edge: any) => {
              const source = nodeArray.find((n: any) => n.id === edge.source)
              const target = nodeArray.find((n: any) => n.id === edge.target)
              if (!source || !target) return null
              
              return (
                <line
                  key={edge.id}
                  x1={source.x + 40}
                  y1={source.y + 20}
                  x2={target.x + 40}
                  y2={target.y + 20}
                  stroke="#999"
                  strokeWidth="2"
                />
              )
            })}
            
            {/* Connection preview */}
            {connectionStart && (
              <line
                x1={nodeArray.find((n: any) => n.id === connectionStart)?.x + 40}
                y1={nodeArray.find((n: any) => n.id === connectionStart)?.y + 20}
                x2={0}
                y2={0}
                stroke="#4CAF50"
                strokeWidth="2"
                strokeDasharray="5,5"
                className="connection-preview"
              />
            )}
          </svg>
          
          {/* Nodes */}
          {nodeArray.map((node: any) => (
            <div
              key={node.id}
              className={`absolute w-20 h-10 rounded border-2 flex items-center justify-center text-xs cursor-move select-none ${
                isNodeSelected(node.id) 
                  ? 'bg-blue-100 border-blue-500' 
                  : 'bg-white border-gray-300 hover:border-gray-500'
              }`}
              style={{ 
                left: node.x - 40, 
                top: node.y - 20,
                cursor: currentMode === 'delete' ? 'pointer' : 'move'
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
                } else if (mode === 'connect') {
                  if (!connectionStart) {
                    setConnectionStart(node.id)
                  } else if (connectionStart !== node.id) {
                    // Create connection
                    const edgeId = `edge-${Date.now()}`
                    editor.addEdge(edgeId, connectionStart, node.id)
                    setConnectionStart(null)
                  }
                } else if (mode === 'delete') {
                  // Delete the node
                  editor.removeNode(node.id)
                  network.propagate()
                }
              }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {(() => {
                // Show friendly name for gadget type
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
            </div>
          ))}
        </div>
        
        {/* Side panel - Shows editor state */}
        <div className="w-64 bg-white border-l p-4">
          <h3 className="font-bold mb-4">Editor State (Live)</h3>
          
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-semibold">Selected Nodes:</div>
              <div className="text-gray-600">
                {selectedNodes && typeof selectedNodes === 'object' && selectedNodes instanceof Set 
                  ? Array.from(selectedNodes).map((item: any) => item?.value).join(', ') || 'None'
                  : 'None'}
              </div>
            </div>
            
            <div>
              <div className="font-semibold">Hovered Node:</div>
              <div className="text-gray-600">
                {hoveredNode?.type === 'string' ? hoveredNode.value : 'None'}
              </div>
            </div>
            
            <div>
              <div className="font-semibold">Total Nodes:</div>
              <div className="text-gray-600">{nodeArray.length}</div>
            </div>
            
            <div>
              <div className="font-semibold">Total Edges:</div>
              <div className="text-gray-600">{edgeArray.length}</div>
            </div>
            
            <div>
              <div className="font-semibold">Clipboard:</div>
              <div className="text-gray-600">
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
                    return `${nodeCount} node(s), ${edgeCount} edge(s)`
                  }
                  return 'Empty'
                })()}
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <div className="font-semibold mb-2">Programmatic Control:</div>
              <div className="text-xs text-gray-500 mb-2">
                The editor state is exposed as cells that can be controlled by other gadgets in the network.
              </div>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
{`// Example:
editor.selectNode('node-1')
editor.setEditMode('create')
editor.panTo(100, 200)`}
              </pre>
            </div>
          </div>
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
    </div>
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