import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'

interface SelectionState {
  contactIds: Set<string>
  groupIds: Set<string>
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
    groupIds: new Set()
  })
  
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  
  // Selection management
  const setSelection = useCallback((contactIds: string[], groupIds: string[]) => {
    console.log('[EditorState] setSelection:', {
      contactIds,
      groupIds,
      timestamp: Date.now()
    })
    
    setSelectionState({
      contactIds: new Set(contactIds),
      groupIds: new Set(groupIds)
    })
  }, [])
  
  const addToSelection = useCallback((contactIds: string[], groupIds: string[]) => {
    setSelectionState(prev => ({
      contactIds: new Set([...prev.contactIds, ...contactIds]),
      groupIds: new Set([...prev.groupIds, ...groupIds])
    }))
  }, [])
  
  const removeFromSelection = useCallback((contactIds: string[], groupIds: string[]) => {
    setSelectionState(prev => {
      const newContactIds = new Set(prev.contactIds)
      const newGroupIds = new Set(prev.groupIds)
      
      contactIds.forEach(id => newContactIds.delete(id))
      groupIds.forEach(id => newGroupIds.delete(id))
      
      return {
        contactIds: newContactIds,
        groupIds: newGroupIds
      }
    })
  }, [])
  
  const clearSelection = useCallback(() => {
    console.log('[EditorState] clearSelection')
    setSelection([], [])
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