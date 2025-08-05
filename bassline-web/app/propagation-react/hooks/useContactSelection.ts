import { useCallback, useMemo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { Selection } from '~/propagation-core/refactoring/types'
import { createEmptySelection } from '~/propagation-core/refactoring/types'
import { useNetworkContext } from '../contexts/NetworkContext'
import type { Contact, ContactGroup, Wire } from '~/propagation-core'
import { ExtractToGadgetOperation } from '~/propagation-core/refactoring/operations/ExtractToGadget'
import { InlineGadgetOperation } from '~/propagation-core/refactoring/operations/InlineGadget'
import { ConvertToBoundaryOperation } from '~/propagation-core/refactoring/operations/ConvertToBoundary'
import { useSound } from '~/components/SoundSystem'

interface UseContactSelectionReturn {
  // Selected entities (actual objects, not just IDs)
  selectedContacts: Contact[]
  selectedGroups: ContactGroup[]
  selectedWires: Wire[]
  
  // Selection methods
  selectContact: (contactId: string, multi?: boolean) => void
  selectGroup: (groupId: string, multi?: boolean) => void
  selectWire: (wireId: string, multi?: boolean) => void
  selectAll: () => void
  clearSelection: () => void
  
  // Selection state
  hasSelection: boolean
  selectionBounds: { x: number, y: number, width: number, height: number } | null
  
  // Bulk operations
  deleteSelected: () => void
  extractSelected: (name: string) => ContactGroup | null
  inlineSelectedGadget: () => boolean
  convertSelectedToBoundary: () => boolean
  
  // React Flow integration
  updateSelection: (nodes: Node[], edges: Edge[]) => void
  
  // Raw selection for compatibility
  selection: Selection
}

export function useContactSelection(): UseContactSelectionReturn {
  const { network, syncToReactFlow, selection, setSelection } = useNetworkContext()
  const { play: playInlineSound } = useSound('gadget/inline')
  const { play: playExtractSound } = useSound('gadget/extract')
  const { play: playBoundaryCreateSound } = useSound('ui/boundary-create')
  const { play: playBoundaryRevertSound } = useSound('ui/boundary-revert')
  
  // Get actual objects from selection IDs
  const selectedContacts = useMemo(() => {
    return Array.from(selection.contacts)
      .map(id => network.findContact(id))
      .filter((c): c is Contact => c !== null)
  }, [selection.contacts, network])
  
  const selectedGroups = useMemo(() => {
    return Array.from(selection.groups)
      .map(id => network.findGroup(id))
      .filter((g): g is ContactGroup => g !== null)
  }, [selection.groups, network])
  
  const selectedWires = useMemo(() => {
    return Array.from(selection.wires)
      .map(id => network.currentGroup.wires.get(id))
      .filter((w): w is Wire => w !== undefined)
  }, [selection.wires, network.currentGroup])
  
  // Update selection from React Flow selected nodes/edges
  const updateSelection = useCallback((nodes: Node[], edges: Edge[]) => {
    // React Flow's onSelectionChange provides only the currently selected nodes/edges
    const newSelection: Selection = {
      contacts: new Set(nodes.filter(n => n.type !== 'group').map(n => n.id)),
      wires: new Set(edges.map(e => e.id)),
      groups: new Set(nodes.filter(n => n.type === 'group').map(n => n.id))
    }
    setSelection(newSelection)
  }, [setSelection])
  
  // Selection methods
  const selectContact = useCallback((contactId: string, multi = false) => {
    setSelection(prev => ({
      ...prev,
      contacts: multi 
        ? new Set([...prev.contacts, contactId])
        : new Set([contactId]),
      wires: multi ? prev.wires : new Set(),
      groups: multi ? prev.groups : new Set()
    }))
  }, [setSelection])
  
  const selectGroup = useCallback((groupId: string, multi = false) => {
    setSelection(prev => ({
      ...prev,
      groups: multi 
        ? new Set([...prev.groups, groupId])
        : new Set([groupId]),
      contacts: multi ? prev.contacts : new Set(),
      wires: multi ? prev.wires : new Set()
    }))
  }, [setSelection])
  
  const selectWire = useCallback((wireId: string, multi = false) => {
    setSelection(prev => ({
      ...prev,
      wires: multi 
        ? new Set([...prev.wires, wireId])
        : new Set([wireId]),
      contacts: multi ? prev.contacts : new Set(),
      groups: multi ? prev.groups : new Set()
    }))
  }, [setSelection])
  
  const selectAll = useCallback(() => {
    const currentView = network.getCurrentView()
    setSelection({
      contacts: new Set(currentView.contacts.map(c => c.id)),
      wires: new Set(currentView.wires.map(w => w.id)),
      groups: new Set(currentView.subgroups.map(g => g.id))
    })
  }, [network, setSelection])
  
  const clearSelection = useCallback(() => {
    setSelection(createEmptySelection())
  }, [setSelection])
  
  // Calculate selection bounds
  const selectionBounds = useMemo(() => {
    const positions: { x: number, y: number }[] = []
    
    selectedContacts.forEach(c => positions.push(c.position))
    selectedGroups.forEach(g => positions.push(g.position))
    
    if (positions.length === 0) return null
    
    const xs = positions.map(p => p.x)
    const ys = positions.map(p => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }, [selectedContacts, selectedGroups])
  
  // Bulk operations
  const deleteSelected = useCallback(() => {
    // Delete wires first
    selection.wires.forEach(wireId => {
      network.currentGroup.removeWire(wireId)
    })
    
    // Delete contacts
    selection.contacts.forEach(contactId => {
      network.removeContact(contactId)
    })
    
    // Delete groups
    selection.groups.forEach(groupId => {
      network.removeGroup(groupId)
    })
    
    clearSelection()
    syncToReactFlow()
  }, [selection, network, clearSelection, syncToReactFlow])
  
  const extractSelected = useCallback((name: string): ContactGroup | null => {
    if (selection.contacts.size === 0 && selection.groups.size === 0) {
      return null
    }
    
    // Calculate position based on selection bounds
    const position = selectionBounds 
      ? { 
          x: selectionBounds.x + selectionBounds.width / 2, 
          y: selectionBounds.y + selectionBounds.height + 50 // Place below selection
        }
      : { x: 400, y: 200 } // Fallback position
    
    const operation = new ExtractToGadgetOperation()
    const result = operation.execute(
      network.currentGroup,
      selection,
      name,
      position
    )
    
    if (result.success) {
      clearSelection()
      syncToReactFlow()
      playExtractSound()
      
      // Find and return the newly created gadget
      return Array.from(network.currentGroup.subgroups.values())
        .find(g => g.name === name) || null
    }
    
    return null
  }, [selection, network, clearSelection, syncToReactFlow, selectionBounds, playExtractSound])
  
  const inlineSelectedGadget = useCallback((): boolean => {
    if (selection.groups.size !== 1) return false
    
    const gadgetId = Array.from(selection.groups)[0]
    const operation = new InlineGadgetOperation()
    const result = operation.execute(network.currentGroup, gadgetId)
    
    if (result.success) {
      clearSelection()
      syncToReactFlow()
      playInlineSound()
    }
    
    return result.success
  }, [selection, network, clearSelection, syncToReactFlow, playInlineSound])
  
  const convertSelectedToBoundary = useCallback((): boolean => {
    if (selection.contacts.size === 0) return false
    
    // Check if we're converting to boundary or reverting
    let hasNormalContacts = false
    let hasBoundaryContacts = false
    
    for (const contactId of selection.contacts) {
      const contact = network.currentGroup.contacts.get(contactId)
      if (contact) {
        if (contact.isBoundary) {
          hasBoundaryContacts = true
        } else {
          hasNormalContacts = true
        }
      }
    }
    
    // If we have boundary contacts, we're reverting them
    if (hasBoundaryContacts && !hasNormalContacts) {
      // Toggle boundary contacts back to normal
      for (const contactId of selection.contacts) {
        const contact = network.currentGroup.contacts.get(contactId)
        if (contact && contact.isBoundary) {
          network.currentGroup.boundaryContacts.delete(contactId)
          contact.isBoundary = false
          contact.boundaryDirection = undefined
        }
      }
      playBoundaryRevertSound()
      clearSelection()
      syncToReactFlow()
      return true
    }
    
    // Otherwise, convert to boundary
    const operation = new ConvertToBoundaryOperation()
    const result = operation.execute(network.currentGroup, selection)
    
    if (result.success) {
      playBoundaryCreateSound()
      clearSelection()
      syncToReactFlow()
    }
    
    return result.success
  }, [selection, network, clearSelection, syncToReactFlow, playBoundaryCreateSound, playBoundaryRevertSound])
  
  // Check if selection has items
  const hasSelection = selection.contacts.size > 0 || 
                       selection.wires.size > 0 || 
                       selection.groups.size > 0
  
  return {
    // Selected entities
    selectedContacts,
    selectedGroups,
    selectedWires,
    
    // Selection methods
    selectContact,
    selectGroup,
    selectWire,
    selectAll,
    clearSelection,
    
    // Selection state
    hasSelection,
    selectionBounds,
    
    // Bulk operations
    deleteSelected,
    extractSelected,
    inlineSelectedGadget,
    convertSelectedToBoundary,
    
    // React Flow integration
    updateSelection,
    
    // Raw selection for compatibility
    selection
  }
}