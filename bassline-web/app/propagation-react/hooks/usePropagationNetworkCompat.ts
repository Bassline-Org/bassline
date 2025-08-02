import { useCallback } from 'react'
import { 
  type Connection, 
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges
} from '@xyflow/react'
import type { Position } from '../../propagation-core'
import { useNetworkContext } from '../contexts/NetworkContext'
import { useContactSelection } from './useContactSelection'
import { useCurrentGroup } from './useCurrentGroup'
import { usePalette } from './usePalette'
import type { GadgetTemplate } from '../../propagation-core/types/template'

interface UsePropagationNetworkOptions {
  onContactDoubleClick?: (contactId: string) => void
}

/**
 * Compatibility hook that provides the same interface as the old usePropagationNetwork
 * but uses the new context and hooks under the hood.
 */
export function usePropagationNetwork(options: UsePropagationNetworkOptions = {}) {
  const { onContactDoubleClick } = options
  const { network, syncToReactFlow, nodes, edges, setNodes, setEdges } = useNetworkContext()
  const {
    selection,
    hasSelection,
    updateSelection,
    clearSelection,
    extractSelected,
    inlineSelectedGadget,
    convertSelectedToBoundary
  } = useContactSelection()
  const {
    currentGroup,
    breadcrumbs,
    navigateToGroup,
    navigateToParent,
    addContact,
    addBoundaryContact,
    createSubgroup,
    connect
  } = useCurrentGroup()
  const palette = usePalette()
  
  // Handle selection changes
  const onSelectionChange = useCallback(({ nodes, edges }: { nodes: any[], edges: any[] }) => {
    updateSelection(nodes, edges)
  }, [updateSelection])
  
  // Handle node changes (position updates and deletions)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // Apply changes to React Flow state
    setNodes(nds => applyNodeChanges(changes, nds))
    
    // Handle changes in core network
    changes.forEach(change => {
      if (change.type === 'position' && change.position) {
        // Check if it's a contact or a group
        const contact = network.findContact(change.id)
        if (contact) {
          contact.position = change.position
        } else {
          // Check if it's a group
          const group = network.findGroup(change.id)
          if (group) {
            group.position = change.position
          }
        }
      } else if (change.type === 'remove') {
        // Try to remove as contact first
        const removed = network.removeContact(change.id)
        if (!removed) {
          // If not a contact, try to remove as a group
          network.removeGroup(change.id)
        }
        // Sync to update edges that might have been removed
        syncToReactFlow()
      }
    })
  }, [network, syncToReactFlow, setNodes])
  
  // Handle edge changes
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds))
    
    // Handle edge deletions in core network
    changes.forEach(change => {
      if (change.type === 'remove') {
        currentGroup.removeWire(change.id)
      }
    })
    
    // Sync after processing changes to ensure UI reflects the updated state
    if (changes.some(change => change.type === 'remove')) {
      syncToReactFlow()
    }
  }, [currentGroup, syncToReactFlow, setEdges])
  
  // Handle new connections
  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) {
      // Handle connections involving group nodes (which use handle IDs for boundary contacts)
      let sourceId = connection.source
      let targetId = connection.target
      
      // If source is a group node with a handle, use the handle ID (which is the boundary contact ID)
      if (connection.sourceHandle) {
        sourceId = connection.sourceHandle
      }
      
      // If target is a group node with a handle, use the handle ID (which is the boundary contact ID)
      if (connection.targetHandle) {
        targetId = connection.targetHandle
      }
      
      connect(sourceId, targetId)
    }
  }, [connect])
  
  // Refactoring operations wrapped for compatibility
  const extractToGadget = useCallback((gadgetName: string) => {
    const newGadget = extractSelected(gadgetName)
    return newGadget !== null
  }, [extractSelected])
  
  const inlineGadget = useCallback((gadgetId: string) => {
    return inlineSelectedGadget()
  }, [inlineSelectedGadget])
  
  const convertToBoundary = useCallback(() => {
    return convertSelectedToBoundary()
  }, [convertSelectedToBoundary])
  
  // Gadget template methods
  const saveAsTemplate = useCallback((groupId: string): GadgetTemplate | null => {
    const group = network.findGroup(groupId)
    if (!group) return null
    
    return group.toTemplate()
  }, [network])
  
  const instantiateTemplate = useCallback((template: GadgetTemplate, position: Position) => {
    const gadget = network.instantiateTemplate(template, position)
    syncToReactFlow()
    return gadget
  }, [network, syncToReactFlow])
  
  return {
    // React Flow props
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    
    // API methods
    addContact,
    addBoundaryContact,
    createGroup: createSubgroup,
    updateContent: () => {}, // No longer needed, components use hooks
    connect,
    
    // Direct access to network
    network,
    
    // Navigation
    navigateToGroup,
    navigateToParent,
    getBreadcrumbs: () => breadcrumbs,
    currentGroupId: currentGroup.id,
    
    // Selection and refactoring
    selection,
    hasSelection,
    extractToGadget,
    inlineGadget,
    convertToBoundary,
    
    // Templates
    saveAsTemplate,
    instantiateTemplate
  }
}