import { redirect } from 'react-router'
import type { ClientLoaderFunctionArgs } from 'react-router'

// Redirect from session to the root group
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sessionId = params.sessionId!
  console.log('[FlowSession] Redirecting to root group for session:', sessionId)
  
  // Redirect to the root group
  return redirect(`/flow/session/${sessionId}/group/root`)
}

export default function FlowSessionIndex() {
  // This component will never render due to the redirect
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-muted-foreground">Redirecting to root group...</div>
    </div>
  )
}