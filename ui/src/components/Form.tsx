import { useState, type FormHTMLAttributes } from 'react'
import { Button } from './Button'
import styles from './Form.module.css'

export interface FormProps<T = unknown> extends Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  /** The validation schema (not used in basic form) */
  schema: unknown
  /** Initial/current values */
  values?: T
  /** Called when form is submitted */
  onSubmit: (data: T) => void
  /** Submit button label */
  submitLabel?: string
}

/**
 * Basic HTML form component.
 * This is a minimal fallback - for full schema-based forms, use @bassline/ui/zod-form
 */
export function Form<T>({ schema, values, onSubmit, submitLabel = 'Save', className, ...props }: FormProps<T>) {
  const [json, setJson] = useState(() => JSON.stringify(values, null, 2))
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const parsed = JSON.parse(json)
      setError(null)
      onSubmit(parsed as T)
    } catch (err) {
      setError('Invalid JSON')
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${styles.form} ${className ?? ''}`} {...props}>
      <div className={styles.field}>
        <label className={styles.label}>Data (JSON)</label>
        <textarea className={styles.textarea} value={json} onChange={e => setJson(e.target.value)} rows={10} />
        {error && <p className={styles.error}>{error}</p>}
      </div>
      <Button type="submit" className={styles.submit}>
        {submitLabel}
      </Button>
    </form>
  )
}
