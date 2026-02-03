/**
 * Shadcn Field Components for Magritte Bound Descriptions
 *
 * Renders bound descriptions as form fields with consequential validation.
 * Uses discriminated union narrowing - NO type casts needed!
 */

import { useMemo, useCallback, useState, useEffect, type ReactNode } from 'react'
import { produce } from 'immer'
import { Field, FieldLabel, FieldDescription, FieldError, FieldContent, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Pencil, X, Trash2, Plus, Check } from 'lucide-react'
import { validateBound, hasValidationErrors } from './validation'
import type { ValidationResult } from './schema'
import type { AnyBound, BoundString, BoundNumber, BoundBoolean, BoundContainer, BoundToOne, BoundToMany } from './bound'
import { bindContainer } from './bound'

// === Shared Types ===

type ValidationMap = Map<AnyBound, ValidationResult>

// === Shared Utilities ===

function splitErrors(validation?: ValidationResult) {
  const errors = validation?.errors.filter(e => e.severity === 'error') ?? []
  const warnings = validation?.errors.filter(e => e.severity === 'warning') ?? []
  return { errors, warnings, isValid: validation?.valid ?? true }
}

// Shared field chrome: label, content, comment, warnings, errors
function FieldChrome({
  label,
  comment,
  errors,
  warnings,
  isValid,
  orientation = 'vertical',
  children,
}: {
  label?: string
  comment?: string
  errors: { message: string }[]
  warnings: { message: string }[]
  isValid: boolean
  orientation?: 'vertical' | 'horizontal'
  children: ReactNode
}) {
  return (
    <Field orientation={orientation} data-invalid={!isValid || undefined}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <FieldContent>{children}</FieldContent>
      {comment && <FieldDescription>{comment}</FieldDescription>}
      {warnings.length > 0 && <div className="text-amber-600 text-sm">{warnings.map(w => w.message).join(', ')}</div>}
      {errors.length > 0 && <FieldError errors={errors} />}
    </Field>
  )
}

// === Main Dispatcher ===

export function BoundField({ bound, validation }: { bound: AnyBound; validation?: ValidationMap }): ReactNode {
  // TypeScript narrows the type based on .kind - NO casts needed!
  switch (bound.kind) {
    case 'string':
      return <StringField bound={bound} validation={validation} />
    case 'number':
      return <NumberField bound={bound} validation={validation} />
    case 'boolean':
      return <BooleanField bound={bound} validation={validation} />
    case 'container':
      return <ContainerField bound={bound} validation={validation} />
    case 'toOne':
      return <ToOneField bound={bound} validation={validation} />
    case 'toMany':
      return <ToManyField bound={bound} validation={validation} />
  }
}

// === Primitive Fields ===

function StringField({ bound, validation }: { bound: BoundString; validation?: ValidationMap }) {
  if (!bound.visible) return null

  const value = bound.read() // typed as string
  const { errors, warnings, isValid } = splitErrors(validation?.get(bound))
  const tooLong = bound.maxLength !== undefined && (value?.length ?? 0) > bound.maxLength

  return (
    <FieldChrome label={bound.label} comment={bound.comment} errors={errors} warnings={warnings} isValid={isValid}>
      <Input
        value={value ?? ''}
        onChange={e => bound.write(e.target.value)} // write takes string - NO cast!
        readOnly={bound.readOnly}
        placeholder={bound.placeholder}
        maxLength={bound.onTooLong === 'error' ? bound.maxLength : undefined}
      />
      {bound.maxLength && (
        <div className={`text-xs ${tooLong ? 'text-amber-600' : 'text-muted-foreground'}`}>
          {value?.length ?? 0} / {bound.maxLength}
          {tooLong && bound.onTooLong === 'truncate' && ' (will be truncated)'}
        </div>
      )}
    </FieldChrome>
  )
}

function NumberField({ bound, validation }: { bound: BoundNumber; validation?: ValidationMap }) {
  if (!bound.visible) return null

  const value = bound.read() // typed as number
  const { errors, warnings, isValid } = splitErrors(validation?.get(bound))
  const outOfRange = (bound.min !== undefined && value < bound.min) || (bound.max !== undefined && value > bound.max)

  return (
    <FieldChrome label={bound.label} comment={bound.comment} errors={errors} warnings={warnings} isValid={isValid}>
      <Input
        type="number"
        value={value ?? ''}
        onChange={e => {
          const parsed = e.target.valueAsNumber
          if (!Number.isNaN(parsed)) bound.write(parsed) // write takes number - NO cast!
        }}
        readOnly={bound.readOnly}
        min={bound.onOutOfRange === 'error' ? bound.min : undefined}
        max={bound.onOutOfRange === 'error' ? bound.max : undefined}
        step={bound.step ?? (bound.integer ? 1 : 'any')}
      />
      {outOfRange && bound.onOutOfRange === 'clamp' && (
        <div className="text-muted-foreground text-xs">
          Will be clamped to [{bound.min ?? '-∞'}, {bound.max ?? '∞'}]
        </div>
      )}
      {outOfRange && bound.onOutOfRange === 'highlight' && (
        <div className="text-amber-600 text-xs">
          Outside range [{bound.min ?? '-∞'}, {bound.max ?? '∞'}]
        </div>
      )}
    </FieldChrome>
  )
}

function BooleanField({ bound, validation }: { bound: BoundBoolean; validation?: ValidationMap }) {
  if (!bound.visible) return null

  const value = bound.read() // typed as boolean
  const { errors, isValid } = splitErrors(validation?.get(bound))

  if (bound.style === 'checkbox') {
    return (
      <Field orientation="horizontal" data-invalid={!isValid || undefined}>
        <input
          type="checkbox"
          checked={value ?? false}
          onChange={e => bound.write(e.target.checked)} // write takes boolean - NO cast!
          disabled={bound.readOnly}
          className="h-4 w-4 rounded border-input"
        />
        {bound.label && <FieldLabel>{bound.label}</FieldLabel>}
        {errors.length > 0 && <FieldError errors={errors} />}
      </Field>
    )
  }

  return (
    <Field orientation="horizontal" data-invalid={!isValid || undefined}>
      <Switch checked={value ?? false} onCheckedChange={v => bound.write(v)} disabled={bound.readOnly} />
      {bound.label && (
        <FieldLabel>
          {bound.label}
          {(bound.trueLabel || bound.falseLabel) && (
            <span className="text-muted-foreground font-normal ml-2">
              ({value ? bound.trueLabel : bound.falseLabel})
            </span>
          )}
        </FieldLabel>
      )}
      {bound.comment && <FieldDescription>{bound.comment}</FieldDescription>}
      {errors.length > 0 && <FieldError errors={errors} />}
    </Field>
  )
}

// === Container Field ===

function ContainerField({ bound, validation }: { bound: BoundContainer; validation?: ValidationMap }) {
  if (!bound.visible) return null

  const sortedChildren = useMemo(
    () => Object.entries(bound.children).sort((a, b) => a[1].priority - b[1].priority),
    [bound.children]
  )

  return (
    <FieldGroup>
      {sortedChildren.map(([key, childBound]) => (
        <BoundField key={key} bound={childBound} validation={validation} />
      ))}
    </FieldGroup>
  )
}

// === Inline Editor (shared by ToOne and ToMany) ===

function InlineEditor({
  boundContainer,
  onSave,
  onCancel,
  hasErrors,
}: {
  boundContainer: BoundContainer
  onSave: () => void
  onCancel: () => void
  hasErrors: boolean
}) {
  const validation = useMemo(() => validateBound(boundContainer), [boundContainer])

  return (
    <div className="mt-2 ml-4 p-3 border rounded-md bg-muted/30">
      <ContainerField bound={boundContainer} validation={validation} />
      <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
        <Button type="button" variant="ghost" size="icon" onClick={onCancel} title="Cancel">
          <X className="h-4 w-4" />
        </Button>
        <Button type="button" variant="default" size="icon" onClick={onSave} disabled={hasErrors} title="Save">
          <Check className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// === ToOne Field ===

function ToOneField({ bound, validation }: { bound: BoundToOne; validation?: ValidationMap }) {
  if (!bound.visible) return null

  const value = bound.read()
  const { errors, isValid } = splitErrors(validation?.get(bound))
  const options = bound.options?.() ?? []
  const optionLabel = bound.optionLabel ?? ((v: unknown) => String(v))

  // Editing state with memory of edits per option
  const [memory, setMemory] = useState<Record<string, unknown>>({})
  const [draft, setDraft] = useState<unknown | null>(value)
  const [isEditing, setIsEditing] = useState(false)

  // Sync draft with value when it changes externally
  useEffect(() => {
    if (!isEditing) {
      setDraft(value)
    }
  }, [value, isEditing])

  const getKey = useCallback((v: unknown) => String(optionLabel(v)), [optionLabel])

  // Get remembered edit for a value
  const recall = useCallback((v: unknown): unknown => memory[getKey(v)] ?? v, [memory, getKey])

  // Select a new option (uses remembered edit if available)
  const select = useCallback(
    (v: unknown | null) => {
      const resolved = v ? recall(v) : null
      setDraft(resolved)
      setIsEditing(false)
      bound.write(resolved)
    },
    [recall, bound]
  )

  const startEdit = useCallback(() => setIsEditing(true), [])
  const cancel = useCallback(() => {
    setDraft(value)
    setIsEditing(false)
  }, [value])

  const save = useCallback(() => {
    if (draft) {
      const key = getKey(draft)
      setMemory(m =>
        produce(m, d => {
          d[key] = draft
        })
      )
      bound.write(draft)
    }
    setIsEditing(false)
  }, [draft, getKey, bound])

  const selectedIndex = value ? options.findIndex(o => optionLabel(o) === optionLabel(value)) : -1
  const hasValue = value !== null && value !== undefined

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value, 10)
    select(idx === -1 ? null : options[idx])
  }

  // Create a bound container for editing the draft
  const draftBound = useMemo(() => {
    if (!draft || !isEditing) return null
    const childSchema = bound.reference()
    return bindContainer(childSchema, draft as object, newDraft => setDraft(newDraft), bound.key)
  }, [draft, isEditing, bound])

  const draftValidation = useMemo(() => (draftBound ? validateBound(draftBound) : undefined), [draftBound])

  return (
    <FieldChrome label={bound.label} comment={bound.comment} errors={errors} warnings={[]} isValid={isValid}>
      <div className="flex items-center gap-2">
        <select
          value={selectedIndex}
          onChange={handleSelect}
          disabled={bound.readOnly || isEditing}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {bound.nullable && <option value={-1}>— None —</option>}
          {options.map((opt, i) => (
            <option key={i} value={i}>
              {String(optionLabel(opt))}
            </option>
          ))}
        </select>
        {hasValue && !bound.readOnly && !isEditing && (
          <Button type="button" variant="ghost" size="icon" onClick={startEdit} title="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {hasValue && bound.nullable && !bound.readOnly && (
          <Button type="button" variant="ghost" size="icon" onClick={() => select(null)} title="Clear">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      {isEditing && draftBound && (
        <InlineEditor
          boundContainer={draftBound}
          onSave={save}
          onCancel={cancel}
          hasErrors={draftValidation ? hasValidationErrors(draftValidation) : false}
        />
      )}
    </FieldChrome>
  )
}

// === ToMany Field ===

function ToManyField({ bound, validation }: { bound: BoundToMany; validation?: ValidationMap }) {
  if (!bound.visible) return null

  const items = bound.read()
  const { errors, isValid } = splitErrors(validation?.get(bound))
  const canAdd = !bound.readOnly && (bound.maxItems === undefined || items.length < bound.maxItems)
  const canRemove = !bound.readOnly && (bound.minItems === undefined || items.length > bound.minItems)

  const getItemLabel = useCallback(
    (item: unknown, index: number): string => {
      const childSchema = bound.reference()
      const firstStringKey = Object.entries(childSchema.children).find(([_, s]) => s.kind === 'string')?.[0]
      if (firstStringKey) {
        const val = (item as Record<string, unknown>)[firstStringKey]
        if (val) return String(val)
      }
      return `Item ${index + 1}`
    },
    [bound]
  )

  return (
    <Field orientation="vertical" data-invalid={!isValid || undefined}>
      <div className="flex items-center justify-between">
        {bound.label && <FieldLabel>{bound.label}</FieldLabel>}
        {canAdd && (
          <Button type="button" variant="ghost" size="sm" onClick={() => bound.add()}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        )}
      </div>
      <FieldContent>
        <div className="space-y-2">
          {items.map((item, index) => (
            <ToManyItem
              key={index}
              bound={bound}
              item={item}
              index={index}
              canRemove={canRemove}
              getItemLabel={getItemLabel}
            />
          ))}
        </div>
        {items.length === 0 && <div className="text-sm text-muted-foreground italic p-2">No items</div>}
        {bound.minItems !== undefined && items.length < bound.minItems && (
          <div className="text-amber-600 text-xs mt-1">Minimum {bound.minItems} items required</div>
        )}
        {bound.maxItems !== undefined && items.length >= bound.maxItems && (
          <div className="text-muted-foreground text-xs mt-1">Maximum {bound.maxItems} items</div>
        )}
      </FieldContent>
      {bound.comment && <FieldDescription>{bound.comment}</FieldDescription>}
      {errors.length > 0 && <FieldError errors={errors} />}
    </Field>
  )
}

function ToManyItem({
  bound,
  item,
  index,
  canRemove,
  getItemLabel,
}: {
  bound: BoundToMany
  item: unknown
  index: number
  canRemove: boolean
  getItemLabel: (item: unknown, index: number) => string
}) {
  const [draft, setDraft] = useState(item)
  const [isEditing, setIsEditing] = useState(false)

  // Sync draft with item when item changes (e.g., after deletion reorders items)
  useEffect(() => {
    if (!isEditing) {
      setDraft(item)
    }
  }, [item, isEditing])

  const startEdit = useCallback(() => setIsEditing(true), [])
  const cancel = useCallback(() => {
    setDraft(item)
    setIsEditing(false)
  }, [item])

  const save = useCallback(() => {
    // Update the item in the parent array
    const items = bound.read()
    const newItems = [...items]
    newItems[index] = draft
    bound.write(newItems)
    setIsEditing(false)
  }, [draft, bound, index])

  // Create bound container for the draft
  const draftBound = useMemo(() => {
    const childSchema = bound.reference()
    return bindContainer(childSchema, draft as object, newDraft => setDraft(newDraft), `${bound.key}[${index}]`)
  }, [draft, bound, index])

  const draftValidation = useMemo(() => validateBound(draftBound), [draftBound])

  return (
    <div className="border rounded-md bg-background">
      <div className="flex items-center gap-2 p-2">
        <span className="flex-1 text-sm truncate">{getItemLabel(draft, index)}</span>
        {!bound.readOnly && (
          <>
            {!isEditing && (
              <Button type="button" variant="ghost" size="icon" onClick={startEdit} title="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canRemove && (
              <Button type="button" variant="ghost" size="icon" onClick={() => bound.remove(index)} title="Remove">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </div>
      {isEditing && (
        <div className="p-3 border-t bg-muted/30">
          <ContainerField bound={draftBound} validation={draftValidation} />
          <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
            <Button type="button" variant="ghost" size="icon" onClick={cancel} title="Cancel">
              <X className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="default"
              size="icon"
              onClick={save}
              disabled={hasValidationErrors(draftValidation)}
              title="Save"
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// === Form Wrapper ===

export function BoundForm({
  bound,
  validation,
  hasErrors,
}: {
  bound: BoundContainer
  validation?: ValidationMap
  hasErrors?: boolean
}) {
  return (
    <div className="space-y-4">
      <ContainerField bound={bound} validation={validation} />
      {hasErrors && (
        <div className="text-destructive text-sm flex items-center gap-2">
          <span>Some values may cause issues</span>
        </div>
      )}
    </div>
  )
}

// === Legacy exports for backwards compatibility ===
// These can be removed once all consumers are migrated

export { BoundField as DescribedField }
export { BoundForm as DescribedForm }
