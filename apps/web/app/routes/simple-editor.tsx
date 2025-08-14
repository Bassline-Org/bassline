/**
 * Simple Editor - Network-driven UI with micro-bassline
 */

import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useNetworkBridge } from '~/hooks/useNetworkBridge'
import { ContactNode } from '~/components/ContactNode'
import { useState, useMemo } from 'react'

const nodeTypes = {
  contact: ContactNode
}

export default function SimpleEditor() {
  const { structure, dynamics, isReady, sendAction, ping } = useNetworkBridge()
  const [nodeId, setNodeId] = useState(1)
  
  // Convert structure to React Flow nodes
  const nodes = useMemo(() => {
    if (!structure?.contacts) return []
    
    return Array.from(structure.contacts.entries()).map(([id, contact], index) => ({
      id,
      type: 'contact',
      position: { 
        x: 100 + (index % 4) * 200, 
        y: 100 + Math.floor(index / 4) * 150 
      },
      data: { 
        contact,
        contactId: id.split(':')[1], // Extract local ID
        groupId: id.split(':')[0],   // Extract group ID
        sendAction 
      }
    }))
  }, [structure, sendAction])
  
  // Convert wires to edges
  const edges = useMemo(() => {
    if (!structure?.wires) return []
    
    return Array.from(structure.wires.entries()).map(([id, wire]) => ({
      id,
      source: wire.fromId,
      target: wire.toId,
      type: wire.properties?.bidirectional === false ? 'straight' : 'default'
    }))
  }, [structure])
  
  // Handle creating new contact
  const handleAddContact = () => {
    const contactName = `contact-${nodeId}`
    setNodeId(nodeId + 1)
    
    // Send create action to network
    sendAction(['createContact', contactName, 'app', { blendMode: 'merge' }])
  }
  
  // Handle creating a wire between contacts
  const handleConnect = (params: any) => {
    const wireId = `wire-${Date.now()}`
    sendAction(['createWire', wireId, params.source, params.target, { bidirectional: true }])
  }
  
  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Initializing network...</div>
      </div>
    )
  }
  
  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="bg-gray-100 border-b p-4 flex gap-4 items-center">
        <button
          onClick={handleAddContact}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Contact
        </button>
        
        <button
          onClick={() => ping()}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Ping Worker
        </button>
        
        <div className="ml-auto text-sm text-gray-600">
          Contacts: {structure?.contacts?.size || 0} | 
          Wires: {structure?.wires?.size || 0} |
          Events: {dynamics.length}
        </div>
      </div>
      
      {/* React Flow Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onConnect={handleConnect}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      
      {/* Debug Panel */}
      <div className="bg-gray-100 border-t p-4 max-h-48 overflow-y-auto">
        <div className="text-sm font-mono">
          <div className="font-bold mb-2">Recent Dynamics:</div>
          {dynamics.slice(-5).map((event, i) => (
            <div key={i} className="text-xs text-gray-600">
              {JSON.stringify(event)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}