import { useCallback, useState } from 'react'
import { ReactFlow, Background, useReactFlow, ReactFlowProvider, ConnectionMode } from '@xyflow/react'
import { useReactFlowContext } from '~/propagation-react/contexts/ReactFlowContext'
import { useNetworkState } from '~/propagation-react/contexts/NetworkState'
import { useSoundSystem } from './SoundSystem'
import { useSoundToast } from '~/hooks/useSoundToast'
import { SimpleContactNode } from './nodes/SimpleContactNode'
import { EnhancedGroupNode } from './nodes/EnhancedGroupNode'
import { SimplePropertyPanel } from './SimplePropertyPanel'
import { BreadcrumbNav } from './BreadcrumbNav'
import { ModeIndicator } from './ModeIndicator'
import { GadgetToolbar } from './GadgetToolbar'
import { FloatingActions } from './FloatingActions'
import { HelpOverlay } from './HelpOverlay'
import { URLStateSync } from './URLStateSync'
import { useModeHandlers } from './ModeHandler'
import { useModeContext } from '~/propagation-react/contexts/ModeContext'

const nodeTypes = {
  contact: SimpleContactNode,
  boundary: SimpleContactNode,
  group: EnhancedGroupNode,
}

function SimpleEditorInner() {
  const { nodes, edges, onNodesChange, onEdgesChange } = useReactFlowContext()
  const { addWire, updateContact, updateGroup, clearSelection, removeContact, addContact, removeWire, addGroup, state } = useNetworkState()
  const { selectedContactIds } = state
  const { playSound } = useSoundSystem()
  const toast = useSoundToast()
  const { screenToFlowPosition } = useReactFlow()
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  
  // Track mouse position in flow coordinates
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const flowPosition = screenToFlowPosition({ 
      x: event.clientX, 
      y: event.clientY 
    })
    setMousePosition(flowPosition)
  }, [screenToFlowPosition])
  
  const { handleKeyDown } = useModeHandlers(mousePosition)
  
  const onConnect = useCallback((connection: any) => {
    if (connection.source && connection.target) {
      addWire(state.currentGroupId, {
        fromId: connection.source,
        toId: connection.target,
        type: 'bidirectional'
      })
      playSound('connection/create')
      toast.success('Wire created')
    }
  }, [addWire, state.currentGroupId, playSound, toast])
  
  const handleEdgesChange = useCallback((changes: any[]) => {
    // Handle edge deletions
    changes.forEach((change) => {
      if (change.type === 'remove') {
        removeWire(change.id)
        playSound('connection/delete')
      }
    })
    
    // Pass through to the original handler
    onEdgesChange(changes)
  }, [onEdgesChange, removeWire, playSound])
  
  const handleNodeDragStop = useCallback((_event: any, node: any) => {
    // Update position in state when node is dragged
    // Check if it's a group or contact based on node type
    if (node.type === 'group') {
      updateGroup(node.id, { position: node.position })
    } else {
      updateContact(node.id, { position: node.position })
    }
  }, [updateContact, updateGroup])
  
  const handleCanvasClick = useCallback(() => {
    clearSelection()
  }, [clearSelection])
  
  // Create contact when dropping edge on empty canvas
  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, connectionState: any) => {
    // Only proceed if we're dropping on empty space (not completing a connection)
    if (!connectionState?.isValid && connectionState?.fromNode && event instanceof MouseEvent) {
      const target = event.target as HTMLElement
      
      // Check if we're over the canvas (not a node)
      if (target.closest('.react-flow__pane')) {
        const position = screenToFlowPosition({ 
          x: event.clientX,
          y: event.clientY
        })
        
        // Create a new contact at the drop position
        const newContactId = addContact(state.currentGroupId, {
          content: '',
          blendMode: 'accept-last',
          position,
          isBoundary: false
        })
        
        // Create wire from source to new contact
        if (newContactId) {
          addWire(state.currentGroupId, {
            fromId: connectionState.fromNode.id,
            toId: newContactId,
            type: 'bidirectional'
          })
          playSound('connection/create')
          toast.success('Contact created and connected')
        }
      }
    }
  }, [addContact, addWire, state.currentGroupId, playSound, toast, screenToFlowPosition])
  
  // Use the keyboard handler from the hook
  const handleReactFlowKeyDown = useCallback((event: React.KeyboardEvent) => {
    handleKeyDown(event)
  }, [handleKeyDown])
  
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <BreadcrumbNav />
        <ModeIndicator />
        <GadgetToolbar />
        <FloatingActions />
        <HelpOverlay />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onKeyDown={handleReactFlowKeyDown}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Strict}
          connectionLineStyle={{ stroke: '#888', strokeWidth: 2 }}
          fitView
          deleteKeyCode={null} // Disable React Flow's default delete handling
        >
          <Background />
        </ReactFlow>
      </div>
      <SimplePropertyPanel />
    </div>
  )
}

export function SimpleEditor() {
  return (
    <ReactFlowProvider>
      <URLStateSync />
      <SimpleEditorInner />
    </ReactFlowProvider>
  )
}