import { useCallback, useMemo } from 'react'
import { useContextFrameStack } from '~/propagation-react/contexts/ContextFrameStackContext'
import { useNetworkContext } from '~/propagation-react/contexts/NetworkContext'
import type { Contact, ContactGroup } from '~/propagation-core'

export function useFrameSelection() {
  const { currentFrame, updateSelection } = useContextFrameStack()
  const { network } = useNetworkContext()
  
  // Get actual Contact and ContactGroup objects from IDs
  const selectedContacts = useMemo(() => {
    if (!currentFrame) return []
    
    const contacts: Contact[] = []
    currentFrame.selection.contactIds.forEach(id => {
      const contact = network.currentGroup.contacts.get(id)
      if (contact) {
        contacts.push(contact)
      } else {
        // Check boundary contacts in subgroups
        for (const subgroup of network.currentGroup.subgroups.values()) {
          if (subgroup.boundaryContacts.has(id)) {
            const boundaryContact = subgroup.contacts.get(id)
            if (boundaryContact) {
              contacts.push(boundaryContact)
              break
            }
          }
        }
      }
    })
    
    return contacts
  }, [currentFrame, network])
  
  const selectedGroups = useMemo(() => {
    if (!currentFrame) return []
    
    const groups: ContactGroup[] = []
    currentFrame.selection.groupIds.forEach(id => {
      const group = network.currentGroup.subgroups.get(id)
      if (group) {
        groups.push(group)
      }
    })
    
    return groups
  }, [currentFrame, network])
  
  // Set selection (replaces current)
  const setSelection = useCallback((contactIds: string[], groupIds: string[]) => {
    updateSelection({
      contactIds: new Set(contactIds),
      groupIds: new Set(groupIds)
    })
  }, [updateSelection])
  
  // Add to selection
  const addToSelection = useCallback((contactIds: string[], groupIds: string[]) => {
    if (!currentFrame) return
    
    const newContactIds = new Set(currentFrame.selection.contactIds)
    const newGroupIds = new Set(currentFrame.selection.groupIds)
    
    contactIds.forEach(id => newContactIds.add(id))
    groupIds.forEach(id => newGroupIds.add(id))
    
    updateSelection({
      contactIds: newContactIds,
      groupIds: newGroupIds
    })
  }, [currentFrame, updateSelection])
  
  // Remove from selection
  const removeFromSelection = useCallback((contactIds: string[], groupIds: string[]) => {
    if (!currentFrame) return
    
    const newContactIds = new Set(currentFrame.selection.contactIds)
    const newGroupIds = new Set(currentFrame.selection.groupIds)
    
    contactIds.forEach(id => newContactIds.delete(id))
    groupIds.forEach(id => newGroupIds.delete(id))
    
    updateSelection({
      contactIds: newContactIds,
      groupIds: newGroupIds
    })
  }, [currentFrame, updateSelection])
  
  // Toggle selection
  const toggleSelection = useCallback((contactId?: string, groupId?: string) => {
    if (!currentFrame) return
    
    const newContactIds = new Set(currentFrame.selection.contactIds)
    const newGroupIds = new Set(currentFrame.selection.groupIds)
    
    if (contactId) {
      if (newContactIds.has(contactId)) {
        newContactIds.delete(contactId)
      } else {
        newContactIds.add(contactId)
      }
    }
    
    if (groupId) {
      if (newGroupIds.has(groupId)) {
        newGroupIds.delete(groupId)
      } else {
        newGroupIds.add(groupId)
      }
    }
    
    updateSelection({
      contactIds: newContactIds,
      groupIds: newGroupIds
    })
  }, [currentFrame, updateSelection])
  
  // Clear selection
  const clearSelection = useCallback(() => {
    updateSelection({
      contactIds: new Set(),
      groupIds: new Set()
    })
  }, [updateSelection])
  
  // Select single item (clears others)
  const selectContact = useCallback((contactId: string, multi = false) => {
    if (multi) {
      toggleSelection(contactId, undefined)
    } else {
      setSelection([contactId], [])
    }
  }, [setSelection, toggleSelection])
  
  const selectGroup = useCallback((groupId: string, multi = false) => {
    if (multi) {
      toggleSelection(undefined, groupId)
    } else {
      setSelection([], [groupId])
    }
  }, [setSelection, toggleSelection])
  
  // Check if selected
  const isContactSelected = useCallback((contactId: string) => {
    return currentFrame?.selection.contactIds.has(contactId) || false
  }, [currentFrame])
  
  const isGroupSelected = useCallback((groupId: string) => {
    return currentFrame?.selection.groupIds.has(groupId) || false
  }, [currentFrame])
  
  // Selection info
  const hasSelection = (currentFrame?.selection.contactIds.size || 0) > 0 || 
                      (currentFrame?.selection.groupIds.size || 0) > 0
  
  const selectionCount = (currentFrame?.selection.contactIds.size || 0) + 
                        (currentFrame?.selection.groupIds.size || 0)
  
  return {
    // State
    selectedContacts,
    selectedGroups,
    selectedContactIds: currentFrame?.selection.contactIds || new Set<string>(),
    selectedGroupIds: currentFrame?.selection.groupIds || new Set<string>(),
    hasSelection,
    selectionCount,
    
    // Actions
    setSelection,
    addToSelection,
    removeFromSelection,
    toggleSelection,
    clearSelection,
    selectContact,
    selectGroup,
    
    // Queries
    isContactSelected,
    isGroupSelected
  }
}