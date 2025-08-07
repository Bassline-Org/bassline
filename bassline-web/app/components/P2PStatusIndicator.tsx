import { useEffect, useState } from 'react'
import { Wifi, WifiOff, Users } from 'lucide-react'
import { cn } from '~/lib/utils'
import { useNetworkConfig } from '~/hooks/useNetworkConfig'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'

interface P2PStatus {
  connected: boolean
  peerCount: number
  role: 'host' | 'guest' | null
  roomCode?: string
}

export function P2PStatusIndicator() {
  const config = useNetworkConfig()
  const [status, setStatus] = useState<P2PStatus>({
    connected: false,
    peerCount: 0,
    role: null,
  })

  useEffect(() => {
    if (config.mode !== 'webrtc') {
      setStatus({
        connected: false,
        peerCount: 0,
        role: null,
      })
      return
    }

    // Set initial status based on config
    setStatus({
      connected: true, // Assume connected if in WebRTC mode
      peerCount: 1, // At least self
      role: config.webrtc?.isHost ? 'host' : 'guest',
      roomCode: config.webrtc?.roomCode,
    })

    // TODO: Subscribe to actual WebRTC client status updates
    // This would involve getting the WebRTC client instance and listening to peer events
  }, [config])

  // Don't show if not in WebRTC mode
  if (config.mode !== 'webrtc') {
    return null
  }

  const getStatusColor = () => {
    if (!status.connected) return 'text-gray-400'
    if (status.peerCount > 1) return 'text-green-500'
    return 'text-yellow-500'
  }

  const getStatusMessage = () => {
    if (!status.connected) {
      return 'Disconnected'
    }
    
    const roleText = status.role === 'host' ? 'Host' : 'Guest'
    const peerText = status.peerCount === 1 
      ? 'No peers connected' 
      : `${status.peerCount - 1} peer${status.peerCount > 2 ? 's' : ''} connected`
    
    return `${roleText} • ${peerText}`
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/95 backdrop-blur border shadow-sm">
            {status.connected ? (
              <Wifi className={cn('h-3.5 w-3.5', getStatusColor())} />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-gray-400" />
            )}
            
            {status.peerCount > 1 && (
              <>
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  {status.peerCount}
                </span>
              </>
            )}
            
            {status.roomCode && (
              <span className="text-xs font-mono text-muted-foreground">
                {status.roomCode}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <div className="font-medium">{getStatusMessage()}</div>
            {status.roomCode && (
              <div className="text-muted-foreground mt-1">
                Room: {status.roomCode}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}