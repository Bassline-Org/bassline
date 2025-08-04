/**
 * Hook for managing selection state in wrapper components
 * Wraps useContextSelection and provides a simplified API for wrapper components
 */

import { useCallback, useMemo, useEffect } from 'react';
import { useContextSelection } from '~/propagation-react/hooks/useContextSelection';
import { useNetworkContext } from '~/propagation-react/contexts/NetworkContext';
import { createSelection, type Selection } from './types';

export function useSelection() {
  const { 
    selectedContacts, 
    selectedGroups, 
    selectContact, 
    selectGroup, 
    deselectContact, 
    deselectGroup, 
    clearSelection,
    isContactSelected,
    isGroupSelected 
  } = useContextSelection();
  const { syncToReactFlow } = useNetworkContext();
  
  // Create Selection object from current selection
  const selection = useMemo((): Selection => {
    return createSelection(selectedContacts, selectedGroups);
  }, [selectedContacts, selectedGroups]);
  
  // Sync to React Flow whenever selection changes
  useEffect(() => {
    syncToReactFlow();
  }, [selectedContacts, selectedGroups, syncToReactFlow]);
  
  // Select only this item (clear others)
  const selectOnly = useCallback((id: string, type: 'contact' | 'group' | 'wire') => {
    if (type === 'wire') return; // Wires aren't selectable in our system
    
    if (type === 'contact') {
      selectContact(id, true); // true = clear others
    } else {
      selectGroup(id, true);
    }
  }, [selectContact, selectGroup]);
  
  // Add to selection (multi-select)
  const addToSelection = useCallback((id: string, type: 'contact' | 'group' | 'wire') => {
    if (type === 'wire') return; // Wires aren't selectable in our system
    
    if (type === 'contact') {
      selectContact(id, false); // false = don't clear others
    } else {
      selectGroup(id, false);
    }
  }, [selectContact, selectGroup]);
  
  // Toggle in selection
  const toggleInSelection = useCallback((id: string, type: 'contact' | 'group' | 'wire') => {
    if (type === 'wire') return; // Wires aren't selectable in our system
    
    const isSelected = type === 'contact' ? isContactSelected(id) : isGroupSelected(id);
    
    if (isSelected) {
      if (type === 'contact') {
        deselectContact(id);
      } else {
        deselectGroup(id);
      }
    } else {
      addToSelection(id, type);
    }
  }, [addToSelection, deselectContact, deselectGroup, isContactSelected, isGroupSelected]);
  
  // Check if item is selected
  const isSelected = useCallback((id: string) => {
    return isContactSelected(id) || isGroupSelected(id);
  }, [isContactSelected, isGroupSelected]);
  
  return {
    selection,
    selectOnly,
    addToSelection,
    toggleInSelection,
    clearSelection,
    isSelected,
  };
}