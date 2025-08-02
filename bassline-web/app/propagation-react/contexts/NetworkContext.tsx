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
}

export function NetworkProvider({ children, initialNetwork }: NetworkProviderProps) {
  // Create the core network
  const [network] = useState(() => initialNetwork || new PropagationNetwork())
  const [currentGroupId, setCurrentGroupId] = useState(network.currentGroup.id)
  
  // React Flow state
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  
  // Selection state
  const [selection, setSelection] = useState<Selection>(createEmptySelection())
  
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
      selected: selection.contacts.has(contact.id),
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
        selected: selection.groups.has(group.id),
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
      
      return {
        id: wire.id,
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle,
        targetHandle,
        hidden: !appSettings.visual.showEdges,
        style: { 
          stroke: wire.type === 'directed' ? '#555' : '#888',
          strokeWidth: 2,
          opacity: appSettings.visual.edgeOpacity
        },
        markerEnd: { type: MarkerType.ArrowClosed },
        markerStart: wire.type === 'bidirectional' ? { type: MarkerType.ArrowClosed } : undefined
      }
    })
    
    setNodes(newNodes)
    setEdges(newEdges)
  }, [network, currentGroupId, appSettings.visual.showEdges, appSettings.visual.edgeOpacity, selection])
  
  // Initialize with example data
  useEffect(() => {
    // Only initialize if the network is empty
    if (network.rootGroup.contacts.size === 0 && network.rootGroup.subgroups.size === 0) {
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
      
      syncToReactFlow()
    }
  }, []) // Only run once on mount
  
  // Re-sync when current group changes
  useEffect(() => {
    syncToReactFlow()
  }, [currentGroupId])
  
  // Re-sync when visual settings change
  useEffect(() => {
    syncToReactFlow()
  }, [appSettings.visual.showEdges, appSettings.visual.edgeOpacity, syncToReactFlow])
  
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