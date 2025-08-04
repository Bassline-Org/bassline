import React from 'react'
import { useEditorState } from '~/propagation-react/contexts/EditorStateContext'
import { useContactSelection } from '~/propagation-react/hooks/useContactSelection'

export function ContextDebugger() {
  const { selection, focusedNodeId } = useEditorState()
  const { selectedContacts, selectedGroups } = useContactSelection()
  
  return (
    <div className="absolute top-20 left-4 bg-black/80 text-white p-3 rounded-lg text-xs max-w-xs">
      <div className="font-bold mb-2">Editor State Debug</div>
      
      <div className="space-y-1 mb-2">
        <div>Focused node: {focusedNodeId?.slice(0, 8) || 'none'}</div>
      </div>
      
      <div className="space-y-1 mb-2">
        <div className="font-semibold">Selection:</div>
        <div className="text-green-400">Contacts: {selection.contactIds.size}</div>
        <div className="text-green-400">Groups: {selection.groupIds.size}</div>
        <div>Contacts: {selectedContacts.length}</div>
        <div>Groups: {selectedGroups.length}</div>
      </div>
      
      <div className="mt-2 text-xs opacity-70">
        Press V for valence mode
      </div>
    </div>
  )
}