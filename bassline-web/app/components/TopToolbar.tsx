import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { ShareRoomButton } from './ShareRoomButton'
import { WebRTCRoomManager } from './WebRTCRoomManager'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Wifi, Save, Upload, Server, HardDrive, X } from 'lucide-react'
import { useNetworkConfig, useSaveNetworkConfig } from '~/hooks/useNetworkConfig'

interface TopToolbarProps {
  onNetworkClick?: () => void
}

export function TopToolbar({ onNetworkClick }: TopToolbarProps = {}) {
  const [showNetworkSelector, setShowNetworkSelector] = useState(false)
  const [showWebRTC, setShowWebRTC] = useState(false)
  const config = useNetworkConfig()
  const saveNetworkConfig = useSaveNetworkConfig()
  const [selectedMode, setSelectedMode] = useState<'worker' | 'remote' | 'webrtc'>(config.mode)
  const [remoteUrl, setRemoteUrl] = useState(config.remoteUrl || 'http://localhost:8455')
  
  const handleConnect = () => {
    if (selectedMode === 'remote') {
      saveNetworkConfig({
        mode: 'remote',
        remoteUrl
      })
      setShowNetworkSelector(false)
    } else if (selectedMode === 'worker') {
      saveNetworkConfig({
        mode: 'worker'
      })
      setShowNetworkSelector(false)
    } else if (selectedMode === 'webrtc') {
      setShowWebRTC(true)
      setShowNetworkSelector(false)
    }
  }
  
  const handleWebRTCConnect = (webrtcConfig: {
    signalingUrl: string
    roomCode?: string
    isHost: boolean
  }) => {
    saveNetworkConfig({
      mode: 'webrtc',
      webrtc: webrtcConfig
    })
    setShowWebRTC(false)
  }
  
  const getConnectionStatusIcon = () => {
    switch (config.mode) {
      case 'webrtc':
        return <Wifi className="h-3 w-3 text-green-500" />
      case 'remote':
        return <Wifi className="h-3 w-3 text-blue-500" />
      case 'worker':
      default:
        return <Wifi className="h-3 w-3 text-gray-400" />
    }
  }
  
  const getConnectionLabel = () => {
    switch (config.mode) {
      case 'webrtc':
        return config.webrtc?.roomCode ? `Room: ${config.webrtc.roomCode}` : 'P2P'
      case 'remote':
        return 'Remote'
      case 'worker':
      default:
        return 'Local'
    }
  }
  
  return (
    <>
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-background/95 backdrop-blur border rounded-lg shadow-sm p-2">
        {/* Connection Status */}
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setShowNetworkSelector(!showNetworkSelector)}
        >
          {getConnectionStatusIcon()}
          <span className="text-xs font-medium">{getConnectionLabel()}</span>
        </Button>
        
        {/* Share Room Button */}
        <ShareRoomButton />
        
        {/* Save/Load Actions */}
        <div className="flex gap-1 border-l pl-2 ml-1">
          <Button
            variant="ghost"
            size="sm"
            title="Save network"
            className="h-8 w-8 p-0"
          >
            <Save className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            title="Load network"
            className="h-8 w-8 p-0"
          >
            <Upload className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Network Mode Selector Dropdown */}
      {showNetworkSelector && (
        <div className="absolute top-16 right-4 z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 space-y-3 min-w-[300px] border">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Network Mode</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowNetworkSelector(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <RadioGroup value={selectedMode} onValueChange={(v) => setSelectedMode(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="worker" id="worker" />
                <Label htmlFor="worker" className="flex items-center gap-2 cursor-pointer">
                  <HardDrive className="h-4 w-4" />
                  Local Worker
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="remote" id="remote" />
                <Label htmlFor="remote" className="flex items-center gap-2 cursor-pointer">
                  <Server className="h-4 w-4" />
                  Remote Server
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="webrtc" id="webrtc" />
                <Label htmlFor="webrtc" className="flex items-center gap-2 cursor-pointer">
                  <Wifi className="h-4 w-4" />
                  P2P Connection
                </Label>
              </div>
            </RadioGroup>
            
            {selectedMode === 'remote' && (
              <div className="space-y-2">
                <Label htmlFor="url">Server URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  placeholder="http://localhost:8455"
                />
              </div>
            )}
            
            <div className="flex gap-2">
              <Button size="sm" onClick={handleConnect}>
                {selectedMode === 'webrtc' ? 'Next' : 'Connect'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNetworkSelector(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* WebRTC Room Manager Modal */}
      {showWebRTC && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <WebRTCRoomManager
            onConnect={handleWebRTCConnect}
            onClose={() => setShowWebRTC(false)}
          />
        </div>
      )}
    </>
  )
}