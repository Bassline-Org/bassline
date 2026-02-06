import { useState, useEffect } from 'react'
import { useInspector } from '../../hooks'
import { inspect } from '../../core/inspect'

type PromiseState =
  | { status: 'pending' }
  | { status: 'resolved'; value: unknown }
  | { status: 'rejected'; error: unknown }

export interface PromiseViewProps {
  promise: Promise<unknown>
}

/**
 * React component that renders a Promise's state.
 * Shows loading while pending, auto-navigates on resolve, shows error on reject.
 */
export function PromiseView({ promise }: PromiseViewProps) {
  const [state, setState] = useState<PromiseState>({ status: 'pending' })
  const { inspect: inspectTarget } = useInspector()

  useEffect(() => {
    let cancelled = false

    promise
      .then(value => {
        if (cancelled) return
        setState({ status: 'resolved', value })

        // Auto-navigate to resolved value
        const viewable = inspect(value)
        if (viewable) {
          inspectTarget(viewable)
        }
      })
      .catch(error => {
        if (cancelled) return
        setState({ status: 'rejected', error })
      })

    return () => {
      cancelled = true
    }
  }, [promise, inspectTarget])

  if (state.status === 'pending') {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.7 }}>
        <div>Loading...</div>
      </div>
    )
  }

  if (state.status === 'rejected') {
    return (
      <div style={{ padding: '1rem', color: '#f66' }}>
        <div style={{ fontWeight: 600 }}>Error</div>
        <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          {state.error instanceof Error ? state.error.message : String(state.error)}
        </div>
      </div>
    )
  }

  // Resolved - show brief summary (navigation already triggered)
  return (
    <div style={{ padding: '1rem', opacity: 0.7 }}>
      <div>Loaded</div>
    </div>
  )
}
