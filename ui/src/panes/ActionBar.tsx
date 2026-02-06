import { useState } from 'react'
import { useComponents } from '../react/context'
import { useInspector } from '../hooks'
import { inspect } from '../core/inspect'
import type { PhlowButtonAction } from '../core/views'
import styles from '~/css/tools/ActionBar.module.css'

export interface ActionBarProps {
  /** Actions to render */
  actions: PhlowButtonAction[]
}

/**
 * Renders a horizontal bar of action buttons.
 * Only renders if there are actions to display.
 */
export function ActionBar({ actions }: ActionBarProps) {
  if (actions.length === 0) {
    return null
  }

  return (
    <div className={styles.actionBar}>
      {actions.map((action, i) => (
        <ActionButton key={i} action={action} />
      ))}
    </div>
  )
}

interface ActionButtonProps {
  action: PhlowButtonAction
}

function ActionButton({ action }: ActionButtonProps) {
  const { Button } = useComponents()
  const { inspect: inspectTarget } = useInspector()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enabled = action.isEnabled()

  const handleClick = async () => {
    if (!enabled || loading) return

    setLoading(true)
    setError(null)
    try {
      const result = action.onClick()

      if (result !== undefined) {
        const value = result instanceof Promise ? await result : result

        const viewable = inspect(value)
        if (viewable) {
          inspectTarget(viewable)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed'
      setError(message)
      setTimeout(() => setError(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      className={`${styles.actionButton} ${error ? styles.error : ''}`}
      disabled={!enabled || loading}
      onClick={handleClick}
      title={error ?? action.tooltip}
    >
      {action.icon && <span className={styles.icon}>{action.icon}</span>}
      <span className={styles.label}>{action.label}</span>
    </Button>
  )
}
