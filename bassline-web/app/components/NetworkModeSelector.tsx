import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { useNetworkConfig, useSaveNetworkConfig } from '~/hooks/useNetworkConfig'
import { useNavigate } from 'react-router'
import { WebRTCRoomManager } from './WebRTCRoomManager'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Server, Wifi, HardDrive } from 'lucide-react'

export function NetworkModeSelector() {
  const [editing, setEditing] = useState(false)
  const config = useNetworkConfig()
  const saveNetworkConfig = useSaveNetworkConfig()
  const [selectedMode, setSelectedMode] = useState<'worker' | 'remote' | 'webrtc'>(config.mode)
  const [remoteUrl, setRemoteUrl] = useState(config.remoteUrl || 'http://localhost:8455')
  const [showWebRTC, setShowWebRTC] = useState(false)
  
  const handleConnect = () => {
    if (selectedMode === 'remote') {
      saveNetworkConfig({
        mode: 'remote',
        remoteUrl
      })
    } else if (selectedMode === 'worker') {
      saveNetworkConfig({
        mode: 'worker'
      })
    } else if (selectedMode === 'webrtc') {
      setShowWebRTC(true)
      setEditing(false)
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
  }
  
  if (showWebRTC) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <WebRTCRoomManager
          onConnect={handleWebRTCConnect}
          onClose={() => setShowWebRTC(false)}
        />
      </div>
    )
  }
  
  if (editing) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-4 space-y-3 min-w-[300px]">
        <div className="font-semibold">Network Mode</div>
        
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
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setEditing(true)}
      className="gap-2"
    >
      {config.mode === 'remote' ? (
        <>
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <Server className="h-4 w-4" />
          Remote: {config.remoteUrl}
        </>
      ) : config.mode === 'webrtc' ? (
        <>
          <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
          <Wifi className="h-4 w-4" />
          P2P: {config.webrtc?.roomCode || 'Connecting...'}
        </>
      ) : (
        <>
          <span className="w-2 h-2 bg-blue-500 rounded-full" />
          <HardDrive className="h-4 w-4" />
          Local Worker
        </>
      )}
    </Button>
  )
}