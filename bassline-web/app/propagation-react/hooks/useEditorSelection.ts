import { useMemo } from 'react'
import { useEditorState } from '~/propagation-react/contexts/EditorStateContext'
import { useNetworkContext } from '~/propagation-react/contexts/NetworkContext'
import type { Contact, ContactGroup } from '~/propagation-core'

// Hook that provides selection with actual Contact and Group objects
export function useEditorSelection() {
  const { selection, setSelection, addToSelection, removeFromSelection, clearSelection } = useEditorState()
  const { network } = useNetworkContext()
  
  // Get actual Contact and Group objects from IDs
  const selectedContacts = useMemo(() => {
    const contacts: Contact[] = []
    for (const id of selection.contactIds) {
      const contact = network.currentGroup.contacts.get(id)
      if (contact) {
        contacts.push(contact)
      }
    }
    return contacts
  }, [selection.contactIds, network.currentGroup])
  
  const selectedGroups = useMemo(() => {
    const groups: ContactGroup[] = []
    for (const id of selection.groupIds) {
      const group = network.currentGroup.subgroups.get(id)
      if (group) {
        groups.push(group)
      }
    }
    return groups
  }, [selection.groupIds, network.currentGroup])
  
  // Selection actions
  const selectContact = (contactId: string, exclusive = true) => {
    console.log('[useEditorSelection] selectContact:', {
      contactId,
      exclusive,
      timestamp: Date.now()
    })
    
    if (exclusive) {
      setSelection([contactId], [])
    } else {
      addToSelection([contactId], [])
    }
  }
  
  const selectGroup = (groupId: string, exclusive = true) => {
    if (exclusive) {
      setSelection([], [groupId])
    } else {
      addToSelection([], [groupId])
    }
  }
  
  const deselectContact = (contactId: string) => {
    removeFromSelection([contactId], [])
  }
  
  const deselectGroup = (groupId: string) => {
    removeFromSelection([], [groupId])
  }
  
  const isContactSelected = (contactId: string) => {
    return selection.contactIds.has(contactId)
  }
  
  const isGroupSelected = (groupId: string) => {
    return selection.groupIds.has(groupId)
  }
  
  return {
    // Selection state
    selectedContacts,
    selectedGroups,
    selection,
    
    // Actions
    selectContact,
    selectGroup,
    deselectContact,
    deselectGroup,
    clearSelection,
    setSelection,
    
    // Helpers
    isContactSelected,
    isGroupSelected,
    hasSelection: selection.contactIds.size > 0 || selection.groupIds.size > 0
  }
}