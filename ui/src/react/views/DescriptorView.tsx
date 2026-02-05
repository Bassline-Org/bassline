import { useMemo, useRef } from 'react'
import { useComponents } from '../context'
import type { Descriptor } from '../../core/types'

export interface DescriptorViewProps<T> {
  item: Descriptor<T>
}

/**
 * Renders a descriptor (form-based) view with schema validation.
 * Uses a snapshot pattern to preserve user edits during external data changes.
 */
export function DescriptorView<T>({ item }: DescriptorViewProps<T>) {
  const { Form } = useComponents()
  const schema = useMemo(() => item.schema(), [item])

  // Capture snapshot ONCE on mount - don't react to external changes
  // This preserves user's edits if external data changes while editing
  const snapshotRef = useRef<T | null>(null)
  if (snapshotRef.current === null) {
    snapshotRef.current = item.model()
  }

  // Only call onUpdate when user explicitly submits
  const handleSubmit = (data: T) => {
    item.onUpdate?.(data)
    // Update snapshot after successful submit
    snapshotRef.current = data
  }

  return <Form schema={schema} values={snapshotRef.current ?? undefined} onSubmit={handleSubmit} />
}
