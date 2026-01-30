/**
 * useAmbientAudio - React hook for generative ambient audio
 *
 * Connects the AudioSystem to presence state, creating a living
 * audio layer that responds to user interaction.
 *
 * Note: Electron allows autoplay - no user gesture required.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { AudioSystem, type AudioAnalysis } from './AudioSystem'
import type { PresenceState } from '../presence/usePresence'

export interface AmbientAudioState {
  isReady: boolean
  hasAwakened: boolean
  isEnabled: boolean
  toggle: () => void
  getAnalysis: () => AudioAnalysis | null
  audioSystem: AudioSystem | null
}

export function useAmbientAudio(presence: PresenceState): AmbientAudioState {
  const audioRef = useRef<AudioSystem | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [hasAwakened, setHasAwakened] = useState(false)
  const [isEnabled, setIsEnabled] = useState(true)
  const prevHasMoved = useRef(false)

  // Initialize audio on mount (Electron allows autoplay)
  useEffect(() => {
    const audio = new AudioSystem()
    audio.initialize().then(() => {
      audioRef.current = audio
      setIsReady(true)
    })

    return () => {
      audio.dispose()
    }
  }, [])

  // Awaken on first movement
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !isEnabled || !isReady) return

    if (presence.hasMoved && !prevHasMoved.current && presence.focused) {
      audio.awaken()
      setHasAwakened(true)
    }

    prevHasMoved.current = presence.hasMoved
  }, [presence.hasMoved, presence.focused, isEnabled, isReady])

  // Continuous presence updates
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !isEnabled || !hasAwakened) return

    audio.update({
      velocity: presence.velocity,
      idleMs: presence.idleMs,
      focused: presence.focused,
    })
  }, [presence.velocity, presence.idleMs, presence.focused, isEnabled, hasAwakened])

  const toggle = () => setIsEnabled((prev) => !prev)

  const getAnalysis = useCallback((): AudioAnalysis | null => {
    const audio = audioRef.current
    if (!audio || !hasAwakened || !isEnabled) return null
    return audio.getAnalysis()
  }, [hasAwakened, isEnabled])

  return { isReady, hasAwakened, isEnabled, toggle, getAnalysis, audioSystem: audioRef.current }
}
