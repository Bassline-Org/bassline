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

// Custom node types
const nodeTypes = {
  contact: StyledContactNode,
  group: StyledGroupNode
}

// Store node positions globally per group to preserve them across reloads
const nodePositionCache = new Map<string, Map<string, { x: number, y: number }>>()

// Load initial state from network for this specific group
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  console.log('[GroupEditor] Loading state for group:', params.groupId)
  
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
  
  // Load primitives for gadget palette
  let primitives = []
  try {
    primitives = await client.listPrimitiveInfo?.() || []
  } catch (e) {
    console.warn('[GroupEditor] Could not load primitives:', e)
  }
  
  try {
    const state = await client.getState(groupId)
    console.log('[GroupEditor] Loaded state for group:', groupId, state)
    
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
        } catch (e) {
          console.warn(`[GroupEditor] Could not load subgroup ${subgroupId}`)
        }
        
        // Use cached position for groups too
        const position = positionCache.get(subgroupId) || { 
          x: 300 + nodes.length * 150, 
          y: 300 
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
            inputContacts: [],  // TODO: Extract boundary contacts
            outputContacts: []  // TODO: Extract boundary contacts
          }
        })
      }
    }
    
    // Map wires to edges
    const edges: Edge[] = []
    if (state.wires instanceof Map) {
      state.wires.forEach((wire, id) => {
        edges.push({
          id,
          source: wire.fromId,
          target: wire.toId,
          type: wire.type === 'directed' ? 'straight' : 'default'
        })
      })
    }
    
    return { nodes, edges, primitives }
  } catch (error) {
    console.error('[GroupEditor] Error loading state:', error)
    return { nodes: [], edges: [], primitives }
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
  
  console.log('[GroupEditor] Action:', intent, 'for group:', groupId)
  
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
      const gadgetId = await client.createPrimitiveGadget(groupId, qualifiedName)
      // Cache the position for this new gadget
      const positionCache = nodePositionCache.get(groupId)
      if (positionCache) {
        positionCache.set(gadgetId, position)
      }
      return { success: true, gadgetId }
    }
    
    case 'delete-node': {
      const nodeId = formData.get('nodeId') as string
      // Check if it's a contact or a group
      const state = await client.getState(groupId)
      if (state.contacts.has(nodeId)) {
        await client.removeContact(nodeId)
      } else if (state.group.subgroupIds.includes(nodeId)) {
        // TODO: Implement removeGroup in client
        console.warn('[GroupEditor] Group deletion not yet implemented')
      }
      return { success: true }
    }
    
    case 'delete-edge': {
      const edgeId = formData.get('edgeId') as string
      await client.removeWire(edgeId)
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
  const revalidator = useRevalidator()
  const fetcher = useFetcher()
  const navigate = useNavigate()
  
  console.log('[GroupEditor] Rendering for group:', context.groupId, 'with', nodes.length, 'nodes and', edges.length, 'edges')
  
  // Get client from context
  const client = context.client || (window as any).__BASSLINE_SESSIONS__?.get(context.sessionId)?.client
  
  // Subscribe to network changes for this group
  useEffect(() => {
    if (!client || !context.groupId) return
    
    console.log('[GroupEditor] Setting up subscription for group:', context.groupId)
    const unsubscribe = client.subscribe(context.groupId, (changes: any[]) => {
      console.log('[GroupEditor] Network changes detected in group:', context.groupId, changes.length, 'changes')
      // Revalidate to get fresh data
      revalidator.revalidate()
    })
    
    return () => {
      console.log('[GroupEditor] Cleaning up subscription for group:', context.groupId)
      unsubscribe()
    }
  }, [client, context.groupId, revalidator])
  
  // Update local state when loader data changes, but preserve positions
  useEffect(() => {
    console.log('[GroupEditor] Loader data changed, merging with existing positions')
    setNodes(currentNodes => {
      // Create a map of current node positions
      const positionMap = new Map(currentNodes.map(n => [n.id, n.position]))
      
      // Update nodes with new data but keep positions
      return initialNodes.map(node => ({
        ...node,
        position: positionMap.get(node.id) || node.position
      }))
    })
    setEdges(initialEdges)
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
    console.log('[GroupEditor] Creating connection:', params)
    fetcher.submit(
      {
        intent: 'connect',
        source: params.source!,
        target: params.target!
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
          nodeId: node.id
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
      console.log('[GroupEditor] Navigating into group:', groupId)
      navigate(`/flow/session/${context.sessionId}/group/${groupId}`)
    }
  }, [navigate, context.sessionId])
  
  // Handle gadget placement
  const handleGadgetPlace = useCallback((qualifiedName: string, position: { x: number, y: number }) => {
    console.log('[GroupEditor] Placing gadget:', qualifiedName, 'at', position)
    fetcher.submit(
      {
        intent: 'add-gadget',
        qualifiedName,
        position: JSON.stringify(position)
      },
      { method: 'post' }
    )
  }, [fetcher])
  
  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
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
    </div>
  )
}