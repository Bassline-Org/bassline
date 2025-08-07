import React, { useState } from 'react'
import { useContextFrameStack } from '~/propagation-react/contexts/ContextFrameStackContext'
import { cn } from '~/lib/utils'
import { ChevronRight, X, Navigation, Edit, Link2, Grid3x3, Wrench, Search, Command } from 'lucide-react'

const frameIcons = {
  navigation: Navigation,
  property: Edit,
  valence: Link2,
  gadgetMenu: Grid3x3,
  tool: Wrench,
  search: Search,
  command: Command,
}

const frameColors = {
  navigation: 'bg-blue-500',
  property: 'bg-purple-500',
  valence: 'bg-green-500',
  gadgetMenu: 'bg-orange-500',
  tool: 'bg-pink-500',
  search: 'bg-yellow-500',
  command: 'bg-indigo-500',
}

export function FrameStackDebugger() {
  const { stack, currentFrame, popTo } = useContextFrameStack()
  const [isMinimized, setIsMinimized] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  
  if (isHidden) {
    return (
      <button
        onClick={() => setIsHidden(false)}
        className="fixed bottom-4 left-4 z-50 bg-gray-800 text-white p-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
        title="Show Frame Stack Debugger"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    )
  }
  
  return (
    <div className={cn(
      "fixed bottom-4 left-4 z-50 bg-gray-900 text-white rounded-lg shadow-xl transition-all",
      isMinimized ? "w-12" : "w-80"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        {!isMinimized && <span className="text-sm font-semibold">Frame Stack ({stack.length})</span>}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="hover:bg-gray-700 p-1 rounded transition-colors"
            title={isMinimized ? "Expand" : "Minimize"}
          >
            <ChevronRight className={cn("h-4 w-4 transition-transform", !isMinimized && "rotate-90")} />
          </button>
          <button
            onClick={() => setIsHidden(true)}
            className="hover:bg-gray-700 p-1 rounded transition-colors"
            title="Hide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Stack visualization */}
      {!isMinimized && (
        <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
          {stack.map((frame, index) => {
            const Icon = frameIcons[frame.type] || Grid3x3
            const isActive = frame.id === currentFrame?.id
            const colorClass = frameColors[frame.type] || 'bg-gray-500'
            
            return (
              <div
                key={frame.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded transition-all cursor-pointer",
                  isActive ? "bg-gray-700 ring-2 ring-white/20" : "hover:bg-gray-800",
                  index < stack.length - 1 && "opacity-60"
                )}
                onClick={() => popTo(frame.id)}
              >
                {/* Frame type icon */}
                <div className={cn("p-1.5 rounded", colorClass)}>
                  <Icon className="h-4 w-4" />
                </div>
                
                {/* Frame info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize">{frame.type}</span>
                    {index === 0 && <span className="text-xs text-gray-400">(root)</span>}
                  </div>
                  
                  {/* Selection count */}
                  {(frame.selection.contactIds.size > 0 || frame.selection.groupIds.size > 0) && (
                    <div className="text-xs text-gray-400">
                      {frame.selection.contactIds.size} contacts, {frame.selection.groupIds.size} groups
                    </div>
                  )}
                  
                  {/* Frame-specific info */}
                  {frame.type === 'navigation' && 'previousGroupId' in frame && (
                    <div className="text-xs text-gray-400 truncate">
                      Group: {frame.groupId.slice(0, 8)}...
                    </div>
                  )}
                  {frame.type === 'property' && 'focusedNodeId' in frame && frame.focusedNodeId && (
                    <div className="text-xs text-gray-400 truncate">
                      Node: {frame.focusedNodeId.slice(0, 8)}...
                    </div>
                  )}
                  {frame.type === 'valence' && 'sourceSelection' in frame && (
                    <div className="text-xs text-gray-400">
                      {frame.sourceSelection.totalOutputCount} outputs
                    </div>
                  )}
                  {frame.type === 'tool' && 'toolId' in frame && (
                    <div className="text-xs text-gray-400">
                      Tool: {frame.toolId}
                    </div>
                  )}
                </div>
                
                {/* Stack depth indicator */}
                <div className="text-xs text-gray-500">
                  {index + 1}
                </div>
              </div>
            )
          })}
          
          {/* Stack info */}
          <div className="pt-2 mt-2 border-t border-gray-700 text-xs text-gray-400">
            <div>Depth: {stack.length}</div>
            <div>Current: {currentFrame?.type || 'none'}</div>
            <div className="mt-1 text-gray-500">Click frame to jump</div>
          </div>
        </div>
      )}
    </div>
  )
}