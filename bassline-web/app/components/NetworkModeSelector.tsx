import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { getNetworkConfig, saveNetworkConfig } from '~/config/network-config'
import { useNavigate } from 'react-router'

export function NetworkModeSelector() {
  const [editing, setEditing] = useState(false)
  const config = getNetworkConfig()
  const [remoteUrl, setRemoteUrl] = useState(config.remoteUrl || 'http://localhost:8455')
  
  const handleConnect = () => {
    saveNetworkConfig({
      mode: 'remote',
      remoteUrl
    })
    window.location.reload()
  }
  
  const handleUseLocal = () => {
    saveNetworkConfig({
      mode: 'worker'
    })
    window.location.reload()
  }
  
  if (editing) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-4 space-y-3">
        <div className="font-semibold">Network Mode</div>
        
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
        
        <div className="flex gap-2">
          <Button size="sm" onClick={handleConnect}>
            Connect
          </Button>
          <Button size="sm" variant="outline" onClick={handleUseLocal}>
            Use Local
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
          Remote: {config.remoteUrl}
        </>
      ) : (
        <>
          <span className="w-2 h-2 bg-blue-500 rounded-full" />
          Local Worker
        </>
      )}
    </Button>
  )
}