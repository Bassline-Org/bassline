import { useState, useCallback } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '~/components/ui/card'
import { Label } from '~/components/ui/label'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import { AlertCircle, Users, Wifi } from 'lucide-react'
import { Alert, AlertDescription } from '~/components/ui/alert'

interface WebRTCRoomManagerProps {
  signalingUrl?: string
  onConnect: (config: {
    signalingUrl: string
    roomCode?: string
    isHost: boolean
  }) => void
  onClose?: () => void
}

export function WebRTCRoomManager({ 
  signalingUrl = `ws://${window.location.hostname}:8081`,
  onConnect,
  onClose
}: WebRTCRoomManagerProps) {
  const [mode, setMode] = useState<'host' | 'join'>('host')
  const [roomCode, setRoomCode] = useState('')
  const [customSignalingUrl, setCustomSignalingUrl] = useState(signalingUrl)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  
  const generateRoomCode = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    setRoomCode(code)
    return code
  }, [])
  
  const handleConnect = useCallback(async () => {
    setError(null)
    setIsConnecting(true)
    
    try {
      if (mode === 'host') {
        // Generate room code if not provided
        const code = roomCode || generateRoomCode()
        await onConnect({
          signalingUrl: customSignalingUrl,
          roomCode: code,
          isHost: true
        })
      } else {
        // Join existing room
        if (!roomCode) {
          setError('Please enter a room code')
          setIsConnecting(false)
          return
        }
        
        await onConnect({
          signalingUrl: customSignalingUrl,
          roomCode,
          isHost: false
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
      setIsConnecting(false)
    }
  }, [mode, roomCode, customSignalingUrl, onConnect, generateRoomCode])
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          P2P Connection
        </CardTitle>
        <CardDescription>
          Connect directly to other Bassline editors
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'host' | 'join')}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="host" id="host" />
            <Label htmlFor="host" className="flex-1 cursor-pointer">
              <div className="font-medium">Host a session</div>
              <div className="text-sm text-muted-foreground">
                Create a new room for others to join
              </div>
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="join" id="join" />
            <Label htmlFor="join" className="flex-1 cursor-pointer">
              <div className="font-medium">Join a session</div>
              <div className="text-sm text-muted-foreground">
                Connect to an existing room
              </div>
            </Label>
          </div>
        </RadioGroup>
        
        <div className="space-y-2">
          <Label htmlFor="roomCode">
            Room Code {mode === 'host' && '(optional)'}
          </Label>
          <div className="flex gap-2">
            <Input
              id="roomCode"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder={mode === 'host' ? 'Auto-generate' : 'Enter code'}
              maxLength={6}
              disabled={isConnecting}
              className="font-mono text-lg tracking-wider"
            />
            {mode === 'host' && (
              <Button
                type="button"
                variant="outline"
                onClick={generateRoomCode}
                disabled={isConnecting}
              >
                Generate
              </Button>
            )}
          </div>
          {mode === 'host' && roomCode && (
            <p className="text-sm text-muted-foreground">
              Share this code with others to let them join
            </p>
          )}
        </div>
        
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? '▼' : '▶'} Advanced settings
          </button>
          
          {showAdvanced && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="signalingUrl">Signaling Server</Label>
              <Input
                id="signalingUrl"
                value={customSignalingUrl}
                onChange={(e) => setCustomSignalingUrl(e.target.value)}
                placeholder="ws://localhost:8081"
                disabled={isConnecting}
              />
              <p className="text-xs text-muted-foreground">
                WebSocket URL for the signaling server
              </p>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={handleConnect}
            disabled={isConnecting || (mode === 'join' && !roomCode)}
            className="flex-1"
          >
            {isConnecting ? (
              <>
                <Wifi className="h-4 w-4 mr-2 animate-pulse" />
                Connecting...
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4 mr-2" />
                {mode === 'host' ? 'Create Room' : 'Join Room'}
              </>
            )}
          </Button>
          
          {onClose && (
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isConnecting}
            >
              Cancel
            </Button>
          )}
        </div>
        
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> P2P connections work best on the same network. 
            For connections across the internet, you may need to configure port forwarding 
            or use a TURN server.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}