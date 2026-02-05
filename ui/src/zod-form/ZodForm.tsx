/**
 * ZodForm - Schema-based form component using @autoform/react and Zod
 *
 * This module requires optional dependencies:
 * - zod
 * - @autoform/react
 * - @autoform/zod
 *
 * Install them with: pnpm add zod @autoform/react @autoform/zod
 */

import type { FormHTMLAttributes } from 'react'

// Check if optional dependencies are available
let AutoForm: any = null
let ZodProvider: any = null

try {
  // Dynamic imports would be better but for simplicity we'll do this check
  AutoForm = require('@autoform/react').AutoForm
  ZodProvider = require('@autoform/zod').ZodProvider
} catch {
  // Dependencies not available
}

export interface ZodFormProps<T = unknown> extends Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  /** Zod schema for validation */
  schema: any
  /** Initial/current values */
  values?: T
  /** Called when form is submitted with valid data */
  onSubmit: (data: T) => void
  /** Submit button label */
  submitLabel?: string
}

/**
 * Schema-based form component using Zod and @autoform/react.
 *
 * Requires optional dependencies: zod, @autoform/react, @autoform/zod
 *
 * @example
 * ```tsx
 * import { ZodForm } from '@bassline/ui/zod-form'
 * import { z } from 'zod'
 *
 * const schema = z.object({
 *   name: z.string().min(1),
 *   email: z.string().email(),
 * })
 *
 * <ZodForm
 *   schema={schema}
 *   values={{ name: '', email: '' }}
 *   onSubmit={data => console.log(data)}
 * />
 * ```
 */
export function ZodForm<T>({ schema, values, onSubmit, submitLabel = 'Save', ...props }: ZodFormProps<T>) {
  if (!AutoForm || !ZodProvider) {
    return (
      <div style={{ padding: '1rem', color: '#dc2626', fontSize: '0.875rem' }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Missing dependencies</p>
        <p style={{ margin: '0.5rem 0 0' }}>
          ZodForm requires: <code>zod</code>, <code>@autoform/react</code>, <code>@autoform/zod</code>
        </p>
        <p style={{ margin: '0.5rem 0 0' }}>
          Install with: <code>pnpm add zod @autoform/react @autoform/zod</code>
        </p>
      </div>
    )
  }

  return (
    <AutoForm
      schema={new ZodProvider(schema)}
      values={values as Record<string, unknown>}
      onSubmit={onSubmit as (data: Record<string, unknown>) => void}
      withSubmit
      {...props}
    >
      <button
        type="submit"
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          background: '#333',
          color: '#fff',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        {submitLabel}
      </button>
    </AutoForm>
  )
}
