/**
 * Sound System Stub
 * 
 * Placeholder for sound system functionality
 * TODO: Implement proper sound system
 */

import { useCallback } from 'react'

export function useSound(soundName: string, volume: number = 1) {
  const play = useCallback(() => {
    // No-op for now
    console.log(`[Sound] Would play: ${soundName} at volume ${volume}`)
  }, [soundName, volume])
  
  return { play }
}

export function useSoundSystem() {
  const playSound = useCallback((soundName: string) => {
    console.log(`[Sound] Would play: ${soundName}`)
  }, [])
  
  return { playSound }
}