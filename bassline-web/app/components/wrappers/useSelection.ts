/**
 * Hook for managing selection state in wrapper components
 */

import { useCallback, useMemo } from 'react';
import { useContextSelection } from '~/propagation-react/hooks/useContextSelection';
import { useNetworkContext } from '~/propagation-react/contexts/NetworkContext';
import { createSelection, type Selection } from './types';

export function useSelection() {
  const { selectedContacts, selectedGroups, selectContact, selectGroup, deselectContact, deselectGroup, clearSelection } = useContextSelection();
  const { network } = useNetworkContext();
  
  // Create Selection object from current selection
  const selection = useMemo((): Selection => {
    return createSelection(selectedContacts, selectedGroups);
  }, [selectedContacts, selectedGroups]);
  
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
    
    if (selection.includes(id)) {
      if (type === 'contact') {
        deselectContact(id);
      } else {
        deselectGroup(id);
      }
    } else {
      addToSelection(id, type);
    }
  }, [selection, addToSelection, deselectContact, deselectGroup]);
  
  // Check if item is selected
  const isSelected = useCallback((id: string) => {
    return selection.includes(id);
  }, [selection]);
  
  return {
    selection,
    selectOnly,
    addToSelection,
    toggleInSelection,
    clearSelection,
    isSelected,
  };
}