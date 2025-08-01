import { useState, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { Selection } from '~/propagation-core/refactoring/types'
import { createEmptySelection } from '~/propagation-core/refactoring/types'

export function useSelection() {
  const [selection, setSelection] = useState<Selection>(createEmptySelection())
  
  // Update selection from React Flow selected nodes/edges
  const updateSelection = useCallback((nodes: Node[], edges: Edge[]) => {
    const newSelection: Selection = {
      contacts: new Set(nodes.filter(n => n.type !== 'group').map(n => n.id)),
      wires: new Set(edges.map(e => e.id)),
      groups: new Set(nodes.filter(n => n.type === 'group').map(n => n.id))
    }
    setSelection(newSelection)
  }, [])
  
  // Clear selection
  const clearSelection = useCallback(() => {
    setSelection(createEmptySelection())
  }, [])
  
  // Check if selection has items
  const hasSelection = selection.contacts.size > 0 || 
                       selection.wires.size > 0 || 
                       selection.groups.size > 0
  
  return {
    selection,
    updateSelection,
    clearSelection,
    hasSelection
  }
}