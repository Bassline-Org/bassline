import { createContext, useContext, useState, useCallback } from 'react'

interface SoundContextValue {
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
}

const SoundContext = createContext<SoundContextValue | null>(null)

export function SoundContextProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(true)
  
  return (
    <SoundContext.Provider value={{ soundEnabled, setSoundEnabled }}>
      {children}
    </SoundContext.Provider>
  )
}

export function useSoundContext() {
  const context = useContext(SoundContext)
  if (!context) {
    throw new Error('useSoundContext must be used within SoundContextProvider')
  }
  return context
}