/**
 * EventBus
 *
 * Bridges application events to Borth hooks.
 * When an event is emitted, looks up registered hooks and executes them.
 */

import { getHooksForEvent, type Hook } from './CommandRegistry'

// Type for the Borth runtime
interface Runtime {
  dict: Record<string, { run: () => Promise<void>; attributes: Record<string, unknown> }>
  target: { write: (v: unknown) => void }
  runFresh: (word: { run: () => Promise<void> }, ...args: unknown[]) => Promise<void>
}

type ToastFn = (toast: {
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message?: string
  duration?: number
}) => void

interface EventBusOptions {
  runtime: Runtime
  showToast: ToastFn
}

/**
 * Create an EventBus instance bound to a Borth runtime
 */
export function createEventBus({ runtime, showToast }: EventBusOptions) {
  // Debounce/throttle state per event
  const debounceTimers = new Map<string, number>()
  const lastEmitTimes = new Map<string, number>()

  /**
   * Emit an event to all registered hooks
   */
  async function emit(event: string, payload: unknown = {}): Promise<void> {
    // Handle toast:show directly - no DB lookup needed
    if (event === 'toast:show') {
      const p = payload as { type?: string; message?: string }
      showToast({
        type: (p.type as 'info' | 'success' | 'warning' | 'error') ?? 'info',
        title: p.message ?? 'Notification',
      })
      return
    }

    const hooks = await getHooksForEvent(event)
    if (hooks.length === 0) return

    const errors: Array<{ command: string; error: Error }> = []

    for (const hook of hooks) {
      try {
        // Check debounce
        if (hook.debounce_ms) {
          const existing = debounceTimers.get(`${event}:${hook.command}`)
          if (existing) {
            clearTimeout(existing)
          }
          debounceTimers.set(
            `${event}:${hook.command}`,
            window.setTimeout(() => {
              executeHook(hook, payload)
            }, hook.debounce_ms)
          )
          continue
        }

        // Check throttle
        if (hook.throttle_ms) {
          const lastEmit = lastEmitTimes.get(`${event}:${hook.command}`)
          const now = Date.now()
          if (lastEmit && now - lastEmit < hook.throttle_ms) {
            continue
          }
          lastEmitTimes.set(`${event}:${hook.command}`, now)
        }

        await executeHook(hook, payload)
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e))
        errors.push({ command: hook.command, error })
        console.error(`Hook ${hook.command} failed:`, e)
      }
    }

    // Report errors after all hooks have run
    if (errors.length > 0) {
      showToast({
        type: 'error',
        title: `${errors.length} hook(s) failed on ${event}`,
        message: errors.map(e => `${e.command}: ${e.error.message}`).join('\n'),
        duration: 0, // sticky
      })
    }
  }

  async function executeHook(hook: Hook, payload: unknown): Promise<void> {
    const word = runtime.dict[hook.command]
    if (!word) {
      console.warn(`Hook command not found: ${hook.command}`)
      return
    }

    if (hook.run_async) {
      // Fire and forget - use runFresh for stack isolation, payload on stack
      runtime.runFresh(word, payload).catch(e => {
        console.error(`Async hook ${hook.command} failed:`, e)
        showToast({
          type: 'error',
          title: `Hook failed: ${hook.command}`,
          message: e instanceof Error ? e.message : String(e),
        })
      })
    } else {
      // Use runFresh for stack isolation, payload on stack
      await runtime.runFresh(word, payload)
    }
  }

  /**
   * Clean up any pending debounce timers
   */
  function cleanup(): void {
    for (const timer of debounceTimers.values()) {
      clearTimeout(timer)
    }
    debounceTimers.clear()
    lastEmitTimes.clear()
  }

  return { emit, cleanup }
}

/**
 * Standard event names used throughout the app
 */
export const Events = {
  // Buffer events
  BUFFER_OPEN: 'buffer:open',
  BUFFER_CLOSE: 'buffer:close',
  BUFFER_SAVE: 'buffer:save',
  BUFFER_CHANGE: 'buffer:change',
  BUFFER_FOCUS: 'buffer:focus',

  // Entity events
  ENTITY_SELECT: 'entity:select',
  ENTITY_CREATE: 'entity:create',
  ENTITY_UPDATE: 'entity:update',
  ENTITY_DELETE: 'entity:delete',

  // Project events
  PROJECT_OPEN: 'project:open',
  PROJECT_CLOSE: 'project:close',
  PROJECT_SWITCH: 'project:switch',

  // UI events
  WINDOW_FOCUS: 'window:focus',
  WINDOW_BLUR: 'window:blur',
  VIEW_CHANGE: 'view:change',
  SIDEBAR_TOGGLE: 'sidebar:toggle',
  THEME_CHANGE: 'theme:change',

  // Lifecycle events
  APP_READY: 'app:ready',
  APP_QUIT: 'app:quit',
  IDLE: 'idle',
  ACTIVE: 'active',

  // Timer events
  TICK_1S: 'tick:1s',
  TICK_1M: 'tick:1m',
  TICK_5M: 'tick:5m',
  TICK_1H: 'tick:1h',
} as const
