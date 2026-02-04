import { AutoForm } from '@/components/ui/autoform'
import { ZodProvider } from '@autoform/zod'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'

interface FormProps<T extends z.ZodObject<z.ZodRawShape>> {
  schema: T
  values?: Partial<z.infer<T>>
  onSubmit: (data: z.infer<T>) => void
  submitLabel?: string
}

export function Form<T extends z.ZodObject<z.ZodRawShape>>({
  schema,
  values,
  onSubmit,
  submitLabel = 'Save',
}: FormProps<T>) {
  return (
    <AutoForm
      schema={new ZodProvider(schema)}
      values={values as Record<string, unknown>}
      onSubmit={onSubmit as (data: Record<string, unknown>) => void}
      withSubmit
    >
      <Button type="submit" className="w-full mt-4">
        {submitLabel}
      </Button>
    </AutoForm>
  )
}
