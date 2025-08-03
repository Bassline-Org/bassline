import React from 'react'
import { useContextFrame } from '~/propagation-react/contexts/ContextFrameContext'
import { useContactSelection } from '~/propagation-react/hooks/useContactSelection'
import { cn } from '~/lib/utils'

export function ContextDebugger() {
  const { contextStack, currentContext, activeTool, selection } = useContextFrame()
  const { selectedContacts, selectedGroups } = useContactSelection()
  
  return (
    <div className="absolute top-20 left-4 bg-black/80 text-white p-3 rounded-lg text-xs max-w-xs">
      <div className="font-bold mb-2">Context Frame Debug</div>
      
      <div className="space-y-1 mb-2">
        <div>Stack depth: {contextStack.length}</div>
        <div>Current group: {currentContext?.groupId.slice(0, 8) || 'none'}</div>
      </div>
      
      <div className="space-y-1 mb-2">
        <div className="font-semibold">Context Selection:</div>
        <div className="text-green-400">Contacts: {selection.contactIds.size}</div>
        <div className="text-green-400">Groups: {selection.groupIds.size}</div>
      </div>
      
      <div className="space-y-1 mb-2 opacity-50">
        <div className="font-semibold">Old Selection:</div>
        <div>Contacts: {selectedContacts.length}</div>
        <div>Groups: {selectedGroups.length}</div>
      </div>
      
      {activeTool && (
        <div className="space-y-1 border-t border-gray-600 pt-2">
          <div className="font-semibold">Active Tool:</div>
          <div>{activeTool.toolId}</div>
        </div>
      )}
      
      <div className="mt-2 text-xs opacity-70">
        Press V for valence mode
      </div>
    </div>
  )
}