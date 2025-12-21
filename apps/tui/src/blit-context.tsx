import React, { createContext, useContext, ReactNode } from 'react'

// Resource interface matches @bassline/core
interface Resource {
  get: (headers: {
    path: string
    [key: string]: unknown
  }) => Promise<{ headers: Record<string, unknown>; body: unknown }>
  put: (
    headers: { path: string; [key: string]: unknown },
    body: unknown
  ) => Promise<{ headers: Record<string, unknown>; body: unknown }>
}

interface BlitState {
  kit: Resource
  path: string
  checkpoint: () => Promise<void>
  close: () => Promise<void>
}

const BlitContext = createContext<BlitState | null>(null)

interface BlitProviderProps {
  value: BlitState
  children: ReactNode
}

export function BlitProvider({ value, children }: BlitProviderProps) {
  return <BlitContext.Provider value={value}>{children}</BlitContext.Provider>
}

/**
 * Get the blit's kit (resource router).
 * Use this to interact with the blit via resource operations.
 *
 * @example
 * const kit = useBlit()
 * await kit.put({ path: '/tcl/eval' }, 'set x 42')
 * await kit.get({ path: '/store/pages' })
 */
export function useBlit(): Resource {
  const ctx = useContext(BlitContext)
  if (!ctx) {
    throw new Error('useBlit must be used within BlitProvider')
  }
  return ctx.kit
}

/**
 * Get the blit file path (for display purposes).
 */
export function useBlitPath(): string | undefined {
  return useContext(BlitContext)?.path
}

/**
 * Get the full blit context (kit, path, checkpoint, close).
 */
export function useBlitContext(): BlitState {
  const ctx = useContext(BlitContext)
  if (!ctx) {
    throw new Error('useBlitContext must be used within BlitProvider')
  }
  return ctx
}
