import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'

// Match the SelectionState type from ContextFrame
interface SelectionState {
  contactIds: Set<string>
  groupIds: Set<string>
  // Ordered arrays that preserve selection order for valence mode
  orderedContactIds: string[]
  orderedGroupIds: string[]
  lastModified: number
}

interface EditorStateContextValue {
  // Selection management
  selection: SelectionState
  setSelection: (contactIds: string[], groupIds: string[]) => void
  addToSelection: (contactIds: string[], groupIds: string[]) => void
  removeFromSelection: (contactIds: string[], groupIds: string[]) => void
  clearSelection: () => void
  
  // Focus management (for read mode, property panel, etc)
  focusedNodeId: string | null
  setFocus: (nodeId: string | null) => void
}

const EditorStateContext = createContext<EditorStateContextValue | undefined>(undefined)

interface EditorStateProviderProps {
  children: ReactNode
}

export function EditorStateProvider({ children }: EditorStateProviderProps) {
  const [selection, setSelectionState] = useState<SelectionState>({
    contactIds: new Set(),
    groupIds: new Set(),
    orderedContactIds: [],
    orderedGroupIds: [],
    lastModified: Date.now()
  })
  
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  
  // Selection management
  const setSelection = useCallback((contactIds: string[], groupIds: string[]) => {
    
    setSelectionState({
      contactIds: new Set(contactIds),
      groupIds: new Set(groupIds),
      orderedContactIds: contactIds,
      orderedGroupIds: groupIds,
      lastModified: Date.now()
    })
  }, [])
  
  const addToSelection = useCallback((contactIds: string[], groupIds: string[]) => {
    setSelectionState(prev => {
      // Filter out duplicates while preserving order
      const newOrderedContactIds = [...prev.orderedContactIds]
      const newOrderedGroupIds = [...prev.orderedGroupIds]
      
      contactIds.forEach(id => {
        if (!prev.contactIds.has(id)) {
          newOrderedContactIds.push(id)
        }
      })
      
      groupIds.forEach(id => {
        if (!prev.groupIds.has(id)) {
          newOrderedGroupIds.push(id)
        }
      })
      
      return {
        contactIds: new Set([...prev.contactIds, ...contactIds]),
        groupIds: new Set([...prev.groupIds, ...groupIds]),
        orderedContactIds: newOrderedContactIds,
        orderedGroupIds: newOrderedGroupIds,
        lastModified: Date.now()
      }
    })
  }, [])
  
  const removeFromSelection = useCallback((contactIds: string[], groupIds: string[]) => {
    setSelectionState(prev => {
      const newContactIds = new Set(prev.contactIds)
      const newGroupIds = new Set(prev.groupIds)
      
      contactIds.forEach(id => newContactIds.delete(id))
      groupIds.forEach(id => newGroupIds.delete(id))
      
      // Update ordered arrays by filtering out removed items
      const newOrderedContactIds = prev.orderedContactIds.filter(id => !contactIds.includes(id))
      const newOrderedGroupIds = prev.orderedGroupIds.filter(id => !groupIds.includes(id))
      
      return {
        contactIds: newContactIds,
        groupIds: newGroupIds,
        orderedContactIds: newOrderedContactIds,
        orderedGroupIds: newOrderedGroupIds,
        lastModified: Date.now()
      }
    })
  }, [])
  
  const clearSelection = useCallback(() => {
    setSelection([], [])
    // Also clear focus when clearing selection
    setFocusedNodeId(null)
  }, [setSelection])
  
  const setFocus = useCallback((nodeId: string | null) => {
    setFocusedNodeId(nodeId)
  }, [])
  
  const value: EditorStateContextValue = useMemo(() => ({
    selection,
    setSelection,
    addToSelection,
    removeFromSelection,
    clearSelection,
    focusedNodeId,
    setFocus
  }), [
    selection,
    setSelection,
    addToSelection,
    removeFromSelection,
    clearSelection,
    focusedNodeId,
    setFocus
  ])
  
  return (
    <EditorStateContext.Provider value={value}>
      {children}
    </EditorStateContext.Provider>
  )
}

export function useEditorState() {
  const context = useContext(EditorStateContext)
  if (!context) {
    throw new Error('useEditorState must be used within EditorStateProvider')
  }
  return context
}