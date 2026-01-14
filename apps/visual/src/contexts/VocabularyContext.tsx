import { createContext, useContext } from 'react'
import type { Vocabulary } from '../lib/vocabularyParser'

/**
 * Context for providing vocabulary to deeply nested components like EntityNode
 */
export const VocabularyContext = createContext<Vocabulary | null>(null)

/**
 * Hook to access vocabulary from context
 */
export function useVocabularyContext(): Vocabulary | null {
  return useContext(VocabularyContext)
}
