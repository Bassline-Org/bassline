import { useNavigate, Link } from 'react-router'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'

export default function FlowExperiment() {
  const navigate = useNavigate()
  
  console.log('[FlowExperiment] Component rendered')
  
  const handleStartLocalSession = () => {
    const sessionId = `local-${Date.now()}`
    console.log('[FlowExperiment] Starting local session:', sessionId)
    navigate(`/flow/session/${sessionId}/editor`)
  }
  
  const handleStartRemoteSession = () => {
    const sessionId = `remote-${Date.now()}`
    console.log('[FlowExperiment] Starting remote session:', sessionId)
    navigate(`/flow/session/${sessionId}/editor`)
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <CardTitle className="text-3xl font-bold">Flow Experiment</CardTitle>
              <CardDescription className="text-lg mt-2">
                Choose how you want to start your propagation network session
              </CardDescription>
            </div>
            <Button variant="outline" asChild>
              <Link to="/session-manager">
                Manage Sessions →
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleStartLocalSession}>
              <CardHeader>
                <CardTitle className="text-xl">Local Session</CardTitle>
                <CardDescription>
                  Work locally in your browser with a Web Worker-based network
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" size="lg">
                  Start Local Session
                </Button>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleStartRemoteSession}>
              <CardHeader>
                <CardTitle className="text-xl">Remote Session</CardTitle>
                <CardDescription>
                  Connect to a remote Bassline server for collaboration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" size="lg" variant="outline">
                  Start Remote Session
                </Button>
              </CardContent>
            </Card>
          </div>
          
          <div className="text-center text-sm text-muted-foreground">
            <p>Session IDs will be generated automatically</p>
            <p className="mt-1">Navigate to: /flow/session/[session-id]</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}