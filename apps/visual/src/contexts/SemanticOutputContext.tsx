/**
 * SemanticOutputContext
 *
 * Allows semantics to share their outputs with downstream semantics.
 * When a semantic produces syntax (entities/relationships), it registers
 * that output here so other semantics can read it via binds relationships.
 *
 * Uses React state for reactivity - when any semantic sets its output,
 * a new Map reference is created which triggers re-renders in consumers.
 */

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import type { DataObject, Relationship } from '../types'

/**
 * Output from a semantic transformation.
 *
 * Semantics transform DataObject[] → DataObject[]:
 * - `data`: The output DataObjects (includes id if entity-shaped)
 * - `relationships`: Optional relationships between output objects
 */
export interface SyntaxOutput {
  data: DataObject[]
  relationships?: Relationship[]
}

interface SemanticOutputContextValue {
  // Register a semantic's output
  setOutput: (semanticId: string, output: SyntaxOutput) => void
  // Get a semantic's output (returns null if not a semantic or no output)
  getOutput: (semanticId: string) => SyntaxOutput | null
  // The outputs map (for dependency tracking)
  outputs: Map<string, SyntaxOutput>
}

const SemanticOutputContext = createContext<SemanticOutputContextValue | null>(null)

export function SemanticOutputProvider({ children }: { children: ReactNode }) {
  // Store outputs by semantic entity ID - useState triggers re-renders
  const [outputs, setOutputs] = useState<Map<string, SyntaxOutput>>(() => new Map())

  const setOutput = useCallback((semanticId: string, output: SyntaxOutput) => {
    setOutputs(prev => {
      const next = new Map(prev)
      next.set(semanticId, output)
      return next
    })
  }, [])

  const getOutput = useCallback((semanticId: string): SyntaxOutput | null => {
    return outputs.get(semanticId) ?? null
  }, [outputs])

  const value = useMemo(() => ({
    setOutput,
    getOutput,
    outputs,
  }), [setOutput, getOutput, outputs])

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
