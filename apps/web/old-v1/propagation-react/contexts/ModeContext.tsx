import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type Mode = 'normal' | 'valence' | 'copy'

interface ModeContextValue {
  currentMode: Mode
  setMode: (mode: Mode) => void
  exitMode: () => void
  // Valence mode specific
  valenceSourceIds: string[]
  setValenceSources: (ids: string[]) => void
}

const ModeContext = createContext<ModeContextValue | null>(null)

export function useModeContext() {
  const context = useContext(ModeContext)
  if (!context) {
    throw new Error('useModeContext must be used within ModeProvider')
  }
  return context
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const [currentMode, setCurrentMode] = useState<Mode>('normal')
  const [valenceSourceIds, setValenceSourceIds] = useState<string[]>([])
  
  const setMode = useCallback((mode: Mode) => {
    setCurrentMode(mode)
    if (mode !== 'valence') {
      setValenceSourceIds([])
    }
  }, [])
  
  const exitMode = useCallback(() => {
    setCurrentMode('normal')
    setValenceSourceIds([])
  }, [])
  
  return (
    <ModeContext.Provider value={{
      currentMode,
      setMode,
      exitMode,
      valenceSourceIds,
      setValenceSources: setValenceSourceIds
    }}>
      {children}
    </ModeContext.Provider>
  )
}