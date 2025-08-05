import { useCallback, useMemo, useEffect } from 'react'
import { ReactFlow, Background, ConnectionMode, useNodesState, useEdgesState, type Node, type Edge, type Connection } from '@xyflow/react'
import { useSubmit } from 'react-router'
import { DemoContactNode } from './DemoContactNode'
import type { GroupState } from '~/propagation-core-v2/types'

const nodeTypes = {
  demoContact: DemoContactNode,
}

interface SimpleNetworkFlowProps {
  groupState: GroupState
  groupId: string
}

export function SimpleNetworkFlow({ groupState, groupId }: SimpleNetworkFlowProps) {
  const submit = useSubmit()
  
  console.log('SimpleNetworkFlow rendering with:', {
    groupId,
    contacts: groupState.contacts.size,
    wires: groupState.wires.size,
    contactsArray: Array.from(groupState.contacts.values())
  })
  
  // Convert contacts to React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    const contacts = Array.from(groupState.contacts.values())
    console.log('Creating nodes from contacts:', contacts)
    const nodes = contacts.map((contact, index) => ({
      id: contact.id,
      type: 'demoContact',
      position: { 
        x: 100 + (index % 3) * 200, 
        y: 100 + Math.floor(index / 3) * 150 
      },
      data: {
        contact,
        groupId
      }
    }))
    console.log('Created initial nodes:', nodes)
    return nodes
  }, [groupState.contacts, groupId])
  
  // Convert wires to React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    const wires = Array.from(groupState.wires.values())
    return wires.map(wire => ({
      id: wire.id,
      source: wire.fromId,
      target: wire.toId,
      type: wire.type === 'directed' ? 'default' : 'default',
      style: wire.type === 'directed' ? {} : { strokeDasharray: '5,5' },
      animated: true
    }))
  }, [groupState.wires])
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  
  // Update nodes when groupState changes
  useEffect(() => {
    const contacts = Array.from(groupState.contacts.values())
    setNodes(currentNodes => {
      const newNodes = contacts.map((contact, index) => ({
        id: contact.id,
        type: 'demoContact',
        position: currentNodes.find(n => n.id === contact.id)?.position || { 
          x: 100 + (index % 3) * 200, 
          y: 100 + Math.floor(index / 3) * 150 
        },
        data: {
          contact,
          groupId
        }
      }))
      return newNodes
    })
  }, [groupState.contacts, groupId, setNodes])
  
  // Update edges when groupState changes
  useEffect(() => {
    const wires = Array.from(groupState.wires.values())
    const newEdges = wires.map(wire => ({
      id: wire.id,
      source: wire.fromId,
      target: wire.toId,
      type: 'default',
      style: wire.type === 'directed' ? {} : { strokeDasharray: '5,5' },
      animated: true
    }))
    setEdges(newEdges)
  }, [groupState.wires, setEdges])
  
  // Handle new connections
  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target && connection.source !== connection.target) {
      submit({
        intent: 'create-wire',
        fromId: connection.source,
        toId: connection.target,
        type: 'bidirectional',
        groupId
      }, {
        method: 'post',
        action: '/api/demo',
        navigate: false
      })
    }
  }, [submit, groupId])
  
  // Handle double-click to add contact
  const onPaneClick = useCallback((event: React.MouseEvent) => {
    // Only on double-click
    if (event.detail !== 2) return
    
    const rect = (event.target as Element).getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    submit({
      intent: 'add-contact',
      groupId,
      content: JSON.stringify(`Contact at (${Math.round(x)}, ${Math.round(y)})`),
      blendMode: 'accept-last',
      position: JSON.stringify({ x, y })
    }, {
      method: 'post',
      action: '/api/demo',
      navigate: false
    })
  }, [submit, groupId])
  
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      connectionMode={ConnectionMode.Loose}
      fitView
      className="bg-gray-50"
    >
      <Background />
      <div className="absolute top-4 left-4 bg-white p-2 rounded shadow text-sm text-gray-600">
        <div>Double-click to add contact</div>
        <div>Drag between contacts to connect</div>
        <div>Click contact content to edit</div>
      </div>
    </ReactFlow>
  )
}