import { Outlet, useParams, useLoaderData, Link, useLocation } from 'react-router'
import { ReactFlowProvider } from '@xyflow/react'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import type { ClientLoaderFunctionArgs } from 'react-router'
import { getOrCreateSession } from '~/lib/session-manager'
import '@xyflow/react/dist/style.css'

// Loader that fetches the specific group state
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sessionId = params.sessionId!
  const groupId = params.groupId!
  
  console.log('[FlowGroup] Loader called for group:', groupId, 'in session:', sessionId)
  
  // Get or create session (ensures single initialization)
  const session = await getOrCreateSession(sessionId)
  
  // Fetch the specific group state
  let groupState = null
  let error = null
  
  if (session.client) {
    try {
      groupState = await session.client.getState(groupId)
      console.log('[FlowGroup] Loaded group state for:', groupId)
    } catch (e) {
      console.error('[FlowGroup] Error loading group state:', e)
      error = e instanceof Error ? e.message : 'Failed to load group'
    }
  }
  
  return {
    sessionId: session.id,
    groupId,
    sessionType: session.type,
    createdAt: session.createdAt.toISOString(),
    status: session.status,
    client: session.client,
    groupState,
    error: error || session.error?.message
  }
}

export default function FlowGroupLayout() {
  const params = useParams()
  const loaderData = useLoaderData<typeof clientLoader>()
  const location = useLocation()
  
  console.log('[FlowGroup] Layout rendered:', {
    sessionId: params.sessionId,
    groupId: params.groupId,
    hasGroupState: !!loaderData.groupState,
    pathname: location.pathname
  })
  
  // Extract the current tab from the pathname
  const pathSegments = location.pathname.split('/')
  const currentTab = pathSegments[pathSegments.length - 1] === params.groupId ? 'editor' : pathSegments[pathSegments.length - 1]
  
  // Build breadcrumb path
  const buildBreadcrumbs = () => {
    const crumbs = []
    
    // Always start with root
    crumbs.push(
      <Link 
        key="root"
        to={`/flow/session/${params.sessionId}/group/root`}
        className={`text-sm ${params.groupId === 'root' ? 'font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
      >
        Root
      </Link>
    )
    
    // TODO: Add parent groups when we have group hierarchy
    if (params.groupId !== 'root' && loaderData.groupState?.group) {
      crumbs.push(
        <span key="separator" className="text-muted-foreground mx-1">/</span>,
        <span key="current" className="text-sm font-semibold">
          {loaderData.groupState.group.name || params.groupId}
        </span>
      )
    }
    
    return crumbs
  }
  
  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header with session/group info and navigation */}
      <div className="border-b bg-white shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/flow-experiment" className="text-sm text-muted-foreground hover:text-foreground">
                ← Back to Flow Experiment
              </Link>
              <div className="flex items-center gap-1">
                {buildBreadcrumbs()}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Session: <code className="px-2 py-1 bg-slate-100 rounded">{params.sessionId?.slice(0, 8)}</code>
            </div>
          </div>
          
          {/* Tab navigation */}
          <div className="mt-3">
            <Tabs value={currentTab}>
              <TabsList>
                <TabsTrigger value="editor" asChild>
                  <Link to={`/flow/session/${params.sessionId}/group/${params.groupId}`}>
                    Editor
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="properties" asChild>
                  <Link to={`/flow/session/${params.sessionId}/group/${params.groupId}/properties`}>
                    Properties
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="debug" asChild>
                  <Link to={`/flow/session/${params.sessionId}/group/${params.groupId}/debug`}>
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
        {loaderData.error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-600 bg-red-50 p-4 rounded-lg">
              <div className="font-semibold">Error loading group</div>
              <div className="text-sm mt-1">{loaderData.error}</div>
            </div>
          </div>
        ) : (
          <ReactFlowProvider>
            <Outlet context={{ 
              sessionId: params.sessionId, 
              groupId: params.groupId,
              ...loaderData 
            }} />
          </ReactFlowProvider>
        )}
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
            {loaderData?.groupState && (
              <div>
                Contacts: <span className="font-medium">
                  {loaderData.groupState.contacts?.size || 0}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}