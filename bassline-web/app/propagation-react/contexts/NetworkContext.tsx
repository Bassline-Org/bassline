import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { PropagationNetwork } from '~/propagation-core'
import type { Node, Edge } from '@xyflow/react'
import type { ContactGroup } from '~/propagation-core/models/ContactGroup'
import type { Contact } from '~/propagation-core/models/Contact'
import { PrimitiveGadget } from '~/propagation-core/primitives'
import { MarkerType } from '@xyflow/react'
import type { Selection } from '~/propagation-core/refactoring/types'
import { createEmptySelection } from '~/propagation-core/refactoring/types'
import type { AppSettings } from '~/propagation-core/types'
import { useAppSettings } from '~/propagation-react/hooks/useAppSettings'
import { getValueThickness } from '~/propagation-core/utils/value-detection'

interface NetworkContextValue {
  network: PropagationNetwork
  syncToReactFlow: () => void
  currentGroupId: string
  setCurrentGroupId: (id: string) => void
  nodes: Node[]
  edges: Edge[]
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  selection: Selection
  setSelection: React.Dispatch<React.SetStateAction<Selection>>
  highlightedNodeId: string | null
  setHighlightedNodeId: (id: string | null) => void
  appSettings: AppSettings
  updatePropagationSettings: (updates: Partial<AppSettings['propagation']>) => void
  updateVisualSettings: (updates: Partial<AppSettings['visual']>) => void
  updateBehaviorSettings: (updates: Partial<AppSettings['behavior']>) => void
  resetSettings: () => void
}

const NetworkContext = createContext<NetworkContextValue | null>(null)

export function useNetworkContext() {
  const context = useContext(NetworkContext)
  if (!context) {
    throw new Error('useNetworkContext must be used within NetworkProvider')
  }
  return context
}

interface NetworkProviderProps {
  children: ReactNode
  initialNetwork?: PropagationNetwork
  skipDefaultContent?: boolean
}

export function NetworkProvider({ children, initialNetwork, skipDefaultContent = false }: NetworkProviderProps) {
  // Create the core network
  const [network] = useState(() => initialNetwork || new PropagationNetwork())
  const [currentGroupId, setCurrentGroupId] = useState(network.currentGroup.id)
  
  // React Flow state
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  
  // Selection state
  const [selection, setSelection] = useState<Selection>(createEmptySelection())
  
  // Highlighted node for property panel focus
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  
  // App settings
  const {
    appSettings,
    updatePropagationSettings,
    updateVisualSettings,
    updateBehaviorSettings,
    resetToDefaults
  } = useAppSettings()
  
  // Sync network state to React Flow
  const syncToReactFlow = useCallback(() => {
    const currentView = network.getCurrentView()
    
    // Map contacts to nodes
    const contactNodes: Node[] = currentView.contacts.map(contact => ({
      id: contact.id,
      position: contact.position,
      type: contact.isBoundary ? 'boundary' : 'contact',
      style: {
        background: 'transparent',
        border: 'none',
        padding: 0,
        borderRadius: 0
      },
      data: {
        // ContactNode now uses the useContact hook, so we don't need to pass data
      }
    }))
    
    // Map subgroups to nodes
    const groupNodes: Node[] = currentView.subgroups.map((group, index) => {
      const boundary = group.getBoundaryContacts()
      
      // Use stored position or create new one
      const position = group.position.x === 0 && group.position.y === 0 
        ? { 
            x: 500 + (index % 2) * 250, 
            y: 100 + Math.floor(index / 2) * 200 
          }
        : group.position
      
      return {
        id: group.id,
        position,
        type: 'group',
        style: {
          background: 'transparent',
          border: 'none',
          padding: 0,
          borderRadius: 0,
          width: 'auto'
        },
        data: {
          // GroupNode now uses the useGroup hook, so we don't need to pass data
        }
      }
    })
    
    const newNodes = [...contactNodes, ...groupNodes]
    
    // Map wires to edges
    const newEdges: Edge[] = currentView.wires.map(wire => {
      // Check if the wire connects to boundary contacts in subgroups
      let sourceNodeId = wire.fromId
      let targetNodeId = wire.toId
      let sourceHandle: string | undefined
      let targetHandle: string | undefined
      
      // Check if source is a boundary contact in a subgroup
      for (const subgroup of currentView.subgroups) {
        if (subgroup.boundaryContacts.has(wire.fromId)) {
          sourceNodeId = subgroup.id
          sourceHandle = wire.fromId
          break
        }
      }
      
      // Check if target is a boundary contact in a subgroup
      for (const subgroup of currentView.subgroups) {
        if (subgroup.boundaryContacts.has(wire.toId)) {
          targetNodeId = subgroup.id
          targetHandle = wire.toId
          break
        }
      }
      
      // Get source contact to check its value
      const sourceContact = network.findContact(wire.fromId)
      const thickness = appSettings.visual.showFatEdges && sourceContact?.content !== undefined 
        ? getValueThickness(sourceContact.content) 
        : 1
      
      // Scale stroke width based on value thickness
      const baseWidth = 2
      const strokeWidth = baseWidth + (thickness - 1) * appSettings.visual.fatEdgeScale
      
      return {
        id: wire.id,
        type: thickness > 1 ? 'fat' : undefined,
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle,
        targetHandle,
        selectable: true,
        hidden: !appSettings.visual.showEdges,
        data: { thickness },
        style: { 
          stroke: wire.type === 'directed' ? '#555' : '#888',
          strokeWidth,
          opacity: appSettings.visual.edgeOpacity
        },
        markerEnd: wire.type === 'directed' ? { type: MarkerType.ArrowClosed } : undefined,
        markerStart: undefined
      }
    })
    
    // Don't preserve selection - let context frame be the source of truth
    setNodes(newNodes)
    setEdges(newEdges)
  }, [network, currentGroupId, appSettings.visual.showEdges, appSettings.visual.edgeOpacity, appSettings.visual.showFatEdges, appSettings.visual.fatEdgeScale])
  
  // Effect 1: Initialize with example data (only on mount)
  useEffect(() => {
    // Only initialize if the network is empty and skipDefaultContent is false
    if (!skipDefaultContent && network.rootGroup.contacts.size === 0 && network.rootGroup.subgroups.size === 0) {
      const c1 = network.addContact({ x: 100, y: 100 }, appSettings.propagation.defaultBlendMode)
      const c2 = network.addContact({ x: 300, y: 100 }, appSettings.propagation.defaultBlendMode)
      network.connect(c1.id, c2.id)
      
      // Add an example gadget
      const gadget = network.createGroup('Example Gadget')
      gadget.position = { x: 600, y: 100 }
      // Switch to gadget to add internals
      const prevGroup = network.currentGroup
      network.currentGroup = gadget
      
      // Add input and output boundary contacts
      const blendMode = appSettings.propagation.defaultBoundaryBlendMode || appSettings.propagation.defaultBlendMode
      const input = network.addBoundaryContact({ x: 50, y: 100 }, 'input', 'in', blendMode)
      const output = network.addBoundaryContact({ x: 350, y: 100 }, 'output', 'out', blendMode)
      
      // Add internal contact
      const internal = network.addContact({ x: 200, y: 100 }, appSettings.propagation.defaultBlendMode)
      
      // Wire them up
      network.connect(input.id, internal.id)
      network.connect(internal.id, output.id)
      
      // Switch back
      network.currentGroup = prevGroup
      
      // Connect the gadget to the network
      network.connect(c2.id, input.id)
      network.connect(output.id, c1.id)
    }
    
    // Always sync on mount (whether we added example data or loaded from template)
    syncToReactFlow()
  }, [skipDefaultContent, network, appSettings.propagation.defaultBlendMode, appSettings.propagation.defaultBoundaryBlendMode, syncToReactFlow]) // Only run once on mount
  
  // Effect 2: Re-sync when current group changes (navigation)
  useEffect(() => {
    syncToReactFlow()
  }, [currentGroupId, syncToReactFlow])
  
  // Effect 3: Re-sync when visual settings change (edge visibility/opacity)
  useEffect(() => {
    syncToReactFlow()
  }, [appSettings.visual.showEdges, appSettings.visual.edgeOpacity, syncToReactFlow])
  
  // Effect 4: Re-sync when fat edge settings change
  useEffect(() => {
    syncToReactFlow()
  }, [appSettings.visual.showFatEdges, appSettings.visual.fatEdgeScale, syncToReactFlow])
  
  
  const value: NetworkContextValue = {
    network,
    syncToReactFlow,
    currentGroupId,
    setCurrentGroupId,
    nodes,
    edges,
    setNodes,
    setEdges,
    selection,
    setSelection,
    highlightedNodeId,
    setHighlightedNodeId,
    appSettings,
    updatePropagationSettings,
    updateVisualSettings,
    updateBehaviorSettings,
    resetSettings: resetToDefaults
  }
  
  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  )
}