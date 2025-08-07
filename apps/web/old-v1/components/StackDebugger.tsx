import React from 'react'
import { useUIStack } from '~/propagation-react/contexts/UIStackContext'
import { cn } from '~/lib/utils'

export function StackDebugger() {
  const uiStack = useUIStack()
  
  const getLayerColor = (type: string) => {
    switch (type) {
      case 'base': return 'bg-gray-600'
      case 'selection': return 'bg-blue-600'
      case 'propertyFocus': return 'bg-purple-600'
      case 'valenceMode': return 'bg-green-600'
      case 'gadgetMenu': return 'bg-orange-600'
      case 'configuration': return 'bg-red-600'
      case 'quickAdd': return 'bg-yellow-600'
      case 'search': return 'bg-pink-600'
      default: return 'bg-gray-500'
    }
  }
  
  const getLayerIcon = (type: string) => {
    switch (type) {
      case 'base': return '🏠'
      case 'selection': return '✓'
      case 'propertyFocus': return '🎯'
      case 'valenceMode': return '🔗'
      case 'gadgetMenu': return '📦'
      case 'configuration': return '⚙️'
      case 'quickAdd': return '➕'
      case 'search': return '🔍'
      default: return '❓'
    }
  }
  
  return (
    <div className="absolute bottom-20 right-4 bg-black/80 text-white p-3 rounded-lg text-xs max-w-xs">
      <div className="font-bold mb-2">UI Stack (depth: {uiStack.depth})</div>
      <div className="space-y-1">
        {uiStack.stack.map((layer, index) => (
          <div
            key={layer.id}
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded",
              index === uiStack.stack.length - 1 ? getLayerColor(layer.type) : 'bg-gray-700/50',
              "transition-all duration-200"
            )}
          >
            <span className="text-lg">{getLayerIcon(layer.type)}</span>
            <span className="flex-1">{layer.type}</span>
            {index === uiStack.stack.length - 1 && (
              <span className="text-xs opacity-75">← current</span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs opacity-70">
        Press ESC to go back
      </div>
    </div>
  )
}