import { useState } from 'react'
import { useComponents } from '../context'
import type { Action, ButtonAction } from '../../core/types'
import styles from './ActionBar.module.css'

export interface ActionBarProps {
  actions: Action[]
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
      {actions.map((action, i) => (action.phlow === 'buttonAction' ? <ActionButton key={i} action={action} /> : null))}
    </div>
  )
}

interface ActionButtonProps {
  action: ButtonAction
}

function ActionButton({ action }: ActionButtonProps) {
  const { Button } = useComponents()
  const [loading, setLoading] = useState(false)
  const enabled = action.enabled?.() ?? true

  const handleClick = async () => {
    if (!enabled || loading) return

    setLoading(true)
    try {
      await action.onClick()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button className={styles.actionButton} disabled={!enabled || loading} onClick={handleClick} title={action.tooltip}>
      {action.icon && <span className={styles.icon}>{action.icon}</span>}
      <span className={styles.label}>{action.label}</span>
    </Button>
  )
}
