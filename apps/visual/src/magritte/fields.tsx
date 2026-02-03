/**
 * Shadcn Field Components for Magritte Descriptions
 *
 * These components render description objects as form fields,
 * with consequential validation feedback.
 */

import { useMemo, useState, useCallback } from 'react'
import { Field, FieldLabel, FieldDescription, FieldError, FieldContent, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Pencil, X, Trash2, Plus } from 'lucide-react'
import type {
  AnyDescription,
  StringDescription,
  NumberDescription,
  BooleanDescription,
  ContainerDescription,
  ToOneDescription,
  ToManyDescription,
  ValidationResult,
} from './description'

// === Props ===

type DescribedFieldProps<T, V> = {
  description: AnyDescription<T> & { accessor: { read: (m: T) => V; write: (m: T, v: V) => T } }
  value: V
  onChange: (value: V) => void
  validation?: ValidationResult
}

type FieldDispatcherProps<T> = {
  description: AnyDescription<T>
  model: T
  onChange: (desc: AnyDescription<T>, value: unknown) => void
  validation?: Map<AnyDescription<T>, ValidationResult>
}

// === Main Dispatcher ===

/**
 * Render a description as the appropriate field type
 */
export function DescribedField<T>({ description, model, onChange, validation }: FieldDispatcherProps<T>) {
  const value = description.accessor.read(model)
  const result = validation?.get(description)

  const handleChange = (v: unknown) => onChange(description, v)

  switch (description.kind) {
    case 'string':
      return (
        <StringField
          description={description}
          value={value as string}
          onChange={handleChange as (v: string) => void}
          validation={result}
        />
      )
    case 'number':
      return (
        <NumberField
          description={description}
          value={value as number}
          onChange={handleChange as (v: number) => void}
          validation={result}
        />
      )
    case 'boolean':
      return (
        <BooleanField
          description={description}
          value={value as boolean}
          onChange={handleChange as (v: boolean) => void}
          validation={result}
        />
      )
    case 'container':
      return <ContainerField description={description} model={model} onChange={onChange} validation={validation} />
    case 'toOne':
      return <ToOneField description={description} model={model} onChange={onChange} validation={validation} />
    case 'toMany':
      return <ToManyField description={description} model={model} onChange={onChange} validation={validation} />
    default:
      return null
  }
}

// === String Field ===

function StringField<T>({
  description,
  value,
  onChange,
  validation,
}: DescribedFieldProps<T, string> & { description: StringDescription<T> }) {
  if (!description.visible) return null

  const errors = validation?.errors.filter(e => e.severity === 'error')
  const warnings = validation?.errors.filter(e => e.severity === 'warning')

  // Consequential feedback for too long strings
  const tooLong = description.maxLength !== undefined && (value?.length ?? 0) > description.maxLength
  const showTruncateWarning = tooLong && description.onTooLong === 'truncate'

  return (
    <Field orientation="vertical" data-invalid={!validation?.valid || undefined}>
      {description.label && <FieldLabel>{description.label}</FieldLabel>}
      <FieldContent>
        <Input
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          readOnly={description.readOnly}
          placeholder={description.placeholder}
          maxLength={description.onTooLong === 'error' ? description.maxLength : undefined}
        />
        {/* Character count for fields with max length */}
        {description.maxLength && (
          <div className={`text-xs ${tooLong ? 'text-amber-600' : 'text-muted-foreground'}`}>
            {value?.length ?? 0} / {description.maxLength}
            {showTruncateWarning && ' (will be truncated)'}
          </div>
        )}
      </FieldContent>
      {description.comment && <FieldDescription>{description.comment}</FieldDescription>}
      {/* Consequential: show warnings differently than errors */}
      {warnings && warnings.length > 0 && (
        <div className="text-amber-600 text-sm">{warnings.map(w => w.message).join(', ')}</div>
      )}
      {errors && errors.length > 0 && <FieldError errors={errors} />}
    </Field>
  )
}

// === Number Field ===

function NumberField<T>({
  description,
  value,
  onChange,
  validation,
}: DescribedFieldProps<T, number> & { description: NumberDescription<T> }) {
  if (!description.visible) return null

  const errors = validation?.errors.filter(e => e.severity === 'error')
  const warnings = validation?.errors.filter(e => e.severity === 'warning')

  // Consequential: if out of range, show what happens
  const outOfRange =
    (description.min !== undefined && value < description.min) ||
    (description.max !== undefined && value > description.max)

  const clampedValue = useMemo(() => {
    if (!outOfRange || description.onOutOfRange !== 'clamp') return null
    let v = value
    if (description.min !== undefined && v < description.min) v = description.min
    if (description.max !== undefined && v > description.max) v = description.max
    return v
  }, [value, description, outOfRange])

  return (
    <Field
      orientation="vertical"
      data-invalid={!validation?.valid || undefined}
      data-out-of-range={outOfRange || undefined}
    >
      {description.label && <FieldLabel>{description.label}</FieldLabel>}
      <FieldContent>
        <Input
          type="number"
          value={value ?? ''}
          onChange={e => {
            const parsed = e.target.valueAsNumber
            if (!Number.isNaN(parsed)) {
              onChange(parsed)
            }
          }}
          readOnly={description.readOnly}
          min={description.onOutOfRange === 'error' ? description.min : undefined}
          max={description.onOutOfRange === 'error' ? description.max : undefined}
          step={description.step ?? (description.integer ? 1 : 'any')}
        />
        {/* Consequential feedback */}
        {outOfRange && description.onOutOfRange === 'clamp' && clampedValue !== null && (
          <div className="text-muted-foreground text-xs">Value will be clamped to {clampedValue}</div>
        )}
        {outOfRange && description.onOutOfRange === 'highlight' && (
          <div className="text-amber-600 text-xs">
            Value is outside range [{description.min ?? '-inf'}, {description.max ?? '+inf'}]
          </div>
        )}
      </FieldContent>
      {description.comment && <FieldDescription>{description.comment}</FieldDescription>}
      {warnings && warnings.length > 0 && (
        <div className="text-amber-600 text-sm">{warnings.map(w => w.message).join(', ')}</div>
      )}
      {errors && errors.length > 0 && <FieldError errors={errors} />}
    </Field>
  )
}

// === Boolean Field ===

function BooleanField<T>({
  description,
  value,
  onChange,
  validation,
}: DescribedFieldProps<T, boolean> & { description: BooleanDescription<T> }) {
  if (!description.visible) return null

  const errors = validation?.errors.filter(e => e.severity === 'error')

  // Use checkbox for checkbox style, switch for everything else
  if (description.style === 'checkbox') {
    return (
      <Field orientation="horizontal" data-invalid={!validation?.valid || undefined}>
        <input
          type="checkbox"
          checked={value ?? false}
          onChange={e => onChange(e.target.checked)}
          disabled={description.readOnly}
          className="h-4 w-4 rounded border-input"
        />
        {description.label && <FieldLabel>{description.label}</FieldLabel>}
        {errors && errors.length > 0 && <FieldError errors={errors} />}
      </Field>
    )
  }

  return (
    <Field orientation="horizontal" data-invalid={!validation?.valid || undefined}>
      <Switch checked={value ?? false} onCheckedChange={onChange} disabled={description.readOnly} />
      {description.label && (
        <FieldLabel>
          {description.label}
          {/* Show true/false labels if defined */}
          {(description.trueLabel || description.falseLabel) && (
            <span className="text-muted-foreground font-normal ml-2">
              ({value ? description.trueLabel : description.falseLabel})
            </span>
          )}
        </FieldLabel>
      )}
      {description.comment && <FieldDescription>{description.comment}</FieldDescription>}
      {errors && errors.length > 0 && <FieldError errors={errors} />}
    </Field>
  )
}

// === Container Field ===

type ContainerFieldProps<T> = {
  description: ContainerDescription<T>
  model: T
  onChange: (desc: AnyDescription<T>, value: unknown) => void
  validation?: Map<AnyDescription<T>, ValidationResult>
}

function ContainerField<T>({ description, model, onChange, validation }: ContainerFieldProps<T>) {
  if (!description.visible) return null

  // Sort children by priority (lower = higher priority = first)
  const sortedChildren = useMemo(
    () => [...description.children].sort((a, b) => a.priority - b.priority),
    [description.children]
  )

  return (
    <FieldGroup>
      {sortedChildren.map((child, i) => (
        <DescribedField
          key={child.label ?? i}
          description={child}
          model={model}
          onChange={onChange}
          validation={validation}
        />
      ))}
    </FieldGroup>
  )
}

// === ToOne Field ===

type ToOneFieldProps<T, V> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  description: ToOneDescription<T, V>
  model: T
  onChange: (desc: AnyDescription<T>, value: unknown) => void
  validation?: Map<AnyDescription<T>, ValidationResult>
}

function ToOneField<T, V>({ description, model, onChange, validation }: ToOneFieldProps<T, V>) {
  if (!description.visible) return null

  const [isEditing, setIsEditing] = useState(false)
  const value = description.accessor.read(model) as V | null
  const result = validation?.get(description as AnyDescription<T>)
  const errors = result?.errors.filter(e => e.severity === 'error')

  const options = description.options?.() ?? []
  const optionLabel = description.optionLabel ?? ((v: V) => String(v))
  const relatedDescription = description.reference()

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const idx = parseInt(e.target.value, 10)
      if (idx === -1) {
        onChange(description as AnyDescription<T>, null)
      } else {
        onChange(description as AnyDescription<T>, options[idx])
      }
    },
    [description, onChange, options]
  )

  const handleClear = useCallback(() => {
    onChange(description as AnyDescription<T>, null)
  }, [description, onChange])

  // Handle changes to the related object's fields
  const handleRelatedChange = useCallback(
    (childDesc: AnyDescription<V>, childValue: unknown) => {
      if (!value) return
      // Cast accessor to handle the union type variance issue
      const accessor = childDesc.accessor as { read: (m: V) => unknown; write: (m: V, v: unknown) => V }
      const updatedValue = accessor.write(value, childValue)
      onChange(description as AnyDescription<T>, updatedValue)
    },
    [description, onChange, value]
  )

  const selectedIndex = value ? options.findIndex(o => o === value) : -1

  return (
    <Field orientation="vertical" data-invalid={!result?.valid || undefined}>
      {description.label && <FieldLabel>{description.label}</FieldLabel>}
      <FieldContent>
        <div className="flex items-center gap-2">
          <select
            value={selectedIndex}
            onChange={handleSelect}
            disabled={description.readOnly}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {description.nullable && <option value={-1}>— None —</option>}
            {options.map((opt, i) => (
              <option key={i} value={i}>
                {optionLabel(opt)}
              </option>
            ))}
          </select>
          {value && !description.readOnly && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(!isEditing)}
                title={isEditing ? 'Close editor' : 'Edit'}
              >
                {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </Button>
              {description.nullable && (
                <Button type="button" variant="ghost" size="icon" onClick={handleClear} title="Clear">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
        {/* Inline edit of selected value */}
        {isEditing && value && (
          <div className="mt-2 ml-4 p-3 border rounded-md bg-muted/30">
            <div className="text-xs text-muted-foreground mb-2">Editing {description.label}</div>
            <ContainerField
              description={relatedDescription}
              model={value}
              onChange={handleRelatedChange}
              validation={undefined}
            />
          </div>
        )}
      </FieldContent>
      {description.comment && <FieldDescription>{description.comment}</FieldDescription>}
      {errors && errors.length > 0 && <FieldError errors={errors} />}
    </Field>
  )
}

// === ToMany Field ===

type ToManyFieldProps<T, V> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  description: ToManyDescription<T, V>
  model: T
  onChange: (desc: AnyDescription<T>, value: unknown) => void
  validation?: Map<AnyDescription<T>, ValidationResult>
}

function ToManyField<T, V>({ description, model, onChange, validation }: ToManyFieldProps<T, V>) {
  if (!description.visible) return null

  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const items = (description.accessor.read(model) as V[]) ?? []

  const result = validation?.get(description as AnyDescription<T>)
  const errors = result?.errors.filter(e => e.severity === 'error')

  const relatedDescription = description.reference()
  const canAdd =
    !description.readOnly &&
    description.createItem &&
    (description.maxItems === undefined || items.length < description.maxItems)
  const canRemove = !description.readOnly && (description.minItems === undefined || items.length > description.minItems)

  const handleAdd = useCallback(() => {
    if (!description.createItem) return
    const newItem = description.createItem()
    const newItems = [...items, newItem]
    onChange(description as AnyDescription<T>, newItems)
    setEditingIndex(newItems.length - 1)
  }, [description, onChange, items])

  const handleRemove = useCallback(
    (index: number) => {
      const newItems = items.filter((_, i) => i !== index)
      onChange(description as AnyDescription<T>, newItems)
      if (editingIndex === index) {
        setEditingIndex(null)
      } else if (editingIndex !== null && editingIndex > index) {
        setEditingIndex(editingIndex - 1)
      }
    },
    [description, onChange, items, editingIndex]
  )

  // Handle changes to an item's fields
  const handleItemChange = useCallback(
    (index: number, childDesc: AnyDescription<V>, childValue: unknown) => {
      const item = items[index]
      // Cast accessor to handle the union type variance issue
      const accessor = childDesc.accessor as { read: (m: V) => unknown; write: (m: V, v: unknown) => V }
      const updatedItem = accessor.write(item, childValue)
      const newItems = [...items]
      newItems[index] = updatedItem
      onChange(description as AnyDescription<T>, newItems)
    },
    [description, onChange, items]
  )

  // Get a display label for an item (use first string field or fallback)
  const getItemLabel = (item: V, index: number): string => {
    const children = relatedDescription.children
    const stringDesc = children.find(c => c.kind === 'string')
    if (stringDesc) {
      const val = stringDesc.accessor.read(item)
      if (val) return String(val)
    }
    return `Item ${index + 1}`
  }

  return (
    <Field orientation="vertical" data-invalid={!result?.valid || undefined}>
      <div className="flex items-center justify-between">
        {description.label && <FieldLabel>{description.label}</FieldLabel>}
        {canAdd && (
          <Button type="button" variant="ghost" size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        )}
      </div>
      <FieldContent>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="border rounded-md bg-background">
              <div className="flex items-center gap-2 p-2">
                <span className="flex-1 text-sm truncate">{getItemLabel(item, index)}</span>
                {!description.readOnly && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                      title={editingIndex === index ? 'Close editor' : 'Edit'}
                    >
                      {editingIndex === index ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                    </Button>
                    {canRemove && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(index)}
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
              {/* Inline edit of item */}
              {editingIndex === index && (
                <div className="p-3 border-t bg-muted/30">
                  <ContainerField
                    description={relatedDescription}
                    model={item}
                    onChange={(childDesc, childValue) => handleItemChange(index, childDesc, childValue)}
                    validation={undefined}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        {items.length === 0 && <div className="text-sm text-muted-foreground italic p-2">No items</div>}
        {/* Constraints feedback */}
        {description.minItems !== undefined && items.length < description.minItems && (
          <div className="text-amber-600 text-xs mt-1">
            Minimum {description.minItems} item{description.minItems !== 1 ? 's' : ''} required
          </div>
        )}
        {description.maxItems !== undefined && items.length >= description.maxItems && (
          <div className="text-muted-foreground text-xs mt-1">
            Maximum {description.maxItems} item{description.maxItems !== 1 ? 's' : ''} reached
          </div>
        )}
      </FieldContent>
      {description.comment && <FieldDescription>{description.comment}</FieldDescription>}
      {errors && errors.length > 0 && <FieldError errors={errors} />}
    </Field>
  )
}

// === Utility Component for Form Display ===

type DescribedFormProps<T> = {
  description: ContainerDescription<T>
  model: T
  onChange: (desc: AnyDescription<T>, value: unknown) => void
  validation?: Map<AnyDescription<T>, ValidationResult>
  hasErrors?: boolean
}

/**
 * A complete form view for a container description.
 * Shows all fields and a validation summary.
 */
export function DescribedForm<T>({ description, model, onChange, validation, hasErrors }: DescribedFormProps<T>) {
  return (
    <div className="space-y-4">
      <ContainerField description={description} model={model} onChange={onChange} validation={validation} />
      {/* Consequential validation indicator */}
      {hasErrors && (
        <div className="text-destructive text-sm flex items-center gap-2">
          <span>Some values may cause issues</span>
        </div>
      )}
    </div>
  )
}
