// Network configuration for UI
export interface NetworkConfig {
  mode: 'worker' | 'remote'
  remoteUrl?: string
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
  
  // Check if we have a remote URL in the environment or URL params
  const urlParams = new URLSearchParams(window.location.search)
  const remoteUrl = urlParams.get('server')
  
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