/**
 * React hooks for Magritte bound descriptions
 *
 * Uses jotai-immer for state management, providing
 * memento-like behavior without explicit memento classes.
 */

import { useMemo, useCallback, useRef } from 'react'
import { useAtom } from 'jotai'
import { atomWithImmer } from 'jotai-immer'
import type { ContainerSchema, ValidationResult } from './schema'
import type { BoundContainer, AnyBound } from './bound'
import { bindContainer } from './bound'
import { validateBound, hasValidationErrors, hasValidationWarnings } from './validation'

export type ValidationMap = Map<AnyBound, ValidationResult>

export type BoundState<T extends object> = {
  /** Bound container with all fields */
  bound: BoundContainer
  /** Current model value */
  model: T
  /** Validation results for each bound field */
  validation: ValidationMap
  /** Whether any errors exist (warnings don't count) */
  hasErrors: boolean
  /** Whether any warnings exist */
  hasWarnings: boolean
  /** Reset model to initial value */
  reset: () => void
  /** Get the initial value */
  initial: T
}

/**
 * Hook for editing a value according to a container schema.
 *
 * Provides memento-like behavior using jotai-immer:
 * - Draft mutations are isolated from committed state
 * - Validation runs on every change (consequential - doesn't block)
 * - Reset returns to initial value
 */
export function useBoundState<T extends object>(schema: ContainerSchema, initial: T): BoundState<T> {
  // Store initial value in a ref to avoid recreating atom on every render
  const initialRef = useRef(initial)

  // Create atom lazily - jotai-immer handles draft mutations
  const modelAtom = useMemo(() => atomWithImmer(initialRef.current), [])
  const [model, setModel] = useAtom(modelAtom)

  // Create the bound container, passing setModel as onChange
  const bound = useMemo(
    () => bindContainer(schema, model as object, newModel => setModel(() => newModel as T)),
    [schema, model, setModel]
  )

  // Compute validation for all fields (consequential - doesn't block)
  const validation = useMemo(() => validateBound(bound), [bound])

  // Check if form has errors or warnings
  const hasErrors = useMemo(() => hasValidationErrors(validation), [validation])
  const hasWarnings = useMemo(() => hasValidationWarnings(validation), [validation])

  // Reset to initial value
  const reset = useCallback(() => {
    setModel(() => initialRef.current)
  }, [setModel])

  return {
    bound,
    model: model as T,
    validation,
    hasErrors,
    hasWarnings,
    reset,
    initial: initialRef.current,
  }
}

/**
 * Simpler hook for reading validation without state management.
 * Useful when you already have state from elsewhere.
 */
export function useBoundValidation(bound: BoundContainer): {
  validation: ValidationMap
  hasErrors: boolean
  hasWarnings: boolean
} {
  const validation = useMemo(() => validateBound(bound), [bound])
  const hasErrors = useMemo(() => hasValidationErrors(validation), [validation])
  const hasWarnings = useMemo(() => hasValidationWarnings(validation), [validation])

  return { validation, hasErrors, hasWarnings }
}

/**
 * Hook for inline editing with draft state.
 * Used by ToOne and ToMany fields.
 */
export function useInlineEdit<T>(
  initial: T,
  onSave: (value: T) => void
): {
  draft: T
  setDraft: (updater: T | ((prev: T) => T)) => void
  isEditing: boolean
  startEdit: () => void
  cancel: () => void
  save: () => void
} {
  const draftAtom = useMemo(() => atomWithImmer(initial), [initial])
  const [draft, setDraft] = useAtom(draftAtom)
  const editingAtom = useMemo(() => atomWithImmer(false), [])
  const [isEditing, setIsEditing] = useAtom(editingAtom)

  const startEdit = useCallback(() => setIsEditing(() => true), [setIsEditing])
  const cancel = useCallback(() => {
    setDraft(() => initial)
    setIsEditing(() => false)
  }, [initial, setDraft, setIsEditing])
  const save = useCallback(() => {
    onSave(draft as T)
    setIsEditing(() => false)
  }, [draft, onSave, setIsEditing])

  return {
    draft: draft as T,
    setDraft: setDraft as (updater: T | ((prev: T) => T)) => void,
    isEditing,
    startEdit,
    cancel,
    save,
  }
}
