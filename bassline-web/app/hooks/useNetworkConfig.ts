import { useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import type { NetworkConfig } from '~/config/network-config'

/**
 * Custom hook for managing network configuration with URL params support
 * Properly integrates with React Router's useSearchParams
 */
export function useNetworkConfig(): NetworkConfig {
  const [searchParams] = useSearchParams()
  
  const config = useMemo(() => {
    // First check localStorage for saved config
    const stored = localStorage.getItem('bassline-network-config')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        // If we have a stored config and no URL params override, use it
        if (!searchParams.get('room') && !searchParams.get('server')) {
          return parsed
        }
      } catch (e) {
        console.error('Invalid network config in localStorage', e)
      }
    }
    
    // Check URL parameters for room sharing
    const roomCode = searchParams.get('room')
    const remoteUrl = searchParams.get('server')
    const signalingUrl = searchParams.get('signal')
    
    // If we have a room code, configure for WebRTC
    if (roomCode) {
      // Use the same host as the current page for signaling server
      const defaultSignalingUrl = `ws://${window.location.hostname}:8081`
      
      return {
        mode: 'webrtc',
        webrtc: {
          roomCode,
          signalingUrl: signalingUrl || defaultSignalingUrl,
          isHost: false // Joining via link means not host
        }
      } as NetworkConfig
    }
    
    // If we have a remote URL, use remote mode
    if (remoteUrl) {
      return {
        mode: 'remote',
        remoteUrl
      } as NetworkConfig
    }
    
    // Default to worker mode
    return {
      mode: 'worker'
    } as NetworkConfig
  }, [searchParams])
  
  // Auto-save config from URL params to localStorage if it's a shared link
  useEffect(() => {
    const roomCode = searchParams.get('room')
    const remoteUrl = searchParams.get('server')
    
    if (roomCode || remoteUrl) {
      // Save the config so it persists after navigation
      localStorage.setItem('bassline-network-config', JSON.stringify(config))
      
      // Clean up URL params after saving (optional - keeps URLs clean)
      // Uncomment if you want to remove params after initial load
      // const newSearchParams = new URLSearchParams(searchParams)
      // newSearchParams.delete('room')
      // newSearchParams.delete('server')
      // newSearchParams.delete('signal')
      // setSearchParams(newSearchParams, { replace: true })
    }
  }, [searchParams, config])
  
  return config
}

/**
 * Hook to save network configuration
 */
export function useSaveNetworkConfig() {
  const [searchParams, setSearchParams] = useSearchParams()
  
  return (config: NetworkConfig) => {
    // Save to localStorage
    localStorage.setItem('bassline-network-config', JSON.stringify(config))
    
    // Clear URL params when manually setting config
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.delete('room')
    newSearchParams.delete('server')
    newSearchParams.delete('signal')
    setSearchParams(newSearchParams, { replace: true })
    
    // Reload to apply new config
    window.location.reload()
  }
}

/**
 * Hook to clear network configuration
 */
export function useClearNetworkConfig() {
  const [searchParams, setSearchParams] = useSearchParams()
  
  return () => {
    localStorage.removeItem('bassline-network-config')
    
    // Clear URL params
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.delete('room')
    newSearchParams.delete('server')
    newSearchParams.delete('signal')
    setSearchParams(newSearchParams, { replace: true })
    
    window.location.reload()
  }
}