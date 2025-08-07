// Network configuration for UI
export interface NetworkConfig {
  mode: 'worker' | 'remote' | 'webrtc'
  remoteUrl?: string
  webrtc?: {
    signalingUrl: string
    roomCode?: string
    isHost?: boolean
  }
}

// Load config from localStorage or environment
export function getNetworkConfig(): NetworkConfig {
  // Check localStorage first
  const stored = localStorage.getItem('bassline-network-config')
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch (e) {
      console.error('Invalid network config in localStorage', e)
    }
  }
  
  // Check URL parameters for room sharing
  const urlParams = new URLSearchParams(window.location.search)
  const roomCode = urlParams.get('room')
  const remoteUrl = urlParams.get('server')
  const signalingUrl = urlParams.get('signal')
  
  // If we have a room code, configure for WebRTC
  if (roomCode) {
    return {
      mode: 'webrtc',
      webrtc: {
        roomCode,
        signalingUrl: signalingUrl || 'ws://localhost:8081',
        isHost: false // Joining via link means not host
      }
    }
  }
  
  // If we have a remote URL, use remote mode
  if (remoteUrl) {
    return {
      mode: 'remote',
      remoteUrl
    }
  }
  
  // Default to worker mode
  return {
    mode: 'worker'
  }
}

export function saveNetworkConfig(config: NetworkConfig) {
  localStorage.setItem('bassline-network-config', JSON.stringify(config))
}

export function clearNetworkConfig() {
  localStorage.removeItem('bassline-network-config')
}