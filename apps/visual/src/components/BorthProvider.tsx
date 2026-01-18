/**
 * BorthProvider
 *
 * Context provider for borth runtime with command system, event bus, and keybindings.
 * This is the single provider for all Borth functionality.
 */

import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
// @ts-expect-error - borth.js has no type declarations
import { createRuntime } from '../lib/borth'
import { registerCommand, registerHook, registerSetting } from '../lib/CommandRegistry'
import { createEventBus, Events } from '../lib/EventBus'
import { useToast } from './ToastProvider'
import { CommandPalette } from './CommandPalette'
import { useKeybindings } from '../hooks/useKeybindings'

// Re-export CommandRegistry functions for convenience
export {
  getCommands,
  getCommandByKey,
  hasChordStartingWith,
  getHooksForEvent,
  getSettings,
  updateSetting,
  type Command,
  type Hook,
  type Setting,
} from '../lib/CommandRegistry'

// Re-export Events for convenience
export { Events }

type Runtime = ReturnType<typeof createRuntime>

interface BorthContextValue {
  rt: Runtime
  run: (code?: string) => Promise<void>
  runCommand: (name: string, args?: unknown[]) => Promise<{ success: boolean; error?: string }>
  emit: (event: string, payload?: unknown) => Promise<void>
  openCommandPalette: () => void
  reset: () => void
}

const BorthContext = createContext<BorthContextValue | null>(null)

interface BorthProviderProps {
  children: ReactNode
  initSource?: string
}

// Helper to create a configured runtime with db access
function createConfiguredRuntime() {
  const rt = createRuntime()
  // Expose db for editor vocab's query word (if available in Electron context)
  if (typeof window !== 'undefined' && window.db) {
    ;(rt as unknown as { db: typeof window.db }).db = window.db
  }
  return rt
}

export function BorthProvider({ children, initSource }: BorthProviderProps) {
  const { showToast } = useToast()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [ready, setReady] = useState(false)

  // Create runtime + eventbus together (in ref to persist across renders)
  const rtRef = useRef<Runtime | null>(null)
  const eventBusRef = useRef<ReturnType<typeof createEventBus> | null>(null)

  if (!rtRef.current) {
    rtRef.current = createConfiguredRuntime()
  }

  // EventBus needs showToast which can change, so we create it in useEffect
  // But we need a stable emit function, so we use a ref pattern
  const eventBusInitialized = useRef(false)
  if (!eventBusInitialized.current && rtRef.current) {
    eventBusRef.current = createEventBus({
      runtime: rtRef.current,
      showToast,
    })
    // Wire runtime's emitEvent to route through EventBus
    ;(rtRef.current as unknown as { _externalEmit: typeof eventBusRef.current.emit })._externalEmit =
      eventBusRef.current.emit
    eventBusInitialized.current = true
  }

  const rt = rtRef.current!
  const eventBus = eventBusRef.current!

  // Sync all marked words to the database
  const syncToDb = useCallback(async () => {
    // Iterate all vocabs
    for (const vocab of rt.vocabs) {
      for (const [, word] of vocab.words) {
        const attrs = word.attributes || {}
        if (attrs.command) await registerCommand(word).catch(console.error)
        if (attrs.hook) await registerHook(word).catch(console.error)
        if (attrs.setting) await registerSetting(word).catch(console.error)
      }
    }
    // Also check current vocab if not in vocabs
    if (rt.current && !rt.vocabs.includes(rt.current)) {
      for (const [, word] of rt.current.words) {
        const attrs = word.attributes || {}
        if (attrs.command) await registerCommand(word).catch(console.error)
        if (attrs.hook) await registerHook(word).catch(console.error)
        if (attrs.setting) await registerSetting(word).catch(console.error)
      }
    }
  }, [rt])

  // Run code
  const run = useCallback(
    async (code?: string): Promise<void> => {
      if (!code?.trim()) return

      try {
        await rt.run(code)
        // Sync any commands/hooks/settings to DB
        await syncToDb()
      } catch (e) {
        throw e
      }
    },
    [rt, syncToDb]
  )

  // Run a named command with optional args using stack isolation
  const runCommand = useCallback(
    async (name: string, args?: unknown[]): Promise<{ success: boolean; error?: string }> => {
      const currentRt = rtRef.current
      if (!currentRt) return { success: false, error: 'Runtime not initialized' }

      let word
      try {
        word = currentRt.find(name)
      } catch {
        return { success: false, error: `Unknown command: ${name}` }
      }

      // find() might return a number or string if that's the fallback
      if (!word || typeof word !== 'object') {
        return { success: false, error: `Unknown command: ${name}` }
      }

      try {
        // Use runFresh for stack isolation - pass args directly
        await currentRt.runFresh(word, ...(args ?? []))
        return { success: true }
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        console.error(`Command ${name} failed:`, e)
        return { success: false, error }
      }
    },
    []
  )

  // Reset runtime
  const reset = useCallback(() => {
    rtRef.current = createConfiguredRuntime()
    eventBusRef.current = createEventBus({
      runtime: rtRef.current,
      showToast,
    })
    ;(rtRef.current as unknown as { _externalEmit: typeof eventBusRef.current.emit })._externalEmit =
      eventBusRef.current.emit
  }, [showToast])

  // Window focus/blur events
  useEffect(() => {
    const handleFocus = () => eventBus.emit(Events.WINDOW_FOCUS, {})
    const handleBlur = () => eventBus.emit(Events.WINDOW_BLUR, {})

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [eventBus])

  // Clean up event bus and chrons on unmount
  useEffect(() => {
    return () => {
      eventBus.cleanup()
      ;(rt as unknown as { stopAllChrons: () => void }).stopAllChrons()
    }
  }, [eventBus, rt])

  // Initialize: run built-in commands, then init source, then mark ready
  useEffect(() => {
    async function init() {
      try {
        // 1. Register built-in test command (requires editor and events vocabs)
        await run(`
          in: blemacs ;
          using: editor events ;
          : blemacs-test ' success " Blemacs is working!" toast ;
          cmd
          doc{ Test command to verify Blemacs is working }
          key: C-t
        `)

        // 2. Run user's init source if provided
        if (initSource) {
          await run(initSource)
        }

        // 3. Mark as ready
        setReady(true)
        eventBus.emit(Events.APP_READY, {})
      } catch (err) {
        console.error('Init failed:', err)
        showToast({
          type: 'error',
          title: 'Init failed',
          message: err instanceof Error ? err.message : String(err),
        })
        // Still mark ready so user can see the error
        setReady(true)
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Wrap runCommand to show toast on error (for command palette)
  const handleRunCommand = useCallback(
    async (name: string) => {
      const result = await runCommand(name)
      if (!result.success && result.error) {
        showToast({
          type: 'error',
          title: `Command failed: ${name}`,
          message: result.error,
        })
      }
    },
    [runCommand, showToast]
  )

  // Set up keybindings
  useKeybindings({
    runCommand,
    enabled: ready,
    onCommandPalette: () => setPaletteOpen(true),
  })

  // Context value with all global functions
  const contextValue: BorthContextValue = {
    rt,
    run,
    runCommand,
    emit: eventBus.emit,
    openCommandPalette: () => setPaletteOpen(true),
    reset,
  }

  // Don't render children until init is complete
  if (!ready) {
    return null
  }

  return (
    <BorthContext.Provider value={contextValue}>
      {children}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onRunCommand={handleRunCommand}
      />
    </BorthContext.Provider>
  )
}

export function useBorth() {
  const ctx = useContext(BorthContext)
  if (!ctx) throw new Error('useBorth must be used inside BorthProvider')
  return ctx
}
