/**
 * React context for the mode system
 */

import React, { createContext, useContext } from 'react'
import { useModeSystem, type UseModeSystemReturn } from '../hooks/useModeSystem'

const ModeSystemContext = createContext<UseModeSystemReturn | null>(null)

export function ModeSystemProvider({ children }: { children: React.ReactNode }) {
  const modeSystem = useModeSystem()
  
  return (
    <ModeSystemContext.Provider value={modeSystem}>
      {children}
    </ModeSystemContext.Provider>
  )
}

export function useModeContext() {
  const context = useContext(ModeSystemContext)
  if (!context) {
    throw new Error('useModeContext must be used within ModeSystemProvider')
  }
  return context
}