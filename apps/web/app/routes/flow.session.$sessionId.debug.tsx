import { useOutletContext, useLoaderData } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import type { ClientLoaderFunctionArgs } from 'react-router'
import { listSessions } from '~/lib/session-manager'

// Debug-specific loader
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  console.log('[FlowSessionDebug] Loader called for debug view:', params.sessionId)
  
  // Get all active sessions for debugging
  const allSessions = listSessions()
  
  // Simulate loading debug data
  return {
    logs: [
      { timestamp: new Date().toISOString(), level: 'info', message: 'Session initialized' },
      { timestamp: new Date().toISOString(), level: 'debug', message: 'Network client created' },
      { timestamp: new Date().toISOString(), level: 'info', message: 'Connected to propagation network' },
    ],
    stats: {
      totalNodes: 0,
      totalEdges: 0,
      propagationCycles: 0,
      lastPropagationTime: null,
    },
    allSessions: allSessions.map(s => ({
      id: s.id,
      type: s.type,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      hasClient: !!s.client
    }))
  }
}


export default function FlowSessionDebug() {
  const context = useOutletContext<{ sessionId: string; sessionType: string; createdAt: string }>()
  const debugData = useLoaderData<typeof clientLoader>()
  
  console.log('[FlowSessionDebug] Debug view rendered:', {
    context,
    debugData
  })
  
  return (
    <div className="h-full p-4 bg-gradient-to-br from-slate-50 to-slate-100 overflow-auto">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Session Info */}
        <Card>
          <CardHeader>
            <CardTitle>Session Information</CardTitle>
            <CardDescription>
              Current session details and lifecycle information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Session ID:</span>
                <p className="font-mono text-xs mt-1">{context.sessionId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>
                <p className="font-medium mt-1">{context.sessionType}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>
                <p className="font-medium mt-1">{new Date(context.createdAt).toLocaleTimeString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Uptime:</span>
                <p className="font-medium mt-1">
                  {Math.floor((Date.now() - new Date(context.createdAt).getTime()) / 1000)}s
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Network Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Network Statistics</CardTitle>
            <CardDescription>
              Propagation network performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold">{debugData?.stats.totalNodes}</div>
                <div className="text-sm text-muted-foreground">Total Nodes</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold">{debugData?.stats.totalEdges}</div>
                <div className="text-sm text-muted-foreground">Total Edges</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold">{debugData?.stats.propagationCycles}</div>
                <div className="text-sm text-muted-foreground">Propagation Cycles</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold">
                  {debugData?.stats.lastPropagationTime || '—'}
                </div>
                <div className="text-sm text-muted-foreground">Last Propagation (ms)</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Event Log */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Event Log</CardTitle>
                <CardDescription>
                  Real-time events from the propagation network
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">Clear</Button>
                <Button size="sm" variant="outline">Export</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 font-mono text-xs">
              {debugData?.logs.map((log, index) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-slate-50 rounded">
                  <span className="text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <Badge 
                    variant={log.level === 'error' ? 'destructive' : log.level === 'warn' ? 'secondary' : 'default'}
                    className="font-mono text-xs"
                  >
                    {log.level}
                  </Badge>
                  <span className="flex-1">{log.message}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                Logs will appear here as the network processes events
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>
              All active propagation network sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {debugData?.allSessions?.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-mono text-sm">{session.id}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Type: {session.type} | Created: {new Date(session.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={session.status === 'ready' ? 'default' : 'secondary'}>
                      {session.status}
                    </Badge>
                    {session.hasClient && (
                      <Badge variant="outline">Client Active</Badge>
                    )}
                    {session.id === context.sessionId && (
                      <Badge variant="default">Current</Badge>
                    )}
                  </div>
                </div>
              ))}
              {(!debugData?.allSessions || debugData.allSessions.length === 0) && (
                <div className="text-center text-sm text-muted-foreground py-4">
                  No active sessions
                </div>
              )}
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Session Management:</strong> Each session ID creates exactly one network client instance.
                The session manager ensures clients are reused across navigation and hot reloads.
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Console Output */}
        <Card>
          <CardHeader>
            <CardTitle>Console Output</CardTitle>
            <CardDescription>
              Browser console messages (check DevTools console for live updates)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs">
              <div>[FlowSession] Loader called for session: {context.sessionId}</div>
              <div>[FlowSession] Layout rendered</div>
              <div>[FlowSessionDebug] Debug view rendered</div>
              <div className="mt-2 text-yellow-400">// More logs will appear in browser DevTools</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}