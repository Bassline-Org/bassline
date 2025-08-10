import { useEffect, useState } from 'react'
import { useOutletContext, useLoaderData, useRevalidator } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Undo2, Redo2, History } from 'lucide-react'
import type { ClientLoaderFunctionArgs } from 'react-router'
import { listSessions } from '~/lib/session-manager'

// Debug-specific loader
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  console.log('[FlowGroupDebug] Loader called for debug view - session:', params.sessionId, 'group:', params.groupId)
  
  // Get all active sessions for debugging
  const allSessions = listSessions()
  
  // Get the client for this session to read actual network state
  const sessionId = params.sessionId!
  const groupId = params.groupId!
  const client = (window as any).__BASSLINE_SESSIONS__?.get(sessionId)?.client
  
  let stats = {
    totalNodes: 0,
    totalEdges: 0,
    propagationCycles: 0,
    lastPropagationTime: null as number | null,
  }
  
  // If client exists, fetch real network state for this group
  if (client) {
    try {
      const state = await client.getState(groupId)
      console.log('[FlowGroupDebug] Fetched network state for group:', groupId, state)
      
      // Count actual contacts
      if (state.contacts instanceof Map) {
        stats.totalNodes = state.contacts.size
      }
      
      // Count actual wires
      if (state.wires instanceof Map) {
        stats.totalEdges = state.wires.size
      }
      
      // Add subgroups to node count
      if (state.group && Array.isArray(state.group.subgroupIds)) {
        stats.totalNodes += state.group.subgroupIds.length
      }
    } catch (error) {
      console.error('[FlowSessionDebug] Error fetching network state:', error)
    }
  }
  
  return {
    logs: [
      { timestamp: new Date().toISOString(), level: 'info', message: 'Session initialized' },
      { timestamp: new Date().toISOString(), level: 'debug', message: 'Network client created' },
      { timestamp: new Date().toISOString(), level: 'info', message: 'Connected to propagation network' },
    ],
    stats,
    allSessions: allSessions.map(s => ({
      id: s.id,
      type: s.type,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      hasClient: !!s.client
    }))
  }
}


export default function FlowGroupDebug() {
  const context = useOutletContext<{ sessionId: string; groupId: string; sessionType: string; createdAt: string; client: any }>()
  const debugData = useLoaderData<typeof clientLoader>()
  const revalidator = useRevalidator()
  const [historyStatus, setHistoryStatus] = useState<{ canUndo: boolean; canRedo: boolean; history: any[] }>({
    canUndo: false,
    canRedo: false,
    history: []
  })
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [loadingAction, setLoadingAction] = useState<'undo' | 'redo' | 'refresh' | 'jump' | null>(null)
  
  console.log('[FlowGroupDebug] Debug view rendered:', {
    sessionId: context.sessionId,
    groupId: context.groupId,
    debugData
  })
  
  // Get client from context or window
  const client = context.client || (window as any).__BASSLINE_SESSIONS__?.get(context.sessionId)?.client
  
  // Fetch history status
  const fetchHistoryStatus = async () => {
    if (!client) return
    try {
      const status = await client.getHistoryStatus()
      setHistoryStatus(status)
    } catch (error) {
      console.error('[FlowGroupDebug] Error fetching history status:', error)
    }
  }
  
  // Handle undo
  const handleUndo = async () => {
    if (!client || isLoadingHistory) return
    setIsLoadingHistory(true)
    try {
      const result = await client.undo()
      console.log('[FlowGroupDebug] Undo result:', result)
      await fetchHistoryStatus()
      revalidator.revalidate()
    } catch (error) {
      console.error('[FlowGroupDebug] Error during undo:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }
  
  // Handle redo
  const handleRedo = async () => {
    if (!client || isLoadingHistory) return
    setIsLoadingHistory(true)
    try {
      const result = await client.redo()
      console.log('[FlowGroupDebug] Redo result:', result)
      await fetchHistoryStatus()
      revalidator.revalidate()
    } catch (error) {
      console.error('[FlowGroupDebug] Error during redo:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }
  
  // Handle selective undo of a specific action
  const handleSelectiveUndo = async (targetIndex: number) => {
    if (!client || isLoadingHistory) return
    setIsLoadingHistory(true)
    try {
      // For now, we'll jump to that point in history
      // In the future, we could implement true selective undo
      // that only undoes that specific operation
      const currentIdx = historyStatus.currentIndex ?? -1
      const steps = targetIndex - currentIdx
      
      if (steps < 0) {
        // Need to undo to get to this point
        for (let i = 0; i < Math.abs(steps); i++) {
          await client.undo()
        }
      } else if (steps > 0) {
        // Need to redo to get to this point
        for (let i = 0; i < steps; i++) {
          await client.redo()
        }
      }
      
      await fetchHistoryStatus()
      revalidator.revalidate()
    } catch (error) {
      console.error('[FlowGroupDebug] Error in selective undo:', error)
    } finally {
      setLoadingAction(null)
    }
  }
  
  // Subscribe to network changes for real-time updates for this group
  useEffect(() => {
    if (!client || !context.groupId) return
    
    console.log('[FlowGroupDebug] Setting up subscription for group:', context.groupId)
    const unsubscribe = client.subscribe(context.groupId, (changes: any[]) => {
      console.log('[FlowGroupDebug] Network changes detected in group:', context.groupId, ':', changes.length, 'changes')
      // Revalidate to get fresh stats
      revalidator.revalidate()
      // Also refresh history status
      fetchHistoryStatus()
    })
    
    return () => {
      console.log('[FlowGroupDebug] Cleaning up subscription for group:', context.groupId)
      unsubscribe()
    }
  }, [client, context.groupId, revalidator])
  
  // Fetch history status on mount
  useEffect(() => {
    fetchHistoryStatus()
  }, [client])
  
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
                <span className="text-muted-foreground">Group ID:</span>
                <p className="font-mono text-xs mt-1">{context.groupId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>
                <p className="font-medium mt-1">{context.sessionType}</p>
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
        
        {/* History Pane */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  History
                </CardTitle>
                <CardDescription>
                  Undo/redo operations and history timeline
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleUndo}
                  disabled={!historyStatus.canUndo || loadingAction === 'undo'}
                >
                  <Undo2 className="h-4 w-4 mr-1" />
                  {loadingAction === 'undo' ? 'Undoing...' : 'Undo'}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleRedo}
                  disabled={!historyStatus.canRedo || loadingAction === 'redo'}
                >
                  <Redo2 className="h-4 w-4 mr-1" />
                  {loadingAction === 'redo' ? 'Redoing...' : 'Redo'}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    setLoadingAction('refresh')
                    fetchHistoryStatus().finally(() => setLoadingAction(null))
                  }}
                  disabled={loadingAction === 'refresh'}
                >
                  {loadingAction === 'refresh' ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full">
              <div className="space-y-2">
                {historyStatus.history && historyStatus.history.length > 0 ? (
                  historyStatus.history.map((entry, index) => {
                    const isCurrent = index === historyStatus.currentIndex
                    const isFuture = index > (historyStatus.currentIndex ?? -1)
                    
                    return (
                      <div
                        key={index}
                        className={`
                          flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                          ${isCurrent ? 'bg-blue-50 border border-blue-200' : 
                            isFuture ? 'bg-gray-50 opacity-50' : 'bg-slate-50 hover:bg-slate-100'}
                        `}
                        onClick={() => !isCurrent && handleSelectiveUndo(index)}
                      >
                        <div className="flex-shrink-0">
                          <div className={`
                            w-2 h-2 rounded-full
                            ${isCurrent ? 'bg-blue-500' : 
                              isFuture ? 'bg-gray-300' : 'bg-green-500'}
                          `} />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {entry.description}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-xs">
                          {isCurrent && (
                            <Badge variant="default" className="text-xs">Current</Badge>
                          )}
                          {isFuture && (
                            <Badge variant="secondary" className="text-xs">Future</Badge>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      No history available yet. Operations will appear here as you make changes.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>Total: {historyStatus.history?.length || 0} operations</span>
              <span>
                Position: {(historyStatus.currentIndex ?? -1) + 1} / {historyStatus.history?.length || 0}
              </span>
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