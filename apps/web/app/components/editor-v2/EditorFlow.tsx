import { useCallback, useMemo, useState, useEffect } from 'react'
import { useSubmit, useNavigate } from 'react-router'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react'
import type {
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
  NodePositionChange,
} from '@xyflow/react'
import type { GroupState, Contact, Wire, Group } from '@bassline/core'
import { ContactNodeV2 } from './ContactNodeV2'
import { GroupNodeV2 } from './GroupNodeV2'
import { generateId } from '~/utils/id'
import { useNodePositions } from '~/hooks/useNodePositions'
import '@xyflow/react/dist/style.css'

const nodeTypes = {
  contact: ContactNodeV2,
  group: GroupNodeV2,
}

interface EditorFlowProps {
  groupState: GroupState
  groupId: string
}

function EditorFlowInner({ groupState, groupId }: EditorFlowProps) {
  const submit = useSubmit()
  const navigate = useNavigate()
  const reactFlowInstance = useReactFlow()
  const { getPosition, setPosition } = useNodePositions(groupId)
  
  // Convert propagation network state to React Flow nodes/edges
  const initialNodes = useMemo(() => {
    const nodes: Node[] = []
    
    // Add contact nodes
    let contactIndex = 0
    groupState.contacts.forEach((contact) => {
      // Get stored position or calculate default
      const position = getPosition(contact.id, { x: 100 + (contactIndex * 150), y: 100 })
      contactIndex++
      
      nodes.push({
        id: contact.id,
        type: 'contact',
        position,
        data: {
          contact,
          groupId,
        },
      })
    })
    
    // Add subgroup nodes
    groupState.group.subgroupIds.forEach((subgroupId, index) => {
      const position = getPosition(subgroupId, { x: 300 + (index * 200), y: 200 })
      
      nodes.push({
        id: subgroupId,
        type: 'group',
        position,
        data: {
          groupId: subgroupId,
          parentGroupId: groupId,
          name: `Group ${subgroupId}`, // TODO: Get actual group name
        },
      })
    })
    
    return nodes
  }, [groupState, groupId, getPosition])
  
  const initialEdges = useMemo(() => {
    const edges: Edge[] = []
    
    groupState.wires.forEach((wire) => {
      edges.push({
        id: wire.id,
        source: wire.fromId,
        target: wire.toId,
        type: wire.type === 'directed' ? 'default' : 'straight',
        animated: wire.type === 'directed',
        data: {
          wire,
        },
      })
    })
    
    return edges
  }, [groupState])
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [mode, setMode] = useState<'select' | 'wire' | 'add-contact' | 'add-group'>('select')
  
  // Handle node position changes
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)
    
    // Store position updates locally
    changes.forEach((change) => {
      if (change.type === 'position' && change.position && !change.dragging) {
        const positionChange = change as NodePositionChange
        setPosition(positionChange.id, positionChange.position)
      }
    })
  }, [onNodesChange, setPosition])
  
  // Handle edge connections
  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return
    
    submit({
      intent: 'create-wire',
      fromId: params.source,
      toId: params.target,
      type: 'bidirectional'
    }, {
      method: 'post',
      action: '/api/editor-v2/actions',
      navigate: false
    })
  }, [submit])
  
  // Handle node selection
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])
  
  // Handle background click based on mode
  const onPaneClick = useCallback((event: React.MouseEvent) => {
    if (mode === 'add-contact') {
      const bounds = (event.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect()
      if (!bounds) return
      
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      
      // Generate ID first so we can store position
      const tempId = generateId()
      setPosition(tempId, position)
      
      submit({
        intent: 'add-contact',
        groupId,
        content: JSON.stringify('New Contact'),
        blendMode: 'accept-last',
        tempId // Pass temp ID to action handler
      }, {
        method: 'post',
        action: '/api/editor-v2/actions',
        navigate: false
      })
      
      setMode('select')
    } else if (mode === 'add-group') {
      const bounds = (event.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect()
      if (!bounds) return
      
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      
      // Generate ID first so we can store position
      const tempId = generateId()
      setPosition(tempId, position)
      
      submit({
        intent: 'add-group',
        parentGroupId: groupId,
        name: 'New Group',
        tempId
      }, {
        method: 'post',
        action: '/api/editor-v2/actions',
        navigate: false
      })
      
      setMode('select')
    } else {
      setSelectedNode(null)
    }
  }, [mode, reactFlowInstance, submit, groupId, setPosition])
  
  // Handle edge deletion
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation()
    
    if (window.confirm('Delete this wire?')) {
      submit({
        intent: 'delete-wire',
        wireId: edge.id
      }, {
        method: 'post',
        action: '/api/editor-v2/actions',
        navigate: false
      })
    }
  }, [submit])
  
  // Handle node deletion
  const handleDeleteNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    
    if (node.type === 'contact') {
      submit({
        intent: 'delete-contact',
        contactId: nodeId
      }, {
        method: 'post',
        action: '/api/editor-v2/actions',
        navigate: false
      })
    } else if (node.type === 'group') {
      submit({
        intent: 'delete-group',
        groupId: nodeId
      }, {
        method: 'post',
        action: '/api/editor-v2/actions',
        navigate: false
      })
    }
  }, [nodes, submit])
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected node
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode) {
        handleDeleteNode(selectedNode.id)
      }
      
      // Mode shortcuts
      if (e.key === 'Escape') {
        setMode('select')
      } else if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        setMode('add-contact')
      } else if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
        setMode('add-group')
      } else if (e.key === 'w' && !e.metaKey && !e.ctrlKey) {
        setMode('wire')
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNode, handleDeleteNode])
  
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Breadcrumb navigation */}
      <div className="bg-white border-b px-4 py-2">
        <nav className="flex items-center gap-2 text-sm">
          <a href="/" className="text-gray-500 hover:text-gray-700">Home</a>
          <span className="text-gray-400">/</span>
          <span className="font-medium">{groupId}</span>
        </nav>
      </div>
      
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-50"
        >
          <Background />
          <Controls />
          <MiniMap />
          
          <Panel position="top-left" className="bg-white rounded-lg shadow-lg p-2">
            <div className="flex gap-2">
              <button
                onClick={() => setMode('select')}
                className={`px-3 py-1 rounded ${mode === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Select
              </button>
              <button
                onClick={() => setMode('wire')}
                className={`px-3 py-1 rounded ${mode === 'wire' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Wire (W)
              </button>
              <button
                onClick={() => setMode('add-contact')}
                className={`px-3 py-1 rounded ${mode === 'add-contact' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Contact (C)
              </button>
              <button
                onClick={() => setMode('add-group')}
                className={`px-3 py-1 rounded ${mode === 'add-group' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Group (G)
              </button>
            </div>
          </Panel>
          
          {/* Gadget toolbar placeholder */}
        </ReactFlow>
        
        {/* Property panel */}
        {selectedNode && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-lg p-4 overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Properties</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">ID</label>
                <div className="text-sm text-gray-600">{selectedNode.id}</div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <div className="text-sm text-gray-600">{selectedNode.type}</div>
              </div>
              {selectedNode.type === 'contact' && selectedNode.data.contact && (
                <div>
                  <label className="block text-sm font-medium mb-1">Content</label>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const formData = new FormData(e.currentTarget)
                      submit(formData, {
                        method: 'post',
                        action: '/api/editor-v2/actions',
                        navigate: false
                      })
                    }}
                  >
                    <input type="hidden" name="intent" value="update-contact" />
                    <input type="hidden" name="contactId" value={selectedNode.id} />
                    <input
                      type="text"
                      name="content"
                      defaultValue={JSON.stringify(selectedNode.data.contact.content)}
                      className="w-full px-2 py-1 border rounded"
                      onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                    />
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function EditorFlow(props: EditorFlowProps) {
  return (
    <ReactFlowProvider>
      <EditorFlowInner {...props} />
    </ReactFlowProvider>
  )
}