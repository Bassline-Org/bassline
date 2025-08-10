import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'

// This index route redirects to the editor by default
export default function FlowSessionIndex() {
  const navigate = useNavigate()
  const params = useParams()
  
  console.log('[FlowSessionIndex] Index route rendered, redirecting to editor')
  
  useEffect(() => {
    // Redirect to editor as the default view
    navigate(`/flow/session/${params.sessionId}/editor`, { replace: true })
  }, [navigate, params.sessionId])
  
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-muted-foreground">Redirecting to editor...</div>
    </div>
  )
}