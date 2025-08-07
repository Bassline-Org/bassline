import { useEffect, useRef } from 'react'
import { useNetworkConfig } from './useNetworkConfig'
import { NetworkClient } from '~/network/network-client'
import { RemoteNetworkClient } from '~/network/remote-client'
import { WebSocketNetworkClient } from '~/network/websocket-client'
import { NativeWebRTCClient } from '~/network/webrtc-native-client'
import { ClientWrapper } from '~/network/client-wrapper'

/**
 * Hook to get a properly configured network client based on URL params and config
 * This ensures the client is initialized with the correct mode from URL params
 */
export function useNetworkClient() {
  const config = useNetworkConfig()
  const clientRef = useRef<ClientWrapper | null>(null)
  const configKeyRef = useRef<string>('')
  
  // Generate a key to detect config changes
  const configKey = JSON.stringify({
    mode: config.mode,
    remoteUrl: config.remoteUrl,
    webrtc: config.webrtc
  })
  
  // Only recreate client if config actually changed
  if (configKey !== configKeyRef.current) {
    console.log('[useNetworkClient] Config changed, creating new client:', config)
    
    // Clean up old client
    if (clientRef.current) {
      clientRef.current.terminate()
      clientRef.current = null
    }
    
    // Create new client based on config
    if (config.mode === 'webrtc' && config.webrtc) {
      console.log('[useNetworkClient] Creating WebRTC client with room:', config.webrtc.roomCode)
      const webrtcClient = new NativeWebRTCClient({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        signalingUrl: config.webrtc.signalingUrl,
        roomCode: config.webrtc.roomCode,
        isHost: config.webrtc.isHost
      })
      clientRef.current = new ClientWrapper(webrtcClient as any)
      
      // Initialize WebRTC asynchronously
      webrtcClient.initialize().then(() => {
        console.log('[useNetworkClient] WebRTC client initialized')
      }).catch(error => {
        console.error('[useNetworkClient] Failed to initialize WebRTC:', error)
      })
    } else if (config.mode === 'remote' && config.remoteUrl) {
      console.log('[useNetworkClient] Creating WebSocket client:', config.remoteUrl)
      const wsClient = new WebSocketNetworkClient(config.remoteUrl)
      clientRef.current = new ClientWrapper(wsClient)
      
      // Initialize WebSocket asynchronously
      wsClient.initialize().then(() => {
        console.log('[useNetworkClient] WebSocket client initialized')
      }).catch(error => {
        console.error('[useNetworkClient] Failed to initialize WebSocket:', error)
      })
    } else {
      console.log('[useNetworkClient] Creating worker client')
      const workerClient = new NetworkClient({
        onReady: async () => {
          console.log('[useNetworkClient] Worker client ready')
          // Ensure root group exists
          try {
            await workerClient.registerGroup({
              id: 'root',
              name: 'Root Group',
              contactIds: [],
              wireIds: [],
              subgroupIds: [],
              boundaryContactIds: []
            })
            console.log('[useNetworkClient] Root group created')
          } catch (e) {
            console.log('[useNetworkClient] Root group already exists')
          }
        },
        onChanges: (changes) => {
          console.log('[useNetworkClient] Network changes:', changes)
        }
      })
      clientRef.current = new ClientWrapper(workerClient)
    }
    
    configKeyRef.current = configKey
  }
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        console.log('[useNetworkClient] Cleaning up client')
        clientRef.current.terminate()
        clientRef.current = null
      }
    }
  }, [])
  
  return clientRef.current!
}