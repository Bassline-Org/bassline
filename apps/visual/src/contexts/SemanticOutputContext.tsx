/**
 * SemanticOutputContext
 *
 * Allows semantics to share their outputs with downstream semantics.
 * When a semantic produces syntax (entities/relationships), it registers
 * that output here so other semantics can read it via binds relationships.
 */

import { createContext, useContext, useCallback, useRef, useMemo, type ReactNode } from 'react'
import type { EntityWithAttrs, Relationship } from '../types'

export interface SyntaxOutput {
  entities: EntityWithAttrs[]
  relationships: Relationship[]
}

interface SemanticOutputContextValue {
  // Register a semantic's output
  setOutput: (semanticId: string, output: SyntaxOutput) => void
  // Get a semantic's output (returns null if not a semantic or no output)
  getOutput: (semanticId: string) => SyntaxOutput | null
  // Subscribe to output changes (returns unsubscribe function)
  subscribe: (callback: () => void) => () => void
}

const SemanticOutputContext = createContext<SemanticOutputContextValue | null>(null)

export function SemanticOutputProvider({ children }: { children: ReactNode }) {
  // Store outputs by semantic entity ID
  const outputsRef = useRef<Map<string, SyntaxOutput>>(new Map())
  // Subscribers for reactivity
  const subscribersRef = useRef<Set<() => void>>(new Set())

  const notifySubscribers = useCallback(() => {
    for (const callback of subscribersRef.current) {
      callback()
    }
  }, [])

  const setOutput = useCallback((semanticId: string, output: SyntaxOutput) => {
    outputsRef.current.set(semanticId, output)
    notifySubscribers()
  }, [notifySubscribers])

  const getOutput = useCallback((semanticId: string): SyntaxOutput | null => {
    return outputsRef.current.get(semanticId) ?? null
  }, [])

  const subscribe = useCallback((callback: () => void) => {
    subscribersRef.current.add(callback)
    return () => {
      subscribersRef.current.delete(callback)
    }
  }, [])

  const value = useMemo(() => ({
    setOutput,
    getOutput,
    subscribe,
  }), [setOutput, getOutput, subscribe])

  return (
    <SemanticOutputContext.Provider value={value}>
      {children}
    </SemanticOutputContext.Provider>
  )
}

export function useSemanticOutputContext() {
  const context = useContext(SemanticOutputContext)
  if (!context) {
    throw new Error('useSemanticOutputContext must be used within SemanticOutputProvider')
  }
  return context
}
