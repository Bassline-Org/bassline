import { useCallback, useState, useEffect } from 'react'
import { ReactFlow, 
  Background, 
  Controls, 
  MiniMap,
  Panel,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { usePropagationNetwork } from '~/propagation-react/hooks/usePropagationNetwork'
import { usePalette } from '~/propagation-react/hooks/usePalette'
import { useProximityConnect } from '~/propagation-react/hooks/useProximityConnect'
import { ContactNode } from '~/components/nodes/ContactNode'
import { GroupNode } from '~/components/nodes/GroupNode'
import { Button } from '~/components/ui/button'
import { Breadcrumbs } from '~/components/Breadcrumbs'
import { GadgetPalette } from '~/components/palette/GadgetPalette'
import { QuickAddMenu } from '~/components/QuickAddMenu'
import { ClientOnly } from '~/components/ClientOnly'
import type { GadgetTemplate } from '~/propagation-core/types/template'
import type { Position } from '~/propagation-core'

const nodeTypes = {
  contact: ContactNode,
  boundary: ContactNode, // Same component, different data
  group: GroupNode
}

function Flow() {
  const { screenToFlowPosition } = useReactFlow()
  
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
    convertToBoundary,
    saveAsTemplate,
    instantiateTemplate
  } = usePropagationNetwork()
  
  const palette = usePalette()
  
  // Proximity connect hook
  const proximity = useProximityConnect(nodes, edges)
  
  // Quick add menu state
  const [quickAddMenuPosition, setQuickAddMenuPosition] = useState<Position | null>(null)
  
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
  
  const handleAddGadgetAtPosition = useCallback((position: Position) => {
    const name = prompt('Enter gadget name:')
    if (name) {
      const gadget = createGroup(name)
      gadget.position = position
    }
  }, [createGroup])
  
  const handleExtractToGadget = useCallback(() => {
    const name = prompt('Enter name for new gadget:')
    if (name) {
      const success = extractToGadget(name)
      if (success) {
        // Find the newly created gadget
        const newGadget = Array.from(network.currentGroup.subgroups.values())
          .find(g => g.name === name)
        
        if (newGadget) {
          const template = saveAsTemplate(newGadget.id)
          if (template) {
            palette.addToPalette(template)
          }
        }
      }
    }
  }, [extractToGadget, network, saveAsTemplate, palette])
  
  const handleInlineGadget = useCallback((gadgetId: string) => {
    if (confirm('Inline this gadget? This will expand its contents into the current group.')) {
      inlineGadget(gadgetId)
    }
  }, [inlineGadget])
  
  const handleConvertToBoundary = useCallback(() => {
    convertToBoundary()
  }, [convertToBoundary])
  
  const breadcrumbs = getBreadcrumbs()
  
  // Debug: keyboard shortcut to toggle palette
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + P to toggle palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        palette.toggleVisibility()
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [palette])
  
  // Handle node drag with proximity connect
  const handleNodeDrag = useCallback((event: any, node: any) => {
    proximity.onNodeDrag(event, node)
  }, [proximity])
  
  const handleNodeDragStop = useCallback((event: any, node: any) => {
    const connection = proximity.onNodeDragStop(event, node)
    if (connection) {
      network.connect(connection.source, connection.target)
    }
  }, [proximity, network])
  
  // Handle edge drop - show quick add menu
  const handleConnectEnd = useCallback((event: any, connectionState: any) => {
    // Only show menu if connection is not valid (dropped on empty space)
    if (!connectionState?.isValid) {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      })
      setQuickAddMenuPosition(position)
    }
  }, [screenToFlowPosition])
  
  // Handle drag over for palette items
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])
  
  // Handle drop from palette
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    
    const paletteItemId = event.dataTransfer.getData('gadgetPaletteItem')
    if (!paletteItemId) return
    
    const paletteItem = palette.items.find(item => item.id === paletteItemId)
    if (!paletteItem) return
    
    // Get the drop position in flow coordinates
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    })
    
    // Instantiate the template at the drop position
    instantiateTemplate(paletteItem, position)
    palette.incrementUsageCount(paletteItemId)
  }, [palette, instantiateTemplate])
  
  // Combine edges with potential proximity edge
  const displayEdges = proximity.potentialEdge 
    ? [...edges, proximity.potentialEdge]
    : edges
  
  return (
    <div className="w-full h-screen" onDrop={handleDrop} onDragOver={handleDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={handleConnectEnd}
        onSelectionChange={onSelectionChange}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
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
                <>
                  <Button 
                    onClick={() => handleInlineGadget(Array.from(selection.groups)[0])} 
                    size="sm" 
                    variant="secondary"
                  >
                    Inline Gadget
                  </Button>
                  <Button 
                    onClick={() => {
                      const gadgetId = Array.from(selection.groups)[0]
                      const template = saveAsTemplate(gadgetId)
                      if (template) {
                        palette.addToPalette(template)
                      }
                    }} 
                    size="sm" 
                    variant="outline"
                  >
                    Add to Palette
                  </Button>
                </>
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
            <div>Ctrl/Cmd + P to toggle palette</div>
          </div>
          <ClientOnly>
            {/* Debug button */}
            <Button 
              onClick={() => {
                localStorage.removeItem('bassline-gadget-palette')
                window.location.reload()
              }}
              size="sm"
              variant="outline"
              className="mt-2"
            >
              Reset Palette Storage
            </Button>
          </ClientOnly>
        </Panel>
      </ReactFlow>
      
      <ClientOnly>
        <GadgetPalette
          items={palette.items}
          categories={palette.categories}
          isVisible={palette.isVisible}
          onToggleVisibility={palette.toggleVisibility}
          onRemoveItem={palette.removeFromPalette}
          onUseItem={palette.incrementUsageCount}
          getItemsByCategory={palette.getItemsByCategory}
          getMostUsed={palette.getMostUsed}
          getRecent={palette.getRecent}
        />
      </ClientOnly>
      
      {quickAddMenuPosition && (
        <QuickAddMenu
          position={quickAddMenuPosition}
          onAddContact={(pos) => addContact(pos)}
          onAddBoundaryContact={(pos, dir) => addBoundaryContact(pos, dir)}
          onAddGadget={handleAddGadgetAtPosition}
          onClose={() => setQuickAddMenuPosition(null)}
        />
      )}
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