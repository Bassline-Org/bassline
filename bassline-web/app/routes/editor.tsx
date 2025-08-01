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
import { GroupNode } from '~/components/nodes/GroupNode'
import { Button } from '~/components/ui/button'
import { Breadcrumbs } from '~/components/Breadcrumbs'

const nodeTypes = {
  contact: ContactNode,
  boundary: ContactNode, // Same component, different data
  group: GroupNode
}

function Flow() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    addContact,
    addBoundaryContact,
    createGroup,
    navigateToGroup,
    navigateToParent,
    getBreadcrumbs,
    network,
    selection,
    hasSelection,
    extractToGadget,
    inlineGadget,
    convertToBoundary
  } = usePropagationNetwork()
  
  const handleAddContact = useCallback(() => {
    const position = { 
      x: Math.random() * 400 + 100, 
      y: Math.random() * 300 + 100 
    }
    addContact(position)
  }, [addContact])
  
  const handleAddInputBoundary = useCallback(() => {
    const position = { 
      x: 50, 
      y: Math.random() * 300 + 100 
    }
    addBoundaryContact(position, 'input')
  }, [addBoundaryContact])
  
  const handleAddOutputBoundary = useCallback(() => {
    const position = { 
      x: 550, 
      y: Math.random() * 300 + 100 
    }
    addBoundaryContact(position, 'output')
  }, [addBoundaryContact])
  
  const handleAddGroup = useCallback(() => {
    const name = prompt('Enter gadget name:')
    if (name) {
      createGroup(name)
    }
  }, [createGroup])
  
  const handleExtractToGadget = useCallback(() => {
    const name = prompt('Enter name for new gadget:')
    if (name) {
      extractToGadget(name)
    }
  }, [extractToGadget])
  
  const handleInlineGadget = useCallback((gadgetId: string) => {
    if (confirm('Inline this gadget? This will expand its contents into the current group.')) {
      inlineGadget(gadgetId)
    }
  }, [inlineGadget])
  
  const handleConvertToBoundary = useCallback(() => {
    convertToBoundary()
  }, [convertToBoundary])
  
  const breadcrumbs = getBreadcrumbs()
  
  return (
    <div className="w-full h-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        deleteKeyCode={['Delete', 'Backspace']}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
        
        <Panel position="top-left" className="flex flex-col gap-2">
          <Breadcrumbs items={breadcrumbs} onNavigate={navigateToGroup} />
          <div className="flex gap-2">
            <Button onClick={handleAddContact} size="sm">
              Add Contact
            </Button>
            <Button onClick={handleAddInputBoundary} size="sm" variant="outline">
              Add Input Boundary
            </Button>
            <Button onClick={handleAddOutputBoundary} size="sm" variant="outline">
              Add Output Boundary
            </Button>
            <Button onClick={handleAddGroup} size="sm" variant="secondary">
              Add Gadget
            </Button>
          </div>
          {hasSelection && (
            <div className="flex gap-2">
              {(selection.contacts.size > 0 || selection.groups.size > 0) && (
                <Button onClick={handleExtractToGadget} size="sm" variant="default">
                  Extract to Gadget ({selection.contacts.size} contacts{selection.groups.size > 0 ? `, ${selection.groups.size} gadgets` : ''})
                </Button>
              )}
              {selection.groups.size === 1 && (
                <Button 
                  onClick={() => handleInlineGadget(Array.from(selection.groups)[0])} 
                  size="sm" 
                  variant="secondary"
                >
                  Inline Gadget
                </Button>
              )}
              {selection.contacts.size > 0 && selection.groups.size === 0 && (
                <Button 
                  onClick={handleConvertToBoundary} 
                  size="sm" 
                  variant="outline"
                >
                  Convert to Boundary ({selection.contacts.size} contacts)
                </Button>
              )}
            </div>
          )}
          <div className="text-xs text-gray-600 bg-white/80 p-2 rounded">
            <div>Double-click gadget to navigate inside</div>
            <div>Double-click node to edit content</div>
            <div>Select nodes → "Extract to Gadget"</div>
            <div>Select gadget → "Inline Gadget"</div>
            <div>Select contacts → "Convert to Boundary"</div>
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