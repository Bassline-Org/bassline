import { useCallback, useEffect, useState } from 'react'
import { useBlocker, useBeforeUnload } from 'react-router'
import { listSessions } from '~/lib/session-manager'

/**
 * Hook to protect against accidentally losing active sessions
 * Works at the app root level since sessions persist across all routes
 */
export function useSessionProtection() {
  const [hasActiveSessions, setHasActiveSessions] = useState(false)
  
  // Check for active sessions periodically
  useEffect(() => {
    const checkSessions = () => {
      const sessions = listSessions()
      const hasActive = sessions.some(s => 
        s.status === 'ready' && s.client !== null
      )
      setHasActiveSessions(hasActive)
    }
    
    // Initial check
    checkSessions()
    
    // Check every 2 seconds for session changes
    const interval = setInterval(checkSessions, 2000)
    
    return () => clearInterval(interval)
  }, [])
  
  // For now, don't block SPA navigation since users might want to
  // navigate between session manager, flow-experiment, etc.
  // Only protect against browser refresh/close
  const blocker = useBlocker(() => false)
  
  // Block browser refresh/close when there are active sessions
  // This will show the browser's native confirmation dialog
  useBeforeUnload(
    useCallback((e: BeforeUnloadEvent) => {
      if (hasActiveSessions) {
        console.log('[SessionProtection] Blocking page unload - active sessions exist')
        // Modern browsers show a generic message, not custom text
        e.preventDefault()
        // Legacy support (some browsers might use this)
        e.returnValue = 'You have active propagation network sessions. Are you sure you want to leave?'
        return e.returnValue
      }
    }, [hasActiveSessions]),
    { capture: true }
  )
  
  return { 
    blocker, 
    hasActiveSessions,
    sessionCount: hasActiveSessions ? listSessions().length : 0
  }
}