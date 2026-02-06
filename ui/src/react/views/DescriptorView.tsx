import { useMemo, useRef } from 'react'
import { useComponents } from '../context'
import type { PhlowDescriptorView } from '../../core/views'

export interface DescriptorViewProps<T> {
  item: PhlowDescriptorView<any, T>
}

/**
 * Renders a descriptor (form-based) view with schema validation.
 * Uses a snapshot pattern to preserve user edits during external data changes.
 */
export function DescriptorView<T>({ item }: DescriptorViewProps<T>) {
  const { Form } = useComponents()
  const schema = useMemo(() => item.schema(), [item])

  // Capture snapshot ONCE on mount - don't react to external changes
  const snapshotRef = useRef<T | null>(null)
  if (snapshotRef.current === null) {
    snapshotRef.current = item.model()
  }

  const handleSubmit = (data: T) => {
    item.onUpdate(data)
    snapshotRef.current = data
  }

  return <Form schema={schema} values={snapshotRef.current ?? undefined} onSubmit={handleSubmit} />
}
