/**
 * React hooks for Magritte descriptions
 *
 * Uses jotai-immer for draft state management, providing
 * memento-like behavior without explicit memento classes.
 */

import { useMemo, useCallback, useRef } from 'react'
import { useAtom } from 'jotai'
import { atomWithImmer } from 'jotai-immer'
import type { ContainerDescription, AnyDescription, ValidationResult } from './description'

/**
 * Check if a value is "undefined" according to a description
 */
function isUndefinedValue<T, V>(value: V, desc: AnyDescription<T>): boolean {
  if (value === null || value === undefined) return true

  if ('undefinedValue' in desc && desc.undefinedValue !== undefined) {
    return value === desc.undefinedValue
  }

  if (typeof value === 'string' && value === '') return true

  return false
}

/**
 * Validate a single description against a model
 */
function validateDescription<T>(desc: AnyDescription<T>, model: T): ValidationResult {
  const value = desc.accessor.read(model)

  // Check required
  if (desc.required && isUndefinedValue(value, desc)) {
    return {
      valid: false,
      errors: [{ message: 'Required', severity: 'warning' }],
    }
  }

  // Run custom validation
  if (desc.validate) {
    return desc.validate(value as never, model)
  }

  return { valid: true, errors: [] }
}

/**
 * Validate all descriptions in a container
 */
function validateContainer<T>(container: ContainerDescription<T>, model: T): Map<AnyDescription<T>, ValidationResult> {
  const results = new Map<AnyDescription<T>, ValidationResult>()

  for (const desc of container.children) {
    results.set(desc, validateDescription(desc, model))
  }

  return results
}

export type DescribedState<T> = {
  /** Current draft value */
  draft: T
  /** Update a field using its description */
  update: <V>(desc: AnyDescription<T> & { accessor: { read: (m: T) => V; write: (m: T, v: V) => T } }, value: V) => void
  /** Validation results for each description */
  validation: Map<AnyDescription<T>, ValidationResult>
  /** Whether any errors exist (warnings don't count) */
  hasErrors: boolean
  /** Reset draft to initial value */
  reset: () => void
  /** Get the initial value */
  initial: T
}

/**
 * Hook for editing a value according to a container description.
 *
 * Provides memento-like behavior using jotai-immer:
 * - Draft mutations are isolated from committed state
 * - Validation runs on every change (consequential - doesn't block)
 * - Reset returns to initial value
 */
export function useDescribedState<T>(container: ContainerDescription<T>, initial: T): DescribedState<T> {
  // Store initial value in a ref to avoid recreating atom on every render
  const initialRef = useRef(initial)

  // Create atom lazily - jotai-immer handles draft mutations
  const draftAtom = useMemo(() => atomWithImmer(initialRef.current), [])
  const [draft, setDraft] = useAtom(draftAtom)

  // Compute validation for all fields (consequential - doesn't block)
  const validation = useMemo(() => validateContainer(container, draft), [draft, container])

  // Update function that works with any description
  const update = useCallback(
    <V>(desc: AnyDescription<T> & { accessor: { read: (m: T) => V; write: (m: T, v: V) => T } }, value: V) => {
      setDraft(d => {
        const updated = desc.accessor.write(d as T, value)
        // Immer handles the mutation
        Object.assign(d as object, updated)
      })
    },
    [setDraft]
  )

  // Check if form has any errors (warnings don't count)
  const hasErrors = useMemo(() => {
    for (const result of validation.values()) {
      if (!result.valid && result.errors.some(e => e.severity === 'error')) {
        return true
      }
    }
    return false
  }, [validation])

  // Reset to initial value
  const reset = useCallback(() => {
    setDraft(() => initialRef.current)
  }, [setDraft])

  return {
    draft,
    update,
    validation,
    hasErrors,
    reset,
    initial: initialRef.current,
  }
}

/**
 * Simpler hook for reading description validation without state management.
 * Useful when you already have state from elsewhere.
 */
export function useDescriptionValidation<T>(
  container: ContainerDescription<T>,
  model: T
): {
  validation: Map<AnyDescription<T>, ValidationResult>
  hasErrors: boolean
  hasWarnings: boolean
} {
  const validation = useMemo(() => validateContainer(container, model), [model, container])

  const hasErrors = useMemo(() => {
    for (const result of validation.values()) {
      if (result.errors.some(e => e.severity === 'error')) {
        return true
      }
    }
    return false
  }, [validation])

  const hasWarnings = useMemo(() => {
    for (const result of validation.values()) {
      if (result.errors.some(e => e.severity === 'warning')) {
        return true
      }
    }
    return false
  }, [validation])

  return { validation, hasErrors, hasWarnings }
}
