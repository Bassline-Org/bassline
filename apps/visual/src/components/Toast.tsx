/**
 * Toast Component
 *
 * Individual toast notification with variants for info, success, warning, error.
 * Error toasts can show expandable stack traces.
 */

import { useState } from 'react'
import { X, ChevronDown, ChevronUp, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ToastData {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message?: string
  detail?: string // expandable stack trace for errors
  duration?: number // auto-dismiss in ms (0 = sticky)
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastProps {
  toast: ToastData
  onDismiss: (id: string) => void
}

const icons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
}

const styles = {
  info: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100',
  success: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950 dark:border-green-800 dark:text-green-100',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-100',
  error: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-100',
}

const iconStyles = {
  info: 'text-blue-500',
  success: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const [expanded, setExpanded] = useState(false)
  const Icon = icons[toast.type]

  return (
    <div
      className={cn(
        'pointer-events-auto w-full max-w-sm rounded-lg border p-4 shadow-lg',
        'animate-in slide-in-from-right-full duration-300',
        styles[toast.type]
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', iconStyles[toast.type])} />

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{toast.title}</p>
          {toast.message && (
            <p className="mt-1 text-sm opacity-90">{toast.message}</p>
          )}

          {/* Expandable detail (for stack traces) */}
          {toast.detail && (
            <div className="mt-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Show details
                  </>
                )}
              </button>
              {expanded && (
                <pre className="mt-2 text-xs bg-black/10 dark:bg-white/10 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">
                  {toast.detail}
                </pre>
              )}
            </div>
          )}

          {/* Action button */}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="mt-2 text-sm font-medium underline underline-offset-2 hover:no-underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        <button
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 rounded-md p-1 opacity-50 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
