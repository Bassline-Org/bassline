import { useState, useCallback, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { 
  Share2, 
  Copy, 
  Check, 
  Users, 
  Link
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'
import { useNetworkConfig } from '~/hooks/useNetworkConfig'
import { toast } from 'sonner'

export function ShareRoomButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [roomUrl, setRoomUrl] = useState<string>('')
  const [roomCode, setRoomCode] = useState<string>('')
  
  const config = useNetworkConfig()
  
  const generateRoomCode = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }, [])
  
  useEffect(() => {
    // Generate room URL based on current configuration
    if (config.mode === 'webrtc' && config.webrtc?.roomCode) {
      // Already in a WebRTC room
      const code = config.webrtc.roomCode
      setRoomCode(code)
      
      // Build shareable URL
      const url = new URL(window.location.href)
      url.searchParams.set('room', code)
      
      // Only include signaling URL if it's not the default
      const defaultSignalingUrl = `ws://${window.location.hostname}:8081`
      if (config.webrtc.signalingUrl && config.webrtc.signalingUrl !== defaultSignalingUrl) {
        url.searchParams.set('signal', config.webrtc.signalingUrl)
      }
      setRoomUrl(url.toString())
    } else if (config.mode === 'remote' && config.remoteUrl) {
      // Remote server mode - share server URL
      const url = new URL(window.location.href)
      url.searchParams.set('server', config.remoteUrl)
      setRoomUrl(url.toString())
    } else {
      // Generate a new room code for local/worker mode
      const code = generateRoomCode()
      setRoomCode(code)
      
      const url = new URL(window.location.href)
      url.searchParams.set('room', code)
      setRoomUrl(url.toString())
    }
  }, [config, generateRoomCode])
  
  /**
   * Copy text to clipboard
   * NOTE: Clipboard API is disabled on HTTP connections by browser security policy.
   * The fallback method using execCommand may also be restricted.
   * This feature works fully on HTTPS connections only.
   */
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (err) {
      // Fallback for non-HTTPS contexts - may still be blocked by browser
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      try {
        document.execCommand('copy')
        document.body.removeChild(textArea)
        return true
      } catch (err) {
        document.body.removeChild(textArea)
        return false
      }
    }
  }, [])
  
  const copyRoomCode = useCallback(async () => {
    const success = await copyToClipboard(roomCode)
    if (success) {
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
      toast.success('Room code copied!')
    } else {
      toast.error('Cannot copy on HTTP - manually select and copy the code')
    }
  }, [roomCode, copyToClipboard])
  
  const copyUrl = useCallback(async () => {
    const success = await copyToClipboard(roomUrl)
    if (success) {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
      toast.success('URL copied!')
    } else {
      toast.error('Cannot copy on HTTP - manually select and copy the URL')
    }
  }, [roomUrl, copyToClipboard])
  
  const shareViaWebShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Bassline session',
          text: `Join my collaborative Bassline session${roomCode ? ` with room code: ${roomCode}` : ''}`,
          url: roomUrl
        })
      } catch (err) {
        // User cancelled or share failed
        console.log('Share cancelled or failed:', err)
      }
    } else {
      // Fallback to copy
      copyUrl()
    }
  }, [roomUrl, roomCode, copyUrl])
  
  const getConnectionModeLabel = () => {
    switch (config.mode) {
      case 'webrtc':
        return 'P2P Connection'
      case 'remote':
        return 'Remote Server'
      case 'worker':
      default:
        return 'Local Session'
    }
  }
  
  const getConnectionModeDescription = () => {
    switch (config.mode) {
      case 'webrtc':
        return config.webrtc?.isHost 
          ? 'You are hosting a P2P session. Share this link for others to join directly.'
          : 'You are connected to a P2P session.'
      case 'remote':
        return 'Connected to a shared server. Anyone with this link can join the same session.'
      case 'worker':
      default:
        return 'Currently in local mode. Switch to P2P or Remote mode to collaborate.'
    }
  }
  
  const isShareable = config.mode === 'webrtc' || config.mode === 'remote'
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2"
          title="Share room"
        >
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Share Collaboration Session
          </DialogTitle>
          <DialogDescription>
            {getConnectionModeDescription()}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Connection Mode Badge */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Mode:</span>
            <span className="font-medium px-2 py-1 bg-secondary rounded">
              {getConnectionModeLabel()}
            </span>
          </div>
          
          {isShareable ? (
            <>
              {/* Room Code (for WebRTC) */}
              {config.mode === 'webrtc' && roomCode && (
                <div className="space-y-2">
                  <Label>Room Code</Label>
                  <div className="flex gap-2">
                    <Input
                      value={roomCode}
                      readOnly
                      className="font-mono text-lg tracking-wider"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyRoomCode}
                    >
                      {copiedCode ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this code for others to join via the connection menu
                  </p>
                </div>
              )}
              
              {/* Shareable URL */}
              <div className="space-y-2">
                <Label>Direct Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={roomUrl}
                    readOnly
                    className="text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyUrl}
                  >
                    {copiedUrl ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Anyone with this link can join your session directly
                </p>
              </div>
              
              {/* Share Actions */}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={shareViaWebShare}
                >
                  <Link className="h-4 w-4 mr-2" />
                  Share Link
                </Button>
                
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={copyUrl}
                >
                  {copiedUrl ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy URL
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            /* Not Shareable - Local Mode */
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                To collaborate with others, switch to P2P or Remote mode
              </p>
              <p className="text-sm text-muted-foreground">
                Use the connection button in the toolbar to change modes
              </p>
            </div>
          )}
        </div>
        
        {isShareable && (
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              <strong>Tip:</strong> Make sure all participants can access the {
                config.mode === 'webrtc' ? 'signaling server' : 'server URL'
              } for the connection to work.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}