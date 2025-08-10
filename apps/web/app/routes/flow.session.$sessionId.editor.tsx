import { useEffect, useCallback } from 'react'
import { useOutletContext, useLoaderData, useFetcher, useRevalidator } from 'react-router'
import { 
  ReactFlow, 
  Background, 
  Controls,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge
} from '@xyflow/react'
import type { ClientLoaderFunctionArgs, ClientActionFunctionArgs } from 'react-router'
import { ContactNode } from '~/components/flow-editor/ContactNode'

// Custom node types
const nodeTypes = {
  contact: ContactNode
}

// Load initial state from network
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  console.log('[Editor] Loading state for session:', params.sessionId)
  
  // Get session from parent context would be better, but for now...
  const sessionId = params.sessionId!
  // For now, we'll access the client directly from the window
  // In production, this should come from the session manager
  const client = (window as any).__BASSLINE_SESSIONS__?.get(sessionId)?.client
  
  if (!client) {
    console.error('[Editor] No client found for session:', sessionId)
    return { nodes: [], edges: [] }
  }
  
  try {
    const state = await client.getState('root')
    console.log('[Editor] Loaded state:', state)
    
    // Simple mapping from contacts to nodes
    const nodes: Node[] = []
    if (state.contacts instanceof Map) {
      state.contacts.forEach((contact, id) => {
        nodes.push({
          id,
          type: 'contact',
          position: { x: Math.random() * 500, y: Math.random() * 500 }, // Random for now
          data: { 
            content: contact.content || '',
            blendMode: contact.blendMode
          }
        })
      })
    }
    
    // Simple mapping from wires to edges
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
    
    return { nodes, edges }
  } catch (error) {
    console.error('[Editor] Error loading state:', error)
    return { nodes: [], edges: [] }
  }
}

// Handle network mutations
export async function clientAction({ request, params }: ClientActionFunctionArgs) {
  const formData = await request.formData()
  const intent = formData.get('intent') as string
  const sessionId = params.sessionId!
  
  // Get client
  const client = (window as any).__BASSLINE_SESSIONS__?.get(sessionId)?.client
  if (!client) {
    return { error: 'No client found' }
  }
  
  console.log('[Editor] Action:', intent)
  
  switch (intent) {
    case 'connect': {
      const source = formData.get('source') as string
      const target = formData.get('target') as string
      await client.connect(source, target, 'bidirectional')
      return { success: true }
    }
    
    case 'add-contact': {
      const position = JSON.parse(formData.get('position') as string)
      const contactId = await client.addContact('root', {
        content: '',
        blendMode: 'accept-last'
      })
      // Position will be handled by React Flow
      return { success: true, contactId }
    }
    
    case 'delete-node': {
      const nodeId = formData.get('nodeId') as string
      await client.removeContact(nodeId)
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

export default function Editor() {
  const { nodes: initialNodes, edges: initialEdges } = useLoaderData<typeof clientLoader>()
  const context = useOutletContext<{ sessionId: string; client: any }>()
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const revalidator = useRevalidator()
  const fetcher = useFetcher()
  
  console.log('[Editor] Rendering with', nodes.length, 'nodes and', edges.length, 'edges')
  
  // Get client from context
  const client = context.client || (window as any).__BASSLINE_SESSIONS__?.get(context.sessionId)?.client
  
  // Subscribe to network changes
  useEffect(() => {
    if (!client) return
    
    console.log('[Editor] Setting up subscription')
    const unsubscribe = client.subscribe('root', (changes: any[]) => {
      console.log('[Editor] Network changes detected:', changes.length, 'changes')
      // Revalidate to get fresh data
      revalidator.revalidate()
    })
    
    return () => {
      console.log('[Editor] Cleaning up subscription')
      unsubscribe()
    }
  }, [client, revalidator])
  
  // Update local state when loader data changes
  useEffect(() => {
    console.log('[Editor] Loader data changed, updating nodes and edges')
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])
  
  // Handle connections
  const onConnect = useCallback((params: Connection) => {
    console.log('[Editor] Creating connection:', params)
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
  
  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
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
            fetcher.submit(
              {
                intent: 'add-contact',
                position: JSON.stringify({ x: 250, y: 250 })
              },
              { method: 'post' }
            )
          }}
        >
          Add Contact
        </button>
      </div>
    </div>
  )
}