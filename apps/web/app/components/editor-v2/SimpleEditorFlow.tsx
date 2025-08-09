import { useCallback, useMemo, useState, useEffect, useRef, memo } from 'react'
import { useFetcher } from 'react-router'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import type {
  Connection,
  Edge,
  Node,
  NodeChange,
} from '@xyflow/react'
import type { GroupState } from '@bassline/core'
import { ContactNodeV2, type ContactNodeData } from './ContactNodeV2'
import { GroupNodeV2 } from './GroupNodeV2'
import { ValueSliderNode } from './ValueSliderNode'
import { KernelGadgetPalette } from './KernelGadgetPalette'
import { Breadcrumbs } from './Breadcrumbs'
import { PropertyPanel } from './PropertyPanel'
import { ContextMenu } from './ContextMenu'
import { ConnectionTypeDialog } from './ConnectionTypeDialog'
import { useSubgroupData } from '~/hooks/useSubgroupData'
import { useGroupWires } from '~/hooks/useGroupWires'
import '@xyflow/react/dist/style.css'

const nodeTypes = {
  contact: ContactNodeV2 as any,
  group: GroupNodeV2 as any,
  slider: ValueSliderNode as any,
}

interface SimpleEditorFlowProps {
  groupState: GroupState
  groupId: string
}

const SimpleEditorFlowInner = memo(function SimpleEditorFlowInner({ groupState, groupId }: SimpleEditorFlowProps) {
  const fetcher = useFetcher()
  const reactFlowInstance = useReactFlow()
  const subgroupData = useSubgroupData(groupState.group.subgroupIds)
  const processedWires = useGroupWires(groupState, subgroupData)
  
  // Initialize React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  // Load node view metadata from localStorage
  const loadNodeViewMetadata = (): Map<string, { viewComponent: string }> => {
    const stored = localStorage.getItem(`nodeViewMetadata-${groupId}`)
    if (stored) {
      return new Map(JSON.parse(stored))
    }
    return new Map()
  }
  
  const [nodeViewMetadata, setNodeViewMetadata] = useState<Map<string, { viewComponent: string }>>(loadNodeViewMetadata())
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [mode, setMode] = useState<'select' | 'add-contact' | 'add-slider'>('select')
  const [pendingNodeType, setPendingNodeType] = useState<{ content: unknown; type: 'contact' | 'slider' } | null>(null)
  const [showGadgetPalette, setShowGadgetPalette] = useState(false)
  const [showPropertyPanel, setShowPropertyPanel] = useState(false)
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [selectedEdges, setSelectedEdges] = useState<string[]>([])
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null)
  
  // Track previous groupId to detect actual navigation
  const [previousGroupId, setPreviousGroupId] = useState(groupId)
  
  // Reset state only when actually navigating to a different group
  useEffect(() => {
    if (groupId !== previousGroupId) {
      // Clear everything when navigating to a new group
      setNodeViewMetadata(loadNodeViewMetadata())
      setNodes([])
      setEdges([])
      setSelectedNodes([])
      setSelectedEdges([])
      setPendingNodeType(null)
      setPreviousGroupId(groupId)
      nodePositionsRef.current.clear() // Clear position cache for new group
      newContactCountRef.current = 0 // Reset counters for new group
      newGroupCountRef.current = 0
      
      // Reset React Flow view
      if (reactFlowInstance) {
        setTimeout(() => {
          reactFlowInstance.fitView({ padding: 0.2 })
        }, 100)
      }
    }
  }, [groupId, previousGroupId, reactFlowInstance])
  
  // Save node view metadata to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(`nodeViewMetadata-${groupId}`, JSON.stringify(Array.from(nodeViewMetadata.entries())))
  }, [nodeViewMetadata, groupId])
  
  // Detect new contacts and apply pending view component
  useEffect(() => {
    if (pendingNodeType && groupState.contacts instanceof Map) {
      // Find contact with matching content
      for (const [contactId, contact] of groupState.contacts) {
        if (contact.content === pendingNodeType.content && !nodeViewMetadata.has(contactId)) {
          setNodeViewMetadata(prev => new Map(prev).set(contactId, { viewComponent: pendingNodeType.type }))
          setPendingNodeType(null)
          break
        }
      }
    }
  }, [groupState.contacts, pendingNodeType, nodeViewMetadata])
  
  
  // Store node positions separately to prevent circular dependencies
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const newContactCountRef = useRef(0)
  const newGroupCountRef = useRef(0)
  
  // Smart update effect that only updates changed nodes
  useEffect(() => {
    setNodes(currentNodes => {
      const existingNodeMap = new Map(currentNodes.map(n => [n.id, n]))
      const updatedNodeIds = new Set<string>()
      const resultNodes: Node[] = []
      
      // Process contacts - only update if data changed
      if (groupState.contacts instanceof Map) {
        groupState.contacts.forEach((contact) => {
          if (contact && contact.id) {
            updatedNodeIds.add(contact.id)
            const existingNode = existingNodeMap.get(contact.id)
            const metadata = nodeViewMetadata.get(contact.id)
            const nodeType = metadata?.viewComponent || 'contact'
            
            // Check if node data actually changed
            const existingData = existingNode?.data as ContactNodeData | undefined
            if (existingNode && 
                existingNode.type === nodeType &&
                existingData?.contact?.content === contact.content &&
                existingData?.contact?.blendMode === contact.blendMode &&
                existingData?.groupId === groupId) {
              // Reuse existing node completely - no changes
              resultNodes.push(existingNode)
            } else if (existingNode) {
              // Existing node needs data update - preserve everything else
              resultNodes.push({
                ...existingNode,
                type: nodeType, // In case type changed (slider <-> contact)
                data: { contact, groupId }
              })
            } else {
              // Completely new node
              let position = nodePositionsRef.current.get(contact.id)
              if (!position) {
                position = { 
                  x: 100 + (newContactCountRef.current * 150), 
                  y: 100 + (Math.floor(newContactCountRef.current / 4) * 150) 
                }
                newContactCountRef.current++
                nodePositionsRef.current.set(contact.id, position)
              }
              
              resultNodes.push({
                id: contact.id,
                type: nodeType,
                position,
                data: { contact, groupId }
              })
            }
          }
        })
      }
      
      // Process subgroups - only update if data changed
      groupState.group.subgroupIds.forEach((subgroupId) => {
        if (subgroupId) {
          updatedNodeIds.add(subgroupId)
          const existingNode = existingNodeMap.get(subgroupId)
          const subgroup = subgroupData.get(subgroupId)
          
          const nodeData = {
            groupId: subgroupId,
            parentGroupId: groupId,
            name: subgroup?.name || `Group ${subgroupId.slice(0, 8)}`,
            isGadget: !!subgroup?.primitiveId,
            primitiveId: subgroup?.primitiveId,
            boundaryContacts: subgroup?.boundaryContacts || []
          }
          
          // Check if node data actually changed
          if (existingNode && 
              existingNode.type === 'group' &&
              JSON.stringify(existingNode.data) === JSON.stringify(nodeData)) {
            // Reuse existing node completely - no changes
            resultNodes.push(existingNode)
          } else if (existingNode) {
            // Existing node needs data update - preserve everything else
            resultNodes.push({
              ...existingNode,
              data: nodeData
            })
          } else {
            // Completely new node
            let position = nodePositionsRef.current.get(subgroupId)
            if (!position) {
              position = { 
                x: 300 + (newGroupCountRef.current * 200), 
                y: 300 + (Math.floor(newGroupCountRef.current / 3) * 200)
              }
              newGroupCountRef.current++
              nodePositionsRef.current.set(subgroupId, position)
            }
            
            resultNodes.push({
              id: subgroupId,
              type: 'group',
              position,
              data: nodeData
            })
          }
        }
      })
      
      // Keep any nodes that are no longer in the state (shouldn't happen, but safety)
      currentNodes.forEach(node => {
        if (!updatedNodeIds.has(node.id)) {
          console.warn(`Node ${node.id} not found in state, removing`)
          nodePositionsRef.current.delete(node.id)
        }
      })
      
      return resultNodes
    })
  }, [groupState.contacts, groupState.group.subgroupIds, subgroupData, nodeViewMetadata, groupId])
  
  // Update edges when wires change - use callback for stability
  useEffect(() => {
    setEdges(currentEdges => {
      // Quick check if wires are the same
      if (currentEdges.length === processedWires.length) {
        const currentIds = new Set(currentEdges.map(e => e.id))
        const newIds = new Set(processedWires.map(w => w.id))
        const allSame = processedWires.every(w => currentIds.has(w.id)) && 
                        currentEdges.every(e => newIds.has(e.id))
        if (allSame) {
          // No changes, return current edges to prevent re-render
          return currentEdges
        }
      }
      return processedWires as Edge[]
    })
  }, [processedWires])
  
  // Handle node position changes
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    // Update position cache for moved nodes
    changes.forEach(change => {
      if (change.type === 'position' && change.position) {
        nodePositionsRef.current.set(change.id, change.position)
      } else if (change.type === 'remove') {
        nodePositionsRef.current.delete(change.id)
      }
    })
    onNodesChange(changes)
  }, [onNodesChange])
  
  // Handle gadget placement from palette
  const handleGadgetPlace = useCallback((qualifiedName: string, position: { x: number, y: number }) => {
    fetcher.submit({
      intent: 'create-primitive-gadget',
      groupId,
      qualifiedName,
      position: JSON.stringify(position)
    }, {
      method: 'post',
      action: '/api/editor/actions'
    })
    
    setShowGadgetPalette(false)
  }, [fetcher, groupId])
  
  // Handle edge connections
  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return
    
    // Show connection type dialog
    setPendingConnection(params)
  }, [])
  
  // Handle background click
  const onPaneClick = useCallback((event: React.MouseEvent) => {
    if (mode === 'add-contact' || mode === 'add-slider') {
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      
      const defaultContent = mode === 'add-slider' ? 50 : 'New Contact'
      const nodeType = mode === 'add-slider' ? 'slider' : 'contact'
      
      // Set pending node type before creating
      setPendingNodeType({ content: defaultContent, type: nodeType })
      
      fetcher.submit({
        intent: 'add-contact',
        groupId,
        content: JSON.stringify(defaultContent),
        blendMode: 'accept-last',
        position: JSON.stringify(position),
        nodeType
      }, {
        method: 'post',
        action: '/api/editor/actions'
      })
      
      setMode('select')
    }
  }, [mode, reactFlowInstance, fetcher, groupId])
  
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Extract to group: Cmd/Ctrl + G
      if ((event.metaKey || event.ctrlKey) && event.key === 'g' && !event.shiftKey) {
        event.preventDefault()
        const selectedContactIds = selectedNodes.filter(nodeId => {
          const node = nodes.find(n => n.id === nodeId)
          return node?.type === 'contact' || node?.type === 'slider'
        })
        
        if (selectedContactIds.length > 0) {
          const groupName = prompt('Enter group name:', 'New Group')
          if (groupName) {
            fetcher.submit({
              intent: 'extract-to-group',
              contactIds: JSON.stringify(selectedContactIds),
              groupName,
              parentGroupId: groupId
            }, {
              method: 'post',
              action: '/api/editor/actions'
            })
          }
        }
      }
      
      // Inline group: Cmd/Ctrl + Shift + G
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'g') {
        event.preventDefault()
        const selectedGroupIds = selectedNodes.filter(nodeId => {
          const node = nodes.find(n => n.id === nodeId)
          return node?.type === 'group' && !node?.data.isGadget
        })
        
        if (selectedGroupIds.length === 1) {
          fetcher.submit({
            intent: 'inline-group',
            groupId: selectedGroupIds[0]
          }, {
            method: 'post',
            action: '/api/editor/actions'
          })
        }
      }
      
      // Copy: Cmd/Ctrl + D (duplicate)
      if ((event.metaKey || event.ctrlKey) && event.key === 'd') {
        event.preventDefault()
        
        // Check what's selected
        const selectedContactIds = selectedNodes.filter(nodeId => {
          const node = nodes.find(n => n.id === nodeId)
          return node?.type === 'contact' || node?.type === 'slider'
        })
        
        const selectedGroupIds = selectedNodes.filter(nodeId => {
          const node = nodes.find(n => n.id === nodeId)
          return node?.type === 'group'
        })
        
        if (selectedContactIds.length > 0 || selectedGroupIds.length > 0) {
          // Use unified copy-selection for any combination
          fetcher.submit({
            intent: 'copy-selection',
            contactIds: JSON.stringify(selectedContactIds),
            groupIds: JSON.stringify(selectedGroupIds),
            targetGroupId: groupId,
            includeWires: 'true',
            deep: 'true'
          }, {
            method: 'post',
            action: '/api/editor/actions'
          })
        }
      }
      
      if ((event.key === 'Delete' || event.key === 'Backspace')) {
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          event.preventDefault()
          
          // Delete selected nodes
          selectedNodes.forEach(nodeId => {
            const node = nodes.find(n => n.id === nodeId)
            if (node) {
              if (node.type === 'contact' || node.type === 'slider') {
                fetcher.submit({
                  intent: 'delete-contact',
                  contactId: nodeId
                }, {
                  method: 'post',
                  action: '/api/editor/actions'
                })
                // Clean up nodeViewMetadata
                setNodeViewMetadata(prev => {
                  const next = new Map(prev)
                  next.delete(nodeId)
                  return next
                })
              } else if (node.type === 'group') {
                fetcher.submit({
                  intent: 'delete-group',
                  groupId: nodeId
                }, {
                  method: 'post',
                  action: '/api/editor/actions'
                })
              }
            }
          })
          
          // Delete selected edges
          selectedEdges.forEach(edgeId => {
            fetcher.submit({
              intent: 'delete-wire',
              wireId: edgeId
            }, {
              method: 'post',
              action: '/api/editor/actions'
            })
          })
          
          // Clear selection after deletion
          setSelectedNodes([])
          setSelectedEdges([])
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNodes, selectedEdges, nodes, fetcher, groupId])
  
  // Handle selection changes
  const onSelectionChange = useCallback((params: { nodes: Node[]; edges: Edge[] }) => {
    setSelectedNodes(params.nodes.map(n => n.id))
    setSelectedEdges(params.edges.map(e => e.id))
  }, [])
  
  // Handle right-click context menu
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    event.stopPropagation()
    
    // If node is not selected, select only this node
    if (!selectedNodes.includes(node.id)) {
      setSelectedNodes([node.id])
      setSelectedEdges([])
    }
    
    setContextMenu({ x: event.clientX, y: event.clientY })
  }, [selectedNodes])
  
  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault()
    if (selectedNodes.length > 0) {
      setContextMenu({ x: event.clientX, y: event.clientY })
    }
  }, [selectedNodes])
  
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 py-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <span className="font-semibold">Editor V2</span>
            <Breadcrumbs currentGroupId={groupId} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMode('select')}
              className={`px-3 py-1 rounded ${mode === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Select
            </button>
            <button
              onClick={() => setMode('add-contact')}
              className={`px-3 py-1 rounded ${mode === 'add-contact' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Add Contact
            </button>
            <button
              onClick={() => setMode('add-slider')}
              className={`px-3 py-1 rounded ${mode === 'add-slider' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Add Slider
            </button>
            <button
              onClick={() => setShowGadgetPalette(!showGadgetPalette)}
              className={`px-3 py-1 rounded ${showGadgetPalette ? 'bg-purple-500 text-white' : 'bg-gray-200'}`}
            >
              Gadgets
            </button>
            <button
              onClick={() => setShowPropertyPanel(!showPropertyPanel)}
              className={`px-3 py-1 rounded ${showPropertyPanel ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
              disabled={selectedNodes.length === 0}
            >
              Properties
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={onPaneClick}
          onSelectionChange={onSelectionChange}
          onNodeContextMenu={onNodeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          nodeTypes={nodeTypes}
          fitView={false}
          deleteKeyCode={['Delete', 'Backspace']}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
        >
          <Background />
          <Controls />
        </ReactFlow>
        
        {/* Gadget Palette */}
        {showGadgetPalette && (
          <div className="absolute right-4 top-4 z-10">
            <KernelGadgetPalette 
              groupId={groupId} 
              onGadgetPlace={handleGadgetPlace}
            />
          </div>
        )}
        
        {/* Property Panel */}
        {showPropertyPanel && (
          <PropertyPanel
            selectedNodes={selectedNodes}
            nodes={nodes}
            onClose={() => setShowPropertyPanel(false)}
          />
        )}
        
        {/* Context Menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            selectedNodes={selectedNodes}
            nodes={nodes}
            groupId={groupId}
            onClose={() => setContextMenu(null)}
          />
        )}
        
        {/* Connection Type Dialog */}
        <ConnectionTypeDialog
          connection={pendingConnection}
          onClose={() => setPendingConnection(null)}
        />
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render on structural changes
  
  // Different group? Always re-render
  if (prevProps.groupId !== nextProps.groupId) {
    return false // false means "props are different, do re-render"
  }
  
  const prevState = prevProps.groupState
  const nextState = nextProps.groupState
  
  // Check structural changes only (not content changes)
  const contactsSame = prevState.contacts.size === nextState.contacts.size
  const wiresSame = prevState.wires.size === nextState.wires.size
  const subgroupsSame = 
    prevState.group.subgroupIds.length === nextState.group.subgroupIds.length &&
    prevState.group.subgroupIds.every((id, i) => id === nextState.group.subgroupIds[i])
  
  // Return true if nothing structural changed (prevents re-render)
  // Return false if something structural changed (triggers re-render)
  const shouldSkipRender = contactsSame && wiresSame && subgroupsSame
  
  if (!shouldSkipRender) {
    console.log('[SimpleEditorFlow] Re-rendering due to structural change:', {
      contactsSame,
      wiresSame,
      subgroupsSame
    })
  }
  
  return shouldSkipRender
})

export function SimpleEditorFlow(props: SimpleEditorFlowProps) {
  return (
    <ReactFlowProvider>
      <SimpleEditorFlowInner {...props} />
    </ReactFlowProvider>
  )
}