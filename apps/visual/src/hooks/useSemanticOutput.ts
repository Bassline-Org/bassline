/**
 * useSemanticOutput Hook
 *
 * Registers a semantic's output so downstream semantics can read it.
 * Use this when your semantic produces entities/relationships that
 * should be available to semantics that bind to you.
 */

import { useEffect } from 'react'
import { useSemanticOutputContext, type SyntaxOutput } from '../contexts/SemanticOutputContext'

export function useSemanticOutput(semanticId: string, output: SyntaxOutput) {
  const { setOutput } = useSemanticOutputContext()

  useEffect(() => {
    setOutput(semanticId, output)
  }, [semanticId, output, setOutput])
}
