/**
 * useSemanticOutput Hook
 *
 * Registers a semantic's output so downstream semantics can read it.
 * Use this when your semantic produces entities/relationships that
 * should be available to semantics that bind to you.
 */

import { useEffect, useRef } from 'react'
import { useSemanticOutputContext, type SyntaxOutput } from '../contexts/SemanticOutputContext'

// Shallow compare two SyntaxOutput objects
function outputsEqual(a: SyntaxOutput | null, b: SyntaxOutput): boolean {
  if (!a) return false
  if (a.entities.length !== b.entities.length) return false
  if (a.relationships.length !== b.relationships.length) return false
  // Compare entity IDs (shallow check)
  for (let i = 0; i < a.entities.length; i++) {
    if (a.entities[i].id !== b.entities[i].id) return false
  }
  return true
}

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
