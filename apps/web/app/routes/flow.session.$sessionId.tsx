import { Outlet, useParams, useLoaderData, Link, useLocation } from 'react-router'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import type { ClientLoaderFunctionArgs } from 'react-router'
import { getOrCreateSession } from '~/lib/session-manager'

// Loader that will eventually hold the network client
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sessionId = params.sessionId!
  console.log('[FlowSession] Loader called for session:', sessionId)
  
  // Get or create session (ensures single initialization)
  const session = await getOrCreateSession(sessionId)
  
  console.log('[FlowSession] Session state:', {
    id: session.id,
    status: session.status,
    isNew: session.createdAt.getTime() > Date.now() - 1000
  })
  
  return {
    sessionId: session.id,
    sessionType: session.type,
    createdAt: session.createdAt.toISOString(),
    status: session.status,
    client: session.client, // Now this is the actual UIAdapter instance!
    error: session.error?.message
  }
}


export default function FlowSessionLayout() {
  const params = useParams()
  const loaderData = useLoaderData<typeof clientLoader>()
  const location = useLocation()
  
  console.log('[FlowSession] Layout rendered:', {
    sessionId: params.sessionId,
    loaderData,
    pathname: location.pathname
  })
  
  // Extract the current tab from the pathname
  const currentTab = location.pathname.split('/').pop() || 'editor'
  
  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header with session info and navigation */}
      <div className="border-b bg-white shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/flow-experiment" className="text-sm text-muted-foreground hover:text-foreground">
                ← Back to Flow Experiment
              </Link>
              <div className="text-sm">
                <span className="font-medium">Session:</span>{' '}
                <code className="px-2 py-1 bg-slate-100 rounded">{params.sessionId}</code>
                <span className="ml-3 text-muted-foreground">
                  Type: <span className="font-medium">{loaderData?.sessionType}</span>
                </span>
              </div>
            </div>
          </div>
          
          {/* Tab navigation */}
          <div className="mt-3">
            <Tabs value={currentTab}>
              <TabsList>
                <TabsTrigger value="editor" asChild>
                  <Link to={`/flow/session/${params.sessionId}/editor`}>
                    Editor
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="properties" asChild>
                  <Link to={`/flow/session/${params.sessionId}/properties`}>
                    Properties
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="debug" asChild>
                  <Link to={`/flow/session/${params.sessionId}/debug`}>
                    Debug
                  </Link>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>
      
      {/* Child route content */}
      <div className="flex-1 overflow-hidden">
        <Outlet context={{ sessionId: params.sessionId, ...loaderData }} />
      </div>
      
      {/* Status bar */}
      <div className="border-t bg-white px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <div>
            Session started: {new Date(loaderData?.createdAt).toLocaleTimeString()}
          </div>
          <div className="flex items-center gap-4">
            <div>
              Status: <span className={`font-medium ${
                loaderData?.status === 'ready' ? 'text-green-600' : 
                loaderData?.status === 'error' ? 'text-red-600' : 
                'text-yellow-600'
              }`}>
                {loaderData?.status === 'ready' ? 'Active' : 
                 loaderData?.status === 'error' ? 'Error' : 
                 'Initializing'}
              </span>
            </div>
            <div>
              Network: <span className="font-medium">
                {loaderData?.client ? '✅ Connected' : '⏳ Connecting...'}
              </span>
            </div>
            {loaderData?.error && (
              <div className="text-red-600">
                Error: {loaderData.error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}