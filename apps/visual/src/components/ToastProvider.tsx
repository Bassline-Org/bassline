/**
 * ToastProvider
 *
 * Context provider for app-wide toast notifications.
 * Manages toast state, auto-dismiss timers, and provides showToast/dismissToast functions.
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { Toast, type ToastData } from './Toast'

interface ToastContextValue {
  toasts: ToastData[]
  showToast: (toast: Omit<ToastData, 'id'>) => string
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// Default durations by type
const DEFAULT_DURATION = {
  info: 3000,
  success: 3000,
  warning: 5000,
  error: 0, // sticky
}

let toastIdCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([])
  const timersRef = useRef<Map<string, number>>(new Map())

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer))
    }
  }, [])

  const dismissToast = useCallback((id: string) => {
    // Clear any existing timer
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }

    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((toast: Omit<ToastData, 'id'>): string => {
    const id = `toast-${++toastIdCounter}`
    const duration = toast.duration ?? DEFAULT_DURATION[toast.type]

    const newToast: ToastData = { ...toast, id }

    setToasts(prev => [...prev, newToast])

    // Set up auto-dismiss if duration > 0
    if (duration > 0) {
      const timer = window.setTimeout(() => {
        dismissToast(id)
      }, duration)
      timersRef.current.set(id, timer)
    }

    return id
  }, [dismissToast])

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}

      {/* Toast container - fixed to bottom-right */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

/**
 * Helper to create a toast from a command error
 */
export function commandErrorToast(commandName: string, error: Error | string): Omit<ToastData, 'id'> {
  const errorObj = error instanceof Error ? error : new Error(String(error))
  return {
    type: 'error',
    title: `Command failed: ${commandName}`,
    message: errorObj.message,
    detail: errorObj.stack,
    duration: 0, // sticky
  }
}
