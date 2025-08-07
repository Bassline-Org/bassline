import { createContext, useContext, useRef, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useSoundContext } from '~/propagation-react/contexts/SoundContext'

interface SoundSystemContextValue {
  playSound: (soundName: string, volumeOverride?: number) => void
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

// Map our sound names to LittleBigPlanet sound files
const soundMap: Record<string, string> = {
  // Connection sounds
  'connection/create': '/lbp-sounds/grabbersgrab.mp3',
  'connection/delete': '/lbp-sounds/broken.mp3',
  
  // Node sounds
  'node/create': '/lbp-sounds/newobject.mp3',
  'node/delete': '/lbp-sounds/broken.mp3',
  'node/select': '/lbp-sounds/guiselect.mp3',
  
  // Gadget sounds
  'gadget/create': '/lbp-sounds/newobject.mp3',
  'gadget/delete': '/lbp-sounds/broken.mp3',
  'gadget/inline': '/lbp-sounds/poppitback.mp3',
  'gadget/extract': '/lbp-sounds/wearcostume.mp3',
  'gadget/enter': '/lbp-sounds/controllinatorenter.mp3',
  'gadget/exit': '/lbp-sounds/controllinatorexit.mp3',
  
  // Propagation sounds
  'propagation/pulse': '/lbp-sounds/scorebubblecollect.mp3',
  'propagation/contradiction': '/lbp-sounds/guierror.mp3',
  'propagation/value-change': '/lbp-sounds/placesticker.mp3',
  
  // UI sounds
  'ui/button-click': '/lbp-sounds/guiselect.mp3',
  'ui/toggle': '/lbp-sounds/guinotify.mp3',
  'ui/success': '/lbp-sounds/eventcomplete.mp3',
  'ui/error': '/lbp-sounds/eventfail.mp3',
  'ui/layout': '/lbp-sounds/grabberspickup.mp3',
  'ui/tool-enable': '/lbp-sounds/openpoppit.mp3',
  'ui/tool-disable': '/lbp-sounds/closepoppit.mp3',
  'ui/place': '/lbp-sounds/guinotifyclose.mp3',
  'ui/boundary-create': '/lbp-sounds/creatinatorgrab.mp3',
  'ui/boundary-revert': '/lbp-sounds/creatinatordrop.mp3',
  
  // Special actions
  'special/achievement': '/lbp-sounds/collectallprizes.mp3',
  'special/score': '/lbp-sounds/scorebubblecollect.mp3',
  'special/combo': '/lbp-sounds/scorebubblecombo.mp3',
  'special/combo-end': '/lbp-sounds/scorebubblecomboend.mp3',
  'special/photo': '/lbp-sounds/takephoto.mp3',
  'special/favorite': '/lbp-sounds/heart.mp3',
  'special/unfavorite': '/lbp-sounds/unheart.mp3',
  'special/celebrate': '/lbp-sounds/yay.mp3',
  'special/impact': '/lbp-sounds/smack.mp3',
  'special/jump': '/lbp-sounds/jump.mp3',
  'special/correct': '/lbp-sounds/stickerrollovercorrect.mp3',
  'special/incorrect': '/lbp-sounds/stickerrolloverincorrect.mp3',
  'special/publish': '/lbp-sounds/publishlevel.mp3',
  'special/decoration': '/lbp-sounds/newdecoration.mp3',
}

// Cache for loaded audio buffers
const audioBufferCache = new Map<string, AudioBuffer>()

// Sound system using Web Audio API
export function SoundSystemProvider({ 
  children, 
  initialEnabled = true,
  globalVolume = 0.5 
}: SoundSystemProviderProps) {
  const [isEnabled, setEnabledState] = useState(initialEnabled)
  const globalVolumeRef = useRef(globalVolume)
  const audioContextRef = useRef<AudioContext | null>(null)
  const { soundEnabled } = useSoundContext()

  // Initialize audio context on first user interaction
  useEffect(() => {
    const initAudioContext = async () => {
      if (!audioContextRef.current && typeof window !== 'undefined') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        // Preload sounds
        await preloadSoundsInternal()
      }
    }
    
    const preloadSoundsInternal = async () => {
      if (!audioContextRef.current) return
      
      const soundsToPreload = [
        'connection/create',
        'connection/delete',
        'node/create',
        'node/delete',
        'node/select',
        'gadget/create',
        'gadget/delete',
        'gadget/enter',
        'gadget/exit',
        'ui/success',
        'ui/error',
        'special/celebrate',
        'special/publish'
      ]
      
      for (const soundName of soundsToPreload) {
        const url = soundMap[soundName]
        if (url && !audioBufferCache.has(url)) {
          try {
            const response = await fetch(url)
            const arrayBuffer = await response.arrayBuffer()
            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
            audioBufferCache.set(url, audioBuffer)
          } catch (error) {
            console.warn(`Failed to preload sound ${soundName}:`, error)
          }
        }
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


  const playSound = useCallback(async (soundName: string, volumeOverride?: number) => {
    // Check if sound is enabled
    if (!soundEnabled || !isEnabled || !audioContextRef.current) return

    // Map our sound name to file path
    const soundUrl = soundMap[soundName]
    if (!soundUrl) {
      console.warn(`Sound not mapped: ${soundName}`)
      return
    }

    try {
      let audioBuffer = audioBufferCache.get(soundUrl)
      
      // Load the sound if not cached
      if (!audioBuffer) {
        const response = await fetch(soundUrl)
        const arrayBuffer = await response.arrayBuffer()
        audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
        audioBufferCache.set(soundUrl, audioBuffer)
      }
      
      // Create and play the sound
      const source = audioContextRef.current.createBufferSource()
      const gainNode = audioContextRef.current.createGain()
      
      source.buffer = audioBuffer
      source.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)
      
      gainNode.gain.value = volumeOverride !== undefined ? volumeOverride : globalVolumeRef.current
      
      source.start(0)
    } catch (error) {
      console.warn('Failed to play sound:', error)
    }
  }, [isEnabled, soundEnabled])

  const setVolume = useCallback((volume: number) => {
    globalVolumeRef.current = Math.max(0, Math.min(1, volume))
  }, [])

  const setEnabled = useCallback((enabled: boolean) => {
    setEnabledState(enabled)
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
export function useSound(soundName: string, defaultVolume?: number) {
  const { playSound } = useSoundSystem()
  
  return {
    play: useCallback((volumeOverride?: number) => playSound(soundName, volumeOverride ?? defaultVolume), [playSound, soundName, defaultVolume])
  }
}