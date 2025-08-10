import { UIAdapter } from '~/network/ui-adapter'
import { KernelClient } from '~/network/kernel-client'
import type { ContactChange } from '@bassline/core'

export interface Session {
  id: string
  type: 'local' | 'remote'
  client: UIAdapter | null
  kernelClient: KernelClient | null
  createdAt: Date
  status: 'initializing' | 'ready' | 'error'
  error?: Error
}

// In-memory session store (survives hot reloads in dev mode)
const sessions = new Map<string, Session>()

// Make sessions available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).__BASSLINE_SESSIONS__ = sessions
}

/**
 * Get or create a session
 * This ensures each session ID only creates one network client
 */
export async function getOrCreateSession(sessionId: string, remoteUrl?: string): Promise<Session> {
  console.log('[SessionManager] getOrCreateSession called for:', sessionId)
  
  // Check if session already exists
  const existing = sessions.get(sessionId)
  if (existing) {
    console.log('[SessionManager] Returning existing session:', {
      id: existing.id,
      status: existing.status,
      hasClient: !!existing.client
    })
    return existing
  }
  
  // Create new session
  console.log('[SessionManager] Creating new session:', sessionId)
  
  const sessionType = sessionId.startsWith('local') ? 'local' : 'remote'
  const session: Session = {
    id: sessionId,
    type: sessionType as 'local' | 'remote',
    client: null,
    kernelClient: null,
    createdAt: new Date(),
    status: 'initializing'
  }
  
  // Store session immediately to prevent duplicate creation
  sessions.set(sessionId, session)
  
  // Initialize network client based on session type
  try {
    if (sessionType === 'local') {
      console.log('[SessionManager] Creating local kernel client for session:', sessionId)
      
      const kernelClient = new KernelClient({
        mode: 'local',
        onReady: async () => {
          console.log('[SessionManager] Local kernel ready for session:', sessionId)
          
          // Subscribe to root group for changes
          try {
            await kernelClient.subscribe('root')
            console.log('[SessionManager] Subscribed to root group for session:', sessionId)
          } catch (e) {
            console.log('[SessionManager] Root subscription handled by kernel')
          }
          
          session.status = 'ready'
        },
        onChanges: (changes: ContactChange[]) => {
          // Changes are handled by UIAdapter
          // console.log('[SessionManager] Changes for session', sessionId, ':', changes.length)
        },
        onError: (error: Error) => {
          console.error('[SessionManager] Kernel error for session', sessionId, ':', error)
          session.status = 'error'
          session.error = error
        }
      })
      
      const uiAdapter = new UIAdapter({ kernelClient })
      
      // Store clients in session
      session.kernelClient = kernelClient
      session.client = uiAdapter
      
      // Initialize UI adapter
      await uiAdapter.initialize()
      console.log('[SessionManager] Local UI adapter initialized for session:', sessionId)
      
    } else if (sessionType === 'remote') {
      if (!remoteUrl) {
        throw new Error('Remote URL required for remote sessions')
      }
      
      console.log('[SessionManager] Creating remote kernel client for session:', sessionId, 'URL:', remoteUrl)
      
      const kernelClient = new KernelClient({
        mode: 'remote',
        url: remoteUrl,
        onReady: () => {
          console.log('[SessionManager] Remote kernel ready for session:', sessionId)
          session.status = 'ready'
        },
        onChanges: (changes: ContactChange[]) => {
          // Changes are handled by UIAdapter
          // console.log('[SessionManager] Changes for session', sessionId, ':', changes.length)
        },
        onError: (error: Error) => {
          console.error('[SessionManager] Kernel error for session', sessionId, ':', error)
          session.status = 'error'
          session.error = error
        }
      })
      
      const uiAdapter = new UIAdapter({ kernelClient })
      
      // Store clients in session
      session.kernelClient = kernelClient
      session.client = uiAdapter
      
      // Initialize UI adapter
      await uiAdapter.initialize()
      console.log('[SessionManager] Remote UI adapter initialized for session:', sessionId)
    }
    
  } catch (error) {
    console.error('[SessionManager] Failed to create network client for session', sessionId, ':', error)
    session.status = 'error'
    session.error = error instanceof Error ? error : new Error(String(error))
  }
  
  return session
}

/**
 * Get an existing session
 */
export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId)
}

/**
 * List all active sessions
 */
export function listSessions(): Session[] {
  return Array.from(sessions.values())
}

/**
 * Destroy a session and clean up its resources
 */
export function destroySession(sessionId: string): boolean {
  console.log('[SessionManager] Destroying session:', sessionId)
  
  const session = sessions.get(sessionId)
  if (!session) {
    return false
  }
  
  // Clean up UI adapter if it exists
  if (session.client) {
    try {
      console.log('[SessionManager] Terminating UI adapter for session:', sessionId)
      session.client.terminate()
    } catch (error) {
      console.error('[SessionManager] Error terminating UI adapter:', error)
    }
  }
  
  // Clean up kernel client if it exists
  if (session.kernelClient) {
    try {
      console.log('[SessionManager] Terminating kernel client for session:', sessionId)
      session.kernelClient.terminate()
    } catch (error) {
      console.error('[SessionManager] Error terminating kernel client:', error)
    }
  }
  
  sessions.delete(sessionId)
  console.log('[SessionManager] Session destroyed:', sessionId)
  return true
}

/**
 * Destroy all sessions (useful for cleanup)
 */
export function destroyAllSessions(): void {
  console.log('[SessionManager] Destroying all sessions')
  
  for (const sessionId of sessions.keys()) {
    destroySession(sessionId)
  }
}