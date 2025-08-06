import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Label } from './ui/label'
import { getNetworkConfig, saveNetworkConfig } from '~/config/network-config'
import { useNavigate } from 'react-router'

export function NetworkModeSelector() {
  const [open, setOpen] = useState(false)
  const config = getNetworkConfig()
  const [mode, setMode] = useState(config.mode)
  const [remoteUrl, setRemoteUrl] = useState(config.remoteUrl || 'http://localhost:8455')
  const navigate = useNavigate()
  
  const handleSave = () => {
    saveNetworkConfig({
      mode,
      remoteUrl: mode === 'remote' ? remoteUrl : undefined
    })
    
    // Reload the page to apply new settings
    window.location.reload()
  }
  
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
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
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Network Mode</DialogTitle>
            <DialogDescription>
              Choose how to connect to the propagation network
            </DialogDescription>
          </DialogHeader>
          
          <RadioGroup value={mode} onValueChange={setMode}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="worker" id="worker" />
              <Label htmlFor="worker">
                Local Worker (Built-in)
                <p className="text-sm text-muted-foreground">
                  Run the network in a web worker (offline mode)
                </p>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="remote" id="remote" />
              <Label htmlFor="remote">
                Remote Server
                <p className="text-sm text-muted-foreground">
                  Connect to a Bassline server running elsewhere
                </p>
              </Label>
            </div>
          </RadioGroup>
          
          {mode === 'remote' && (
            <div className="mt-4">
              <Label htmlFor="url">Server URL</Label>
              <Input
                id="url"
                type="url"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder="http://localhost:8455"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Make sure the server is running with CORS enabled
              </p>
            </div>
          )}
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save & Reload
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}