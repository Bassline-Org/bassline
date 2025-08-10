import { useEffect, useCallback, useState, useRef } from 'react'
import { useOutletContext, useLoaderData, useFetcher, useRevalidator, useNavigate } from 'react-router'
import { 
  ReactFlow, 
  Background, 
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Node,
  type Edge
} from '@xyflow/react'
import type { ClientLoaderFunctionArgs, ClientActionFunctionArgs } from 'react-router'
import { StyledContactNode } from '~/components/flow-nodes/StyledContactNode'
import { StyledGroupNode } from '~/components/flow-nodes/StyledGroupNode'
import { GadgetPalette } from '~/components/flow-nodes/GadgetPalette'
import { ContextMenu } from '~/components/flow-nodes/ContextMenu'
import { PropertiesPanel } from '~/components/flow-nodes/PropertiesPanel'

// Custom node types
const nodeTypes = {
  contact: StyledContactNode,
  group: StyledGroupNode
}

// Store node positions globally per group to preserve them across reloads
const nodePositionCache = new Map<string, Map<string, { x: number, y: number }>>()

// Load initial state from network for this specific group
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  
  const sessionId = params.sessionId!
  const groupId = params.groupId!
  
  // Get client from session
  const client = (window as any).__BASSLINE_SESSIONS__?.get(sessionId)?.client
  
  if (!client) {
    console.error('[GroupEditor] No client found for session:', sessionId)
    return { nodes: [], edges: [], primitives: [] }
  }
  
  // Get or create position cache for this group
  if (!nodePositionCache.has(groupId)) {
    nodePositionCache.set(groupId, new Map())
  }
  const positionCache = nodePositionCache.get(groupId)!
  
  // Load primitives for gadget palette and create a map for quick lookup
  let primitives = []
  const primitiveMap = new Map<string, any>()
  try {
    primitives = await client.listPrimitiveInfo?.() || []
    // Create a map for quick lookup by qualified name
    primitives.forEach((p: any) => {
      primitiveMap.set(p.qualifiedName, p)
    })
  } catch (e) {
    console.warn('[GroupEditor] Could not load primitives:', e)
  }
  
  try {
    const state = await client.getState(groupId)
    
    // Store subgroup data to avoid loading twice
    const subgroupDataCache = new Map<string, any>()
    
    // Map contacts to nodes
    const nodes: Node[] = []
    let nodeCounter = 0
    if (state.contacts instanceof Map) {
      state.contacts.forEach((contact, id) => {
        // Use cached position if available, otherwise generate new one
        const position = positionCache.get(id) || { 
          x: 100 + (nodeCounter % 5) * 150, 
          y: 100 + Math.floor(nodeCounter / 5) * 100 
        }
        nodeCounter++
        
        nodes.push({
          id,
          type: 'contact',
          position,
          data: { 
            content: contact.content,
            blendMode: contact.blendMode,
            isBoundary: contact.isBoundary || false,
            contactId: id,
            groupId
          }
        })
      })
    }
    
    // Map subgroups to nodes
    if (state.group && Array.isArray(state.group.subgroupIds)) {
      for (const subgroupId of state.group.subgroupIds) {
        // Try to get subgroup info
        let subgroupData = null
        try {
          subgroupData = await client.getState(subgroupId)
          // Cache it for edge mapping
          subgroupDataCache.set(subgroupId, subgroupData)
        } catch (e) {
          console.warn(`[GroupEditor] Could not load subgroup ${subgroupId}`)
        }
        
        // Use cached position for groups too
        const position = positionCache.get(subgroupId) || { 
          x: 300 + nodes.length * 150, 
          y: 300 
        }
        
        // Extract boundary contacts for gadgets
        const inputContacts: Array<{id: string, name: string}> = []
        const outputContacts: Array<{id: string, name: string}> = []
        
        if (subgroupData?.contacts instanceof Map) {
          // For primitive gadgets, get the primitive info to know exact inputs/outputs
          let primitiveInfo = null
          if (subgroupData?.group?.primitive) {
            const primitiveId = subgroupData.group.primitive.id
            // Try to find the primitive info - it might be stored with or without namespace
            primitiveInfo = primitiveMap.get(primitiveId) || 
                           primitiveMap.get(`@bassline/core/${primitiveId}`) ||
                           Array.from(primitiveMap.values()).find(p => p.id === primitiveId || p.qualifiedName.endsWith(`/${primitiveId}`))
            
            // Only log if we didn't find the primitive info
            if (!primitiveInfo) {
              console.warn('[GroupEditor] Primitive info not found for:', primitiveId)
            }
          }
          
          // For primitive gadgets with known info, we'll map contacts by order
          if (primitiveInfo && subgroupData?.group?.primitive) {
            // Get all boundary contacts
            const boundaryContacts = Array.from(subgroupData.contacts.entries())
              .filter(([_, contact]) => contact.isBoundary)
              .map(([id, contact]) => ({ id, contact }))
            
            // Map inputs and outputs based on primitive definition order
            // The kernel creates contacts in order: inputs first, then outputs
            let contactIndex = 0
            
            // Map input contacts
            if (primitiveInfo.inputs) {
              for (const inputName of primitiveInfo.inputs) {
                if (contactIndex < boundaryContacts.length) {
                  const { id } = boundaryContacts[contactIndex]
                  inputContacts.push({ id, name: inputName })
                  contactIndex++
                }
              }
            }
            
            // Map output contacts
            if (primitiveInfo.outputs) {
              for (const outputName of primitiveInfo.outputs) {
                if (contactIndex < boundaryContacts.length) {
                  const { id } = boundaryContacts[contactIndex]
                  outputContacts.push({ id, name: outputName })
                  contactIndex++
                }
              }
            }
          } else {
            // Fallback for non-primitive groups or when primitive info is not found
            subgroupData.contacts.forEach((contact, contactId) => {
              if (contact.isBoundary) {
                const contactName = contactId.split('-').pop() || contactId
                
                if (subgroupData?.group?.primitive) {
                  // Primitive without info - use pattern matching
                  if (contactName.match(/^(in|input|a|b|x|y|value|source|from)/i)) {
                    inputContacts.push({ id: contactId, name: contactName })
                  } else if (contactName.match(/^(out|output|result|sum|product|to)/i)) {
                    outputContacts.push({ id: contactId, name: contactName })
                  } else {
                    inputContacts.push({ id: contactId, name: contactName })
                  }
                } else {
                  // Regular groups - bidirectional
                  inputContacts.push({ id: contactId, name: contactName })
                  outputContacts.push({ id: contactId, name: contactName })
                }
              }
            })
          }
        }
        
        
        nodes.push({
          id: subgroupId,
          type: 'group',
          position,
          data: {
            groupId: subgroupId,
            name: subgroupData?.group?.name || `Group ${subgroupId.slice(0, 8)}`,
            isGadget: !!subgroupData?.group?.primitive,
            primitiveId: subgroupData?.group?.primitive?.id,
            inputContacts,
            outputContacts
          },
          // Set explicit dimensions for gadgets to override React Flow defaults
          ...(subgroupData?.group?.primitive ? { 
            style: { width: 60, height: 60 },
            width: 60,
            height: 60
          } : {})
        })
      }
    }
    
    // Map wires to edges
    const edges: Edge[] = []
    if (state.wires instanceof Map) {
      
      // Create a map of boundary contact IDs to their parent group/gadget
      const boundaryContactToGroup = new Map<string, string>()
      
      // Map boundary contacts from cached subgroup data
      subgroupDataCache.forEach((subgroupData, subgroupId) => {
        if (subgroupData?.contacts instanceof Map) {
          subgroupData.contacts.forEach((contact, contactId) => {
            if (contact.isBoundary) {
              boundaryContactToGroup.set(contactId, subgroupId)
            }
          })
        }
      })
      
      
      state.wires.forEach((wire, id) => {
        // Check if either end is a boundary contact of a gadget
        let sourceGroup = boundaryContactToGroup.get(wire.fromId)
        let targetGroup = boundaryContactToGroup.get(wire.toId)
        
        // Fallback: Check if the contact belongs to any gadget node we've created
        // This handles cases where the wire exists but we haven't mapped the boundary contact
        if (!sourceGroup || !targetGroup) {
          for (const node of nodes) {
            if (node.type === 'group' && node.data.isGadget) {
              const { inputContacts = [], outputContacts = [] } = node.data
              
              // Check if wire.fromId is one of this gadget's contacts
              if (!sourceGroup) {
                const isOutput = outputContacts.some(c => c.id === wire.fromId)
                const isInput = inputContacts.some(c => c.id === wire.fromId)
                if (isOutput || isInput) {
                  sourceGroup = node.id
                }
              }
              
              // Check if wire.toId is one of this gadget's contacts  
              if (!targetGroup) {
                const isInput = inputContacts.some(c => c.id === wire.toId)
                const isOutput = outputContacts.some(c => c.id === wire.toId)
                if (isInput || isOutput) {
                  targetGroup = node.id
                }
              }
              
              // Stop searching if we found both
              if (sourceGroup && targetGroup) break
            }
          }
        }
        
        const edge: Edge = {
          id,
          source: sourceGroup || wire.fromId,  // Use group ID if it's a boundary contact
          target: targetGroup || wire.toId,    // Use group ID if it's a boundary contact
          type: wire.type === 'directed' ? 'straight' : 'default'
        }
        
        // Add handle IDs for connections to gadget boundary contacts
        if (sourceGroup) {
          edge.sourceHandle = wire.fromId  // The boundary contact ID
        }
        if (targetGroup) {
          edge.targetHandle = wire.toId    // The boundary contact ID
        }
        
        
        edges.push(edge)
      })
    }
    
    return { nodes, edges, primitives, primitiveMap: Array.from(primitiveMap.entries()) }
  } catch (error) {
    console.error('[GroupEditor] Error loading state:', error)
    return { nodes: [], edges: [], primitives: [], primitiveMap: [] }
  }
}

// Handle network mutations for this group
export async function clientAction({ request, params }: ClientActionFunctionArgs) {
  const formData = await request.formData()
  const intent = formData.get('intent') as string
  const sessionId = params.sessionId!
  const groupId = params.groupId!
  
  // Get client
  const client = (window as any).__BASSLINE_SESSIONS__?.get(sessionId)?.client
  if (!client) {
    return { error: 'No client found' }
  }
  
  
  switch (intent) {
    case 'connect': {
      const source = formData.get('source') as string
      const target = formData.get('target') as string
      await client.connect(source, target, 'bidirectional')
      
      return { success: true }
    }
    
    case 'add-contact': {
      const position = JSON.parse(formData.get('position') as string)
      const contactId = await client.addContact(groupId, {
        content: '',
        blendMode: 'accept-last'
      })
      // Cache the position for this new contact
      const positionCache = nodePositionCache.get(groupId)
      if (positionCache) {
        positionCache.set(contactId, position)
      }
      return { success: true, contactId }
    }
    
    case 'add-gadget': {
      const qualifiedName = formData.get('qualifiedName') as string
      const position = JSON.parse(formData.get('position') as string)
      // Use the V2 method with correct parameter order
      const gadgetId = await client.createPrimitiveGadgetV2(qualifiedName, groupId)
      // Cache the position for this new gadget
      const positionCache = nodePositionCache.get(groupId)
      if (positionCache) {
        positionCache.set(gadgetId, position)
      }
      return { success: true, gadgetId }
    }
    
    case 'delete-node': {
      const nodeId = formData.get('nodeId') as string
      const nodeType = formData.get('nodeType') as string
      
      if (nodeType === 'contact') {
        await client.removeContact(nodeId)
      } else if (nodeType === 'group') {
        await client.removeGroup(nodeId)
      }
      return { success: true }
    }
    
    case 'delete-edge': {
      const edgeId = formData.get('edgeId') as string
      await client.removeWire(edgeId)
      return { success: true }
    }
    
    case 'update-contact': {
      const contactId = formData.get('contactId') as string
      const groupId = formData.get('groupId') as string
      const value = JSON.parse(formData.get('value') as string)
      await client.updateContact(contactId, groupId, value)
      return { success: true }
    }
    
    case 'extract-to-group': {
      const contactIds = JSON.parse(formData.get('contactIds') as string) as string[]
      const groupName = formData.get('groupName') as string
      await client.applyRefactoring('extract-to-group', {
        contactIds,
        groupName,
        parentGroupId: groupId
      })
      return { success: true }
    }
    
    case 'inline-group': {
      const groupIdToInline = formData.get('groupId') as string
      await client.applyRefactoring('inline-group', {
        groupId: groupIdToInline
      })
      return { success: true }
    }
    
    default:
      return { error: 'Unknown intent' }
  }
}

export default function GroupEditor() {
  const { nodes: initialNodes, edges: initialEdges, primitives } = useLoaderData<typeof clientLoader>()
  const context = useOutletContext<{ sessionId: string; groupId: string; client: any }>()
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [showGadgetPalette, setShowGadgetPalette] = useState(false)
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(true)
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [selectedEdges, setSelectedEdges] = useState<string[]>([])
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const revalidator = useRevalidator()
  const fetcher = useFetcher()
  const navigate = useNavigate()
  
  
  // Get client from context
  const client = context.client || (window as any).__BASSLINE_SESSIONS__?.get(context.sessionId)?.client
  
  // Subscribe to network changes for this group
  useEffect(() => {
    if (!client || !context.groupId) return
    
    const unsubscribe = client.subscribe(context.groupId, (changes: any[]) => {
      // Revalidate to get fresh data when network changes
      revalidator.revalidate()
    })
    
    return () => {
      unsubscribe()
    }
  }, [client, context.groupId, revalidator])
  
  // Update local state when loader data changes, but preserve positions and selection
  useEffect(() => {
    setNodes(currentNodes => {
      // Create maps of current node state we want to preserve
      const positionMap = new Map(currentNodes.map(n => [n.id, n.position]))
      const selectedMap = new Map(currentNodes.map(n => [n.id, n.selected]))
      
      // Update nodes with new data but keep positions and selection
      return initialNodes.map(node => ({
        ...node,
        position: positionMap.get(node.id) || node.position,
        selected: selectedMap.get(node.id) || false
      }))
    })
    setEdges(currentEdges => {
      // Also preserve edge selection
      const selectedMap = new Map(currentEdges.map(e => [e.id, e.selected]))
      return initialEdges.map(edge => ({
        ...edge,
        selected: selectedMap.get(edge.id) || false
      }))
    })
  }, [initialNodes, initialEdges, setNodes, setEdges])
  
  // Handle node position changes - cache them
  const handleNodesChange = useCallback((changes: any[]) => {
    // Update position cache for moved nodes
    const positionCache = nodePositionCache.get(context.groupId)
    if (positionCache) {
      changes.forEach(change => {
        if (change.type === 'position' && change.position) {
          positionCache.set(change.id, change.position)
        }
      })
    }
    onNodesChange(changes)
  }, [context.groupId, onNodesChange])
  
  // Handle connections
  const onConnect = useCallback((params: Connection) => {
    // For connections to/from gadgets, use the handle ID if provided
    // The handle ID is the boundary contact ID for gadget nodes
    const sourceId = params.sourceHandle || params.source!
    const targetId = params.targetHandle || params.target!
    
    fetcher.submit(
      {
        intent: 'connect',
        source: sourceId,
        target: targetId
      },
      { method: 'post' }
    )
  }, [fetcher])
  
  // Handle node deletion
  const onNodesDelete = useCallback((nodesToDelete: Node[]) => {
    nodesToDelete.forEach(node => {
      fetcher.submit(
        {
          intent: 'delete-node',
          nodeId: node.id,
          nodeType: node.type
        },
        { method: 'post' }
      )
    })
  }, [fetcher])
  
  // Handle edge deletion
  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    edgesToDelete.forEach(edge => {
      fetcher.submit(
        {
          intent: 'delete-edge',
          edgeId: edge.id
        },
        { method: 'post' }
      )
    })
  }, [fetcher])
  
  // Handle double-click on group nodes to navigate into them
  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type === 'group') {
      const groupId = node.data.groupId || node.id
      navigate(`/flow/session/${context.sessionId}/group/${groupId}`)
    }
  }, [navigate, context.sessionId])
  
  // Handle gadget placement
  const handleGadgetPlace = useCallback((qualifiedName: string, position: { x: number, y: number }) => {
    fetcher.submit(
      {
        intent: 'add-gadget',
        qualifiedName,
        position: JSON.stringify(position)
      },
      { method: 'post' }
    )
  }, [fetcher])
  
  // Handle selection changes
  const onSelectionChange = useCallback((params: { nodes: Node[], edges: Edge[] }) => {
    setSelectedNodes(params.nodes.map(n => n.id))
    setSelectedEdges(params.edges.map(e => e.id))
  }, [])
  
  // Handle right-click for context menu
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }, [])
  
  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Don't handle shortcuts if user is typing in an input field
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.tagName === 'SELECT' ||
      target.contentEditable === 'true'
    ) {
      return
    }
    
    // Delete selected nodes and edges
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      
      // Delete selected nodes
      selectedNodes.forEach(nodeId => {
        const node = nodes.find(n => n.id === nodeId)
        if (node) {
          fetcher.submit(
            { intent: 'delete-node', nodeId, nodeType: node.type },
            { method: 'post' }
          )
        }
      })
      
      // Delete selected edges
      selectedEdges.forEach(edgeId => {
        fetcher.submit(
          { intent: 'delete-edge', edgeId },
          { method: 'post' }
        )
      })
    }
    
    // Group selected nodes (Cmd+G)
    if (event.metaKey && event.key === 'g') {
      event.preventDefault()
      if (selectedNodes.length > 0) {
        // Extract selected contacts to a new group
        const contactIds = selectedNodes.filter(nodeId => {
          const node = nodes.find(n => n.id === nodeId)
          return node?.type === 'contact'
        })
        
        if (contactIds.length > 0) {
          fetcher.submit(
            { 
              intent: 'extract-to-group',
              contactIds: JSON.stringify(contactIds),
              groupName: `Group ${Date.now().toString(36)}`
            },
            { method: 'post' }
          )
        }
      }
    }
    
    // Duplicate selected nodes (Cmd+D)
    if (event.metaKey && event.key === 'd') {
      event.preventDefault()
      if (selectedNodes.length > 0) {
        // TODO: Implement duplication
      }
    }
    
    // Select all (Cmd+A)
    if (event.metaKey && event.key === 'a') {
      event.preventDefault()
      // React Flow handles this internally when multiSelectable is true
    }
  }, [selectedNodes, selectedEdges, fetcher])
  
  return (
    <div className="h-full w-full relative" onKeyDown={handleKeyDown} onContextMenu={handleContextMenu} tabIndex={0}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeDoubleClick={onNodeDoubleClick}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        selectNodesOnDrag={false}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
      
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded shadow-lg transition-colors"
          onClick={() => {
            const centerX = window.innerWidth / 2
            const centerY = window.innerHeight / 2
            fetcher.submit(
              {
                intent: 'add-contact',
                position: JSON.stringify({ x: centerX, y: centerY })
              },
              { method: 'post' }
            )
          }}
        >
          Add Contact
        </button>
        
        <button
          className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded shadow-lg transition-colors"
          onClick={() => setShowGadgetPalette(!showGadgetPalette)}
        >
          {showGadgetPalette ? 'Hide' : 'Show'} Gadgets
        </button>
        
        {/* Add back navigation if not at root */}
        {context.groupId !== 'root' && (
          <button
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded shadow-lg transition-colors"
            onClick={() => {
              // TODO: Navigate to parent group once we track hierarchy
              navigate(`/flow/session/${context.sessionId}/group/root`)
            }}
          >
            ← Exit Group
          </button>
        )}
      </div>
      
      {/* Gadget Palette */}
      <GadgetPalette
        isVisible={showGadgetPalette}
        onToggleVisibility={() => setShowGadgetPalette(!showGadgetPalette)}
        onGadgetPlace={handleGadgetPlace}
        primitives={primitives || []}
        loading={false}
        error={null}
      />
      
      {/* Properties Panel */}
      <PropertiesPanel
        selectedNodes={selectedNodes}
        selectedEdges={selectedEdges}
        nodes={nodes}
        edges={edges}
        groupId={context.groupId}
        isVisible={showPropertiesPanel}
        onToggleVisibility={() => setShowPropertiesPanel(!showPropertiesPanel)}
      />
      
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectedNodes={selectedNodes}
          selectedEdges={selectedEdges}
          nodes={nodes}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}