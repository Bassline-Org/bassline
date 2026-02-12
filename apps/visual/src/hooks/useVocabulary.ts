import { useMemo } from 'react'
import type { StampWithAttrs } from '../types'
import {
  parseVocabulary,
  mergeWithDefaults,
  getRoleVocabulary,
  type Vocabulary,
  type VocabularyItem,
} from '../lib/vocabularyParser'

/**
 * Hook to parse and provide vocabulary from stamps
 *
 * @param stamps - All stamps (vocabulary stamps will be filtered and parsed)
 * @returns Vocabulary object with roles, lattices, and shapes
 */
export function useVocabulary(stamps: StampWithAttrs[]): Vocabulary {
  return useMemo(() => {
    const parsed = parseVocabulary(stamps)
    return mergeWithDefaults(parsed)
  }, [stamps])
}

/**
 * Hook to get vocabulary for a specific role
 *
 * @param vocabulary - The full vocabulary object
 * @param role - The role value (e.g., "cell")
 * @returns VocabularyItem for the role, or undefined if not found
 */
export function useRoleVocabulary(vocabulary: Vocabulary, role: string | undefined): VocabularyItem | undefined {
  return useMemo(() => {
    if (!role) return undefined
    return getRoleVocabulary(vocabulary, role)
  }, [vocabulary, role])
}
