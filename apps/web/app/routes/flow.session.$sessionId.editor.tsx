import { useOutletContext, useLoaderData } from 'react-router'
import { Card } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import type { ClientLoaderFunctionArgs } from 'react-router'

// Editor-specific loader (can load additional data if needed)
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  console.log('[FlowSessionEditor] Loader called for editor view:', params.sessionId)
  
  // Editor-specific data loading can happen here
  // This loader runs IN ADDITION to the parent loader
  return {
    editorConfig: {
      gridSize: 20,
      snapToGrid: true,
      theme: 'light'
    }
  }
}


export default function FlowSessionEditor() {
  const context = useOutletContext<{ sessionId: string; sessionType: string }>()
  const editorData = useLoaderData<typeof clientLoader>()
  
  console.log('[FlowSessionEditor] Editor rendered:', {
    context,
    editorData
  })
  
  return (
    <div className="h-full p-4 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="h-full flex flex-col gap-4">
        {/* Toolbar */}
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline">Add Contact</Button>
              <Button size="sm" variant="outline">Add Group</Button>
              <Button size="sm" variant="outline">Add Gadget</Button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost">Undo</Button>
              <Button size="sm" variant="ghost">Redo</Button>
              <Button size="sm" variant="ghost">Export</Button>
            </div>
          </div>
        </Card>
        
        {/* Main editor area */}
        <Card className="flex-1 p-0 overflow-hidden">
          <div className="h-full flex items-center justify-center bg-white rounded-lg">
            <div className="text-center space-y-4">
              <div className="text-6xl">🎨</div>
              <h2 className="text-2xl font-semibold">Flow Editor</h2>
              <p className="text-muted-foreground max-w-md">
                This is where the React Flow editor will be integrated.
                The network client will be accessible from the parent route.
              </p>
              <div className="pt-4 space-y-2 text-sm text-left inline-block">
                <div><strong>Session ID:</strong> <code className="px-2 py-1 bg-slate-100 rounded">{context.sessionId}</code></div>
                <div><strong>Session Type:</strong> {context.sessionType}</div>
                <div><strong>Grid Size:</strong> {editorData?.editorConfig?.gridSize}px</div>
                <div><strong>Snap to Grid:</strong> {editorData?.editorConfig?.snapToGrid ? 'Yes' : 'No'}</div>
              </div>
            </div>
          </div>
        </Card>
        
        {/* Status bar */}
        <Card className="p-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>Ready</div>
            <div>0 nodes · 0 edges · Zoom: 100%</div>
          </div>
        </Card>
      </div>
    </div>
  )
}