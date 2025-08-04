import React from 'react'
import { useModeContext } from '~/propagation-react/contexts/ModeContext'
import { cn } from '~/lib/utils'

export function MinorModesOverlay() {
  const modeSystem = useModeContext()
  
  // Get list of active minor modes
  const activeMinorModes = modeSystem.activeMinorModes
  
  // Don't show if no minor modes are active
  if (activeMinorModes.length === 0) {
    return null
  }
  
  // Get mode info for each active mode
  const activeModes = modeSystem.availableModes
    .filter(mode => mode.type === 'minor' && activeMinorModes.includes(mode.id))
  
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {activeModes.map(mode => (
        <div
          key={mode.id}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full",
            "bg-gray-800/90 backdrop-blur text-white",
            "border border-gray-700",
            "text-sm font-medium",
            "animate-in fade-in slide-in-from-right-2 duration-200"
          )}
        >
          <span className="text-base">{mode.icon}</span>
          <span>{mode.name}</span>
          {mode.id === 'valence' && (
            <span className="text-xs text-gray-400 ml-1">
              Press V to exit
            </span>
          )}
        </div>
      ))}
    </div>
  )
}