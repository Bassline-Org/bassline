import { useFrameSelection } from './useFrameSelection'

// Adapter that provides the old useContextSelection interface
export function useContextSelectionAdapter() {
  const frameSelection = useFrameSelection()
  
  // The old interface returns the same as frameSelection
  // but we ensure backward compatibility
  return {
    // Objects
    selectedContacts: frameSelection.selectedContacts,
    selectedGroups: frameSelection.selectedGroups,
    
    // IDs (the old hook returned IDs, not Sets)
    selectedContactIds: Array.from(frameSelection.selectedContactIds),
    selectedGroupIds: Array.from(frameSelection.selectedGroupIds),
    
    // Selection info
    hasSelection: frameSelection.hasSelection,
    selectionCount: frameSelection.selectionCount,
    
    // Actions
    selectContact: frameSelection.selectContact,
    selectGroup: frameSelection.selectGroup,
    toggleContactSelection: (contactId: string) => frameSelection.toggleSelection(contactId, undefined),
    toggleGroupSelection: (groupId: string) => frameSelection.toggleSelection(undefined, groupId),
    clearSelection: frameSelection.clearSelection,
    
    // Bulk operations
    deleteSelection: () => {
      // This would need to be implemented based on how deletion works
      console.warn('deleteSelection not implemented in adapter')
    },
    extractToGadget: (name: string) => {
      // This would need to be implemented based on refactoring operations
      console.warn('extractToGadget not implemented in adapter')
      return false
    }
  }
}

// Re-export with original name for drop-in replacement
export { useContextSelectionAdapter as useContextSelection }