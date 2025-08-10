import { useOutletContext } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Label } from '~/components/ui/label'
import { Input } from '~/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'

export default function FlowSessionProperties() {
  const context = useOutletContext<{ sessionId: string; sessionType: string }>()
  
  console.log('[FlowSessionProperties] Properties panel rendered:', context)
  
  return (
    <div className="h-full p-4 bg-gradient-to-br from-slate-50 to-slate-100 overflow-auto">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Property Inspector */}
        <Card>
          <CardHeader>
            <CardTitle>Property Inspector</CardTitle>
            <CardDescription>
              View and edit properties of selected nodes and connections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-4xl mb-3">📝</div>
              <p>No element selected</p>
              <p className="text-sm mt-2">Select a node or edge in the editor to view its properties</p>
            </div>
          </CardContent>
        </Card>
        
        {/* Session Properties */}
        <Card>
          <CardHeader>
            <CardTitle>Session Properties</CardTitle>
            <CardDescription>
              Configure session-wide settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="session-name">Session Name</Label>
              <Input 
                id="session-name" 
                defaultValue={context.sessionId}
                placeholder="Enter session name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="scheduler">Scheduler Type</Label>
              <Select defaultValue="immediate">
                <SelectTrigger id="scheduler">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="batch">Batch</SelectItem>
                  <SelectItem value="async">Async</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-save">Auto-save</Label>
              <Switch id="auto-save" />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="show-debug">Show Debug Info</Label>
              <Switch id="show-debug" />
            </div>
          </CardContent>
        </Card>
        
        {/* Network Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Network Configuration</CardTitle>
            <CardDescription>
              Connection and propagation settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Session Type:</span>
                <p className="font-medium">{context.sessionType}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Session ID:</span>
                <p className="font-mono text-xs">{context.sessionId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Connection Status:</span>
                <p className="font-medium text-green-600">Connected</p>
              </div>
              <div>
                <span className="text-muted-foreground">Propagation Mode:</span>
                <p className="font-medium">Bidirectional</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}