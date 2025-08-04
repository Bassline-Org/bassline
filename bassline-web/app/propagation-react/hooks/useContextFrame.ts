/**
 * Migration shim - redirects useContextFrame to useEditorState
 * This allows gradual migration without breaking existing code
 */

import { useEditorState } from '../contexts/EditorStateContext'

export function useContextFrame() {
  const editorState = useEditorState()
  
  // Return a compatible interface that matches the old ContextFrame API
  // but uses EditorState under the hood
  return {
    // Selection management - direct pass through
    selection: editorState.selection,
    setSelection: editorState.setSelection,
    addToSelection: editorState.addToSelection,
    removeFromSelection: editorState.removeFromSelection,
    clearSelection: editorState.clearSelection,
    
    
    // Context stack - deprecated, return minimal values
    contextStack: [],
    currentContext: null,
    pushContext: () => console.warn('Context stack is deprecated'),
    popContext: () => console.warn('Context stack is deprecated'),
    
    // View state - deprecated
    updateViewState: () => console.warn('View state is deprecated'),
  }
}