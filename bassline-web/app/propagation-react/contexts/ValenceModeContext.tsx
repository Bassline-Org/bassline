import React, { createContext, useContext } from 'react'
import { useValenceMode as useValenceModeHook, type UseValenceModeReturn } from '../hooks/useValenceMode'

const ValenceModeContext = createContext<UseValenceModeReturn | null>(null)

export function ValenceModeProvider({ children }: { children: React.ReactNode }) {
  const valenceMode = useValenceModeHook()
  
  return (
    <ValenceModeContext.Provider value={valenceMode}>
      {children}
    </ValenceModeContext.Provider>
  )
}

export function useValenceMode() {
  const context = useContext(ValenceModeContext)
  if (!context) {
    throw new Error('useValenceMode must be used within ValenceModeProvider')
  }
  return context
}