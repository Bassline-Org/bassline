import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import type { Session } from '~/lib/session-manager'

interface SessionCardProps {
  session: Session
  onResume: () => void
  onDelete: () => void
}

export function SessionCard({ session, onResume, onDelete }: SessionCardProps) {
  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'ready':
        return 'default'
      case 'initializing':
        return 'secondary'
      case 'error':
        return 'destructive'
      default:
        return 'outline'
    }
  }
  
  const getTypeIcon = (type: Session['type']) => {
    return type === 'local' ? '💻' : '🌐'
  }
  
  const formatDuration = (createdAt: Date) => {
    const now = new Date()
    const diff = now.getTime() - createdAt.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`
    } else if (minutes > 0) {
      return `${minutes}m ago`
    } else {
      return 'Just now'
    }
  }
  
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getTypeIcon(session.type)}</span>
            <div>
              <CardTitle className="text-lg">
                {session.type === 'local' ? 'Local' : 'Remote'} Session
              </CardTitle>
              <CardDescription className="font-mono text-xs mt-1">
                {session.id}
              </CardDescription>
            </div>
          </div>
          <Badge variant={getStatusColor(session.status)}>
            {session.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span className="font-medium">{formatDuration(session.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type:</span>
            <span className="font-medium capitalize">{session.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Client:</span>
            <span className="font-medium">
              {session.client ? '✅ Active' : '⏸️ Not initialized'}
            </span>
          </div>
          {session.error && (
            <div className="mt-2 p-2 bg-red-50 rounded text-red-700 text-xs">
              Error: {session.error.message}
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-2">
        <Button 
          className="flex-1" 
          onClick={onResume}
          disabled={session.status === 'error'}
        >
          Resume
        </Button>
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={onDelete}
        >
          Delete
        </Button>
      </CardFooter>
    </Card>
  )
}