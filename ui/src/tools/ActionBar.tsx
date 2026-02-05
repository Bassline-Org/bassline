import { useState } from 'react'
import { useComponents } from '../react/context'
import type { ButtonAction } from '../core/types'
import styles from '~/css/tools/ActionBar.module.css'

export interface ActionBarProps {
  /** Actions to render (only ButtonActions are supported) */
  actions: ButtonAction[]
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
  action: ButtonAction
}

function ActionButton({ action }: ActionButtonProps) {
  const { Button } = useComponents()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enabled = action.enabled?.() ?? true

  const handleClick = async () => {
    if (!enabled || loading) return

    setLoading(true)
    setError(null)
    try {
      await action.onClick()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed'
      setError(message)
      // Clear error after 3 seconds
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
