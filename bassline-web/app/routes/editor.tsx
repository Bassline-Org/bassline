import { useCallback, useState, useEffect, useRef } from 'react'
import { ReactFlow, 
  Background, 
  Controls, 
  MiniMap,
  Panel,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toast } from 'sonner'

import { usePropagationNetwork } from '~/propagation-react/hooks/usePropagationNetwork'
import { usePalette } from '~/propagation-react/hooks/usePalette'
import { useProximityConnect } from '~/propagation-react/hooks/useProximityConnect'
import { useViewSettings } from '~/propagation-react/hooks/useViewSettings'
import { ContactNode } from '~/components/nodes/ContactNode'
import { GroupNode } from '~/components/nodes/GroupNode'
import { Button } from '~/components/ui/button'
import { Breadcrumbs } from '~/components/Breadcrumbs'
import { GadgetPalette } from '~/components/palette/GadgetPalette'
import { QuickAddMenu } from '~/components/QuickAddMenu'
import { ToolsMenu } from '~/components/ToolsMenu'
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
    connect,
    selection,
    hasSelection,
    extractToGadget,
    inlineGadget,
    convertToBoundary,
    saveAsTemplate,
    instantiateTemplate
  } = usePropagationNetwork()
  
  const palette = usePalette()
  const { viewSettings, setViewSettings } = useViewSettings()
  
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
    if (viewSettings.showShortcutHints) {
      toast.success('Contact added! Tip: Press A for quick add', {
        duration: 4000,
      })
    }
  }, [addContact, viewSettings])
  
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
      if (viewSettings.showShortcutHints) {
        toast.success('Gadget created! Tip: Press S for quick add', {
          duration: 4000,
        })
      }
    }
  }, [createGroup, viewSettings])
  
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
            if (viewSettings.showShortcutHints) {
              toast.success(`"${name}" added to palette! Press Q to view.`)
            }
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
  const hasShownWelcome = useRef(false)
  
  // Show welcome toast on mount (if hints are enabled)
  useEffect(() => {
    if (viewSettings.showShortcutHints && !hasShownWelcome.current) {
      hasShownWelcome.current = true
      toast('Welcome! Press W to see keyboard shortcuts', {
        duration: 5000,
      })
    }
  }, [viewSettings.showShortcutHints])
  
  // Keyboard shortcuts (left-hand friendly)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Tab + P to toggle palette (left hand: Tab with thumb, P with pinky)
      if (e.key === 'Tab') {
        e.preventDefault() // Prevent default tab behavior
      }
      
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'q') {
        e.preventDefault()
        palette.toggleVisibility()
      }
      
      // W to toggle instructions (left hand: W with ring finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'w') {
        e.preventDefault()
        setViewSettings({
          ...viewSettings,
          showInstructions: !viewSettings.showInstructions
        })
      }
      
      // E to toggle minimap (left hand: E with middle finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'e') {
        e.preventDefault()
        setViewSettings({
          ...viewSettings,
          showMiniMap: !viewSettings.showMiniMap
        })
      }
      
      // A to add contact (left hand: A with pinky)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'a') {
        e.preventDefault()
        const position = { 
          x: Math.random() * 400 + 100, 
          y: Math.random() * 300 + 100 
        }
        addContact(position)
      }
      
      // S to add gadget (left hand: S with ring finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 's') {
        e.preventDefault()
        handleAddGroup()
      }
      
      // D to toggle grid (left hand: D with middle finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'd') {
        e.preventDefault()
        setViewSettings({
          ...viewSettings,
          showGrid: !viewSettings.showGrid
        })
      }
      
      // R to reset palette (for debugging)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'r') {
        e.preventDefault()
        palette.resetToDefaults()
        if (viewSettings.showShortcutHints) {
          toast.success('Reset palette to default gadgets')
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [palette, viewSettings, setViewSettings, addContact, handleAddGroup, toast])
  
  // Handle node drag with proximity connect
  const handleNodeDrag = useCallback((event: any, node: any) => {
    proximity.onNodeDrag(event, node)
  }, [proximity])
  
  const handleNodeDragStop = useCallback((event: any, node: any) => {
    const connection = proximity.onNodeDragStop(event, node)
    if (connection) {
      connect(connection.source, connection.target)
    }
  }, [proximity, connect])
  
  // Handle edge drop - show quick add menu
  const handleConnectEnd = useCallback((event: any, connectionState: any) => {
    // Only show menu if connection is not valid (dropped on empty space)
    if (!connectionState?.isValid && connectionState?.fromNode) {
      // Store the screen position for the menu (not flow position)
      const screenPos = {
        x: event.clientX,
        y: event.clientY
      }
      // But also store the flow position for creating nodes
      const flowPos = screenToFlowPosition(screenPos)
      setQuickAddMenuPosition({ 
        screenX: screenPos.x, 
        screenY: screenPos.y,
        flowX: flowPos.x,
        flowY: flowPos.y,
        fromNodeId: connectionState.fromNode.id,
        fromHandleId: connectionState.fromHandle?.id,
        fromHandleType: connectionState.fromHandle?.type || 'source'
      } as any)
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
    toast.success(`Placed "${paletteItem.name}" gadget`)
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
        {viewSettings.showGrid && <Background />}
        <Controls />
        {viewSettings.showMiniMap && <MiniMap />}
        
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
                      const gadget = network.findGroup(gadgetId)
                      const template = saveAsTemplate(gadgetId)
                      if (template) {
                        palette.addToPalette(template)
                        toast.success(`"${gadget?.name || 'Gadget'}" added to palette`)
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
          {viewSettings.showInstructions && (
            <div className="text-xs text-gray-600 bg-white/80 p-2 rounded">
              <div className="font-semibold mb-1">Controls:</div>
              <div>Double-click gadget → Navigate inside</div>
              <div>Double-click node → Edit content</div>
              <div>Select & Extract → Create gadget</div>
              <div>Delete/Backspace → Remove items</div>
              <div className="font-semibold mt-2 mb-1">Left-hand shortcuts:</div>
              <div>Q → Toggle palette</div>
              <div>W → Toggle instructions (this)</div>
              <div>E → Toggle minimap</div>
              <div>A → Add contact</div>
              <div>S → Add gadget</div>
              <div>D → Toggle grid</div>
            </div>
          )}
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
        
        <Panel position="bottom-center" className="mb-2">
          <ClientOnly>
            <ToolsMenu 
              viewSettings={viewSettings}
              onViewSettingsChange={setViewSettings}
            />
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
          position={{ x: quickAddMenuPosition.screenX, y: quickAddMenuPosition.screenY }}
          onAddContact={() => {
            const newContact = addContact({ x: quickAddMenuPosition.flowX, y: quickAddMenuPosition.flowY })
            if (newContact) {
              // Use handle ID if dragging from a gadget, otherwise use node ID
              const sourceId = quickAddMenuPosition.fromHandleId || quickAddMenuPosition.fromNodeId
              // Connect based on the handle type
              if (quickAddMenuPosition.fromHandleType === 'source') {
                connect(sourceId, newContact.id)
              } else {
                connect(newContact.id, sourceId)
              }
            }
          }}
          onAddBoundaryContact={(_, dir) => {
            const newContact = addBoundaryContact({ x: quickAddMenuPosition.flowX, y: quickAddMenuPosition.flowY }, dir)
            if (newContact) {
              // Use handle ID if dragging from a gadget, otherwise use node ID
              const sourceId = quickAddMenuPosition.fromHandleId || quickAddMenuPosition.fromNodeId
              // Connect based on the handle type
              if (quickAddMenuPosition.fromHandleType === 'source') {
                connect(sourceId, newContact.id)
              } else {
                connect(newContact.id, sourceId)
              }
            }
          }}
          onAddGadget={() => {
            const newGadget = handleAddGadgetAtPosition({ x: quickAddMenuPosition.flowX, y: quickAddMenuPosition.flowY })
            // For gadgets, we'd need to know which boundary contact to connect to
            // This is more complex, so leaving unconnected for now
          }}
          onClose={() => setQuickAddMenuPosition(null)}
        />
      )}
    </div>
  )
}

export default function Editor() {
  return (
    <ReactFlowProvider>
      <ClientOnly>
        <Flow />
      </ClientOnly>
    </ReactFlowProvider>
  )
}