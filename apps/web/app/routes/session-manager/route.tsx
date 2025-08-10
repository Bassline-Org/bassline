import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { listSessions, destroySession, type Session } from '~/lib/session-manager'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { SessionCard } from './session-card'
import type { ClientLoaderFunctionArgs } from 'react-router'

// Load all sessions
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  console.log('[SessionManager] Loading all sessions')
  const sessions = listSessions()
  return { sessions }
}

export default function SessionManager() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<Session[]>([])
  
  // Load sessions on mount and set up polling
  useEffect(() => {
    const loadSessions = () => {
      const allSessions = listSessions()
      setSessions(allSessions)
      console.log('[SessionManager] Loaded sessions:', allSessions.length)
    }
    
    // Initial load
    loadSessions()
    
    // Poll for updates every 2 seconds
    const interval = setInterval(loadSessions, 2000)
    
    return () => clearInterval(interval)
  }, [])
  
  const handleResume = (sessionId: string) => {
    console.log('[SessionManager] Resuming session:', sessionId)
    // Navigate to session which redirects to /group/root
    navigate(`/flow/session/${sessionId}`)
  }
  
  const handleDelete = (sessionId: string) => {
    console.log('[SessionManager] Deleting session:', sessionId)
    const success = destroySession(sessionId)
    if (success) {
      setSessions(sessions.filter(s => s.id !== sessionId))
    }
  }
  
  const localSessions = sessions.filter(s => s.type === 'local')
  const remoteSessions = sessions.filter(s => s.type === 'remote')
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">Session Manager</h1>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link to="/flow-experiment">← Back to Flow Experiment</Link>
              </Button>
              <Button onClick={() => {
                const sessionId = `local-${Date.now()}`
                console.log('[SessionManager] Creating new session:', sessionId)
                navigate(`/flow/session/${sessionId}`)
              }}>
                + New Session
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">
            Manage your active propagation network sessions. Resume existing sessions or create new ones.
          </p>
        </div>
        
        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Total Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{sessions.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Local Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{localSessions.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Remote Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{remoteSessions.length}</div>
            </CardContent>
          </Card>
        </div>
        
        {/* Local Sessions */}
        {localSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Local Sessions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {localSessions.map(session => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onResume={() => handleResume(session.id)}
                  onDelete={() => handleDelete(session.id)}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Remote Sessions */}
        {remoteSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Remote Sessions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {remoteSessions.map(session => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onResume={() => handleResume(session.id)}
                  onDelete={() => handleDelete(session.id)}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Empty State */}
        {sessions.length === 0 && (
          <Card className="p-12">
            <div className="text-center">
              <div className="text-6xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold mb-2">No Active Sessions</h3>
              <p className="text-muted-foreground mb-6">
                Start a new propagation network session to begin working with Bassline.
              </p>
              <Button size="lg" onClick={() => {
                const sessionId = `local-${Date.now()}`
                console.log('[SessionManager] Creating first session:', sessionId)
                navigate(`/flow/session/${sessionId}`)
              }}>
                Start Your First Session
              </Button>
            </div>
          </Card>
        )}
        
        {/* Info Card */}
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">About Sessions</CardTitle>
          </CardHeader>
          <CardContent className="text-blue-800">
            <p className="mb-2">
              Each session represents an independent propagation network with its own state and connections.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Sessions persist across navigation and tab changes</li>
              <li>Resume any session by clicking the Resume button</li>
              <li>Session URLs can be bookmarked and shared</li>
              <li>Delete sessions when no longer needed to free resources</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}