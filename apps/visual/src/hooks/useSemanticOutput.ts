/**
 * useSemanticOutput Hook
 *
 * Registers a semantic's output so downstream semantics can read it.
 * Use this when your semantic produces data/relationships that
 * should be available to semantics that bind to you.
 *
 * Semantics produce DataObject[] as output - the core I/O model.
 */

import { useEffect, useRef } from 'react'
import { useSemanticOutputContext, type SyntaxOutput } from '../contexts/SemanticOutputContext'
import type { DataObject } from '../types'

// Shallow compare two SyntaxOutput objects
function outputsEqual(a: SyntaxOutput | null, b: SyntaxOutput): boolean {
  if (!a) return false
  if (a.data.length !== b.data.length) return false
  if ((a.relationships?.length ?? 0) !== (b.relationships?.length ?? 0)) return false
  // Compare data object IDs (shallow check)
  for (let i = 0; i < a.data.length; i++) {
    const aId = a.data[i].id
    const bId = b.data[i].id
    if (aId !== bId) return false
  }
  return true
}

/**
 * Register a semantic's output data.
 *
 * @param semanticId - The ID of this semantic entity
 * @param output - The output containing data objects and optional relationships
 */
export function useSemanticOutput(semanticId: string, output: SyntaxOutput) {
  const { setOutput, getOutput } = useSemanticOutputContext()
  const prevOutputRef = useRef<SyntaxOutput | null>(null)

  useEffect(() => {
    // Only update if output actually changed
    if (!outputsEqual(prevOutputRef.current, output)) {
      prevOutputRef.current = output
      setOutput(semanticId, output)
    }
  }, [semanticId, output, setOutput, getOutput])
}

/**
 * Helper to create a SyntaxOutput from DataObjects.
 * Useful for semantics that want to easily construct output.
 */
export function createSemanticOutput(data: DataObject[], relationships?: SyntaxOutput['relationships']): SyntaxOutput {
  return { data, relationships }
}
