import { createContext, useContext, createSignal, For, ParentProps, onCleanup } from 'solid-js'
import { Portal } from 'solid-js/web'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: {
    success: (msg: string) => void
    error: (msg: string) => void
    info: (msg: string) => void
  }
}

const ToastContext = createContext<ToastContextValue>()

export function ToastProvider(props: ParentProps) {
  const [toasts, setToasts] = createSignal<Toast[]>([])
  let nextId = 0

  const addToast = (message: string, type: ToastType) => {
    const id = nextId++
    setToasts(t => [...t, { id, message, type }])

    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id))
    }, 4000)

    onCleanup(() => clearTimeout(timer))
  }

  const removeToast = (id: number) => {
    setToasts(t => t.filter(x => x.id !== id))
  }

  const toast = {
    success: (msg: string) => addToast(msg, 'success'),
    error: (msg: string) => addToast(msg, 'error'),
    info: (msg: string) => addToast(msg, 'info')
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {props.children}
      <Portal>
        <div class="toast-container">
          <For each={toasts()}>
            {t => (
              <div class={`toast toast-${t.type}`} onClick={() => removeToast(t.id)}>
                <span class="toast-icon">
                  {t.type === 'success' && '✓'}
                  {t.type === 'error' && '✕'}
                  {t.type === 'info' && 'ℹ'}
                </span>
                <span class="toast-message">{t.message}</span>
              </div>
            )}
          </For>
        </div>
      </Portal>
      <style>{`
        .toast-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 8px;
          pointer-events: none;
        }

        .toast {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          pointer-events: auto;
          cursor: pointer;
          animation: toast-in 0.3s ease-out;
          transition: transform 0.2s, opacity 0.2s;
        }

        .toast:hover {
          transform: translateX(-4px);
        }

        @keyframes toast-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .toast-success {
          background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
          color: #fff;
          border: 1px solid #3fb950;
        }

        .toast-error {
          background: linear-gradient(135deg, #da3633 0%, #f85149 100%);
          color: #fff;
          border: 1px solid #f85149;
        }

        .toast-info {
          background: linear-gradient(135deg, #1f6feb 0%, #388bfd 100%);
          color: #fff;
          border: 1px solid #58a6ff;
        }

        .toast-icon {
          font-size: 16px;
          font-weight: bold;
        }

        .toast-message {
          flex: 1;
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
