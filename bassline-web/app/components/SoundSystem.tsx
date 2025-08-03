import { createContext, useContext, useRef, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

interface SoundSystemContextValue {
  playSound: (soundName: string) => void
  setVolume: (volume: number) => void
  setEnabled: (enabled: boolean) => void
  isEnabled: boolean
}

const SoundSystemContext = createContext<SoundSystemContextValue | null>(null)

export function useSoundSystem() {
  const context = useContext(SoundSystemContext)
  if (!context) {
    throw new Error('useSoundSystem must be used within SoundSystemProvider')
  }
  return context
}

interface SoundSystemProviderProps {
  children: ReactNode
  initialEnabled?: boolean
  globalVolume?: number
}

// Simple Web Audio API-based sound system
export function SoundSystemProvider({ 
  children, 
  initialEnabled = true,
  globalVolume = 1.0 
}: SoundSystemProviderProps) {
  const [isEnabled, setEnabled] = useState(initialEnabled)
  const audioContextRef = useRef<AudioContext | null>(null)
  const globalVolumeRef = useRef(globalVolume)

  // Initialize audio context on first user interaction
  useEffect(() => {
    const initAudioContext = () => {
      if (!audioContextRef.current && typeof window !== 'undefined') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
    }

    // Initialize on first click
    window.addEventListener('click', initAudioContext, { once: true })
    window.addEventListener('keydown', initAudioContext, { once: true })

    return () => {
      window.removeEventListener('click', initAudioContext)
      window.removeEventListener('keydown', initAudioContext)
    }
  }, [])

  const playSound = useCallback((soundName: string) => {
    if (!isEnabled || typeof window === 'undefined' || !audioContextRef.current) return

    const ctx = audioContextRef.current
    
    // Sound definitions with frequencies and durations
    const sounds: Record<string, { frequency: number; duration: number; volume: number }> = {
      // Connection sounds
      'connection/create': { frequency: 440, duration: 0.1, volume: 0.5 },
      'connection/delete': { frequency: 220, duration: 0.1, volume: 0.4 },
      
      // Node sounds
      'node/create': { frequency: 523, duration: 0.05, volume: 0.3 },
      'node/delete': { frequency: 261, duration: 0.05, volume: 0.3 },
      'node/select': { frequency: 660, duration: 0.03, volume: 0.2 },
      
      // Gadget sounds (lower, more complex)
      'gadget/create': { frequency: 440, duration: 0.15, volume: 0.4 }, // A4 - like tab opening
      'gadget/delete': { frequency: 196, duration: 0.08, volume: 0.4 }, // G3
      'gadget/inline': { frequency: 330, duration: 0.15, volume: 0.4 }, // E4 - like tab closing
      'gadget/enter': { frequency: 587, duration: 0.15, volume: 0.3 }, // D5 (ascending)
      'gadget/exit': { frequency: 294, duration: 0.15, volume: 0.3 }, // D4 (descending)
      
      // Propagation sounds
      'propagation/pulse': { frequency: 330, duration: 0.15, volume: 0.4 },
      'propagation/contradiction': { frequency: 110, duration: 0.3, volume: 0.6 },
      'propagation/value-change': { frequency: 493, duration: 0.05, volume: 0.2 }, // B4
      
      // UI sounds
      'ui/button-click': { frequency: 880, duration: 0.02, volume: 0.3 },
      'ui/toggle': { frequency: 440, duration: 0.05, volume: 0.2 },
      'ui/success': { frequency: 659, duration: 0.2, volume: 0.4 },
      'ui/error': { frequency: 147, duration: 0.3, volume: 0.5 },
      'ui/layout': { frequency: 550, duration: 0.1, volume: 0.3 }, // For auto-layout
    }

    const sound = sounds[soundName]
    if (!sound) return

    try {
      // Create oscillator
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      // Set frequency
      oscillator.frequency.setValueAtTime(sound.frequency, ctx.currentTime)
      oscillator.type = 'sine'
      
      // Set volume with fade out
      const volume = sound.volume * globalVolumeRef.current
      gainNode.gain.setValueAtTime(volume, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + sound.duration)
      
      // Connect nodes
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      // Play sound
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + sound.duration)
    } catch (error) {
      console.warn('Failed to play sound:', error)
    }
  }, [isEnabled])

  const setVolume = useCallback((volume: number) => {
    globalVolumeRef.current = Math.max(0, Math.min(1, volume))
  }, [])

  const value = {
    playSound,
    setVolume,
    setEnabled,
    isEnabled
  }

  return (
    <SoundSystemContext.Provider value={value}>
      {children}
    </SoundSystemContext.Provider>
  )
}

// Hook for easy sound playing
export function useSound(soundName: string) {
  const { playSound } = useSoundSystem()
  
  return {
    play: useCallback(() => playSound(soundName), [playSound, soundName])
  }
}