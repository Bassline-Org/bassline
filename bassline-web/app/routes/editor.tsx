import { useCallback } from 'react'
import { ReactFlow, 
  Background, 
  Controls, 
  MiniMap,
  Panel,
  ReactFlowProvider
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { usePropagationNetwork } from '~/propagation-react/hooks/usePropagationNetwork'
import { ContactNode } from '~/components/nodes/ContactNode'
import { BoundaryNode } from '~/components/nodes/BoundaryNode'
import { Button } from '~/components/ui/button'

const nodeTypes = {
  contact: ContactNode,
  boundary: BoundaryNode
}

function Flow() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addContact,
    addBoundaryContact,
    createGroup
  } = usePropagationNetwork()
  
  const handleAddContact = useCallback(() => {
    const position = { 
      x: Math.random() * 400 + 100, 
      y: Math.random() * 300 + 100 
    }
    addContact(position)
  }, [addContact])
  
  const handleAddBoundary = useCallback(() => {
    const position = { 
      x: Math.random() * 400 + 100, 
      y: Math.random() * 300 + 100 
    }
    addBoundaryContact(position)
  }, [addBoundaryContact])
  
  return (
    <div className="w-full h-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        deleteKeyCode={['Delete', 'Backspace']}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
        
        <Panel position="top-left" className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button onClick={handleAddContact} size="sm">
              Add Contact
            </Button>
            <Button onClick={handleAddBoundary} size="sm" variant="outline">
              Add Boundary
            </Button>
          </div>
          <div className="text-xs text-gray-600 bg-white/80 p-2 rounded">
            <div>Double-click node to edit content</div>
            <div>Delete/Backspace to remove selected items</div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}

export default function Editor() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  )
}