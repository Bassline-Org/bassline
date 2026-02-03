/**
 * Magritte Bound Types
 *
 * Bound descriptions connect schemas to model instances at runtime.
 * Each bound type is CONCRETE (no generic V parameter) so that
 * discriminated union narrowing works perfectly.
 */

import { produce } from 'immer'
import type {
  AnySchema,
  StringSchema,
  NumberSchema,
  BooleanSchema,
  ContainerSchema,
  ToOneSchema,
  ToManySchema,
} from './schema'

// === Bound Types (Concrete, No Generics) ===

export type BoundString = StringSchema & {
  key: string
  read(): string
  write(v: string): void
}

export type BoundNumber = NumberSchema & {
  key: string
  read(): number
  write(v: number): void
}

export type BoundBoolean = BooleanSchema & {
  key: string
  read(): boolean
  write(v: boolean): void
}

export type BoundContainer = ContainerSchema & {
  key: string
  children: Record<string, AnyBound>
  read(): unknown
  write(v: unknown): void
}

export type BoundToOne = ToOneSchema & {
  key: string
  read(): unknown | null
  write(v: unknown | null): void
  boundChild(): BoundContainer | null
}

export type BoundToMany = ToManySchema & {
  key: string
  read(): unknown[]
  write(v: unknown[]): void
  boundItems(): BoundContainer[]
  add(): void
  remove(index: number): void
}

// === Union of ALL concrete bound types ===

export type AnyBound = BoundString | BoundNumber | BoundBoolean | BoundContainer | BoundToOne | BoundToMany

// === Binding Functions ===

/**
 * Bind a container schema to a model - returns BoundContainer
 */
export function bindContainer(
  schema: ContainerSchema,
  model: object,
  onChange: (newModel: object) => void,
  key: string = 'root'
): BoundContainer {
  return {
    ...schema,
    key,
    children: Object.fromEntries(
      Object.entries(schema.children).map(([childKey, childSchema]) => [
        childKey,
        bindField(childSchema, model, childKey, onChange),
      ])
    ),
    read: () => model,
    write: v => onChange(v as object),
  }
}

/**
 * Bind a field schema - returns the appropriate concrete bound type
 */
export function bindField(
  schema: AnySchema,
  model: object,
  key: string,
  onChange: (newModel: object) => void
): AnyBound {
  const getValue = () => (model as Record<string, unknown>)[key]
  const setValue = (v: unknown) => {
    onChange(
      produce(model, d => {
        ;(d as Record<string, unknown>)[key] = v
      })
    )
  }

  switch (schema.kind) {
    case 'string':
      return {
        ...schema,
        key,
        read: () => getValue() as string,
        write: setValue,
      }

    case 'number':
      return {
        ...schema,
        key,
        read: () => getValue() as number,
        write: setValue,
      }

    case 'boolean':
      return {
        ...schema,
        key,
        read: () => getValue() as boolean,
        write: setValue,
      }

    case 'container':
      return bindNestedContainer(schema, model, key, onChange)

    case 'toOne':
      return bindToOne(schema, model, key, onChange)

    case 'toMany':
      return bindToMany(schema, model, key, onChange)
  }
}

/**
 * Bind a nested container (field that is itself an object)
 */
function bindNestedContainer(
  schema: ContainerSchema,
  parentModel: object,
  key: string,
  onParentChange: (newModel: object) => void
): BoundContainer {
  const getValue = () => (parentModel as Record<string, unknown>)[key] as object
  const setValue = (v: object) => {
    onParentChange(
      produce(parentModel, d => {
        ;(d as Record<string, unknown>)[key] = v
      })
    )
  }

  const nested = getValue()
  return {
    ...schema,
    key,
    children: Object.fromEntries(
      Object.entries(schema.children).map(([childKey, childSchema]) => [
        childKey,
        bindField(childSchema, nested, childKey, newNested => setValue(newNested)),
      ])
    ),
    read: getValue,
    write: setValue,
  }
}

/**
 * Bind a toOne relation
 */
function bindToOne(schema: ToOneSchema, model: object, key: string, onChange: (newModel: object) => void): BoundToOne {
  const getValue = () => (model as Record<string, unknown>)[key]
  const setValue = (v: unknown) => {
    onChange(
      produce(model, d => {
        ;(d as Record<string, unknown>)[key] = v
      })
    )
  }

  return {
    ...schema,
    key,
    read: getValue,
    write: setValue,
    boundChild(): BoundContainer | null {
      const value = getValue()
      if (value === null || value === undefined) return null

      const childSchema = schema.reference()
      return bindContainer(childSchema, value as object, newChild => setValue(newChild), key)
    },
  }
}

/**
 * Bind a toMany relation
 */
function bindToMany(
  schema: ToManySchema,
  model: object,
  key: string,
  onChange: (newModel: object) => void
): BoundToMany {
  const getValue = () => ((model as Record<string, unknown>)[key] as unknown[]) ?? []
  const setValue = (v: unknown[]) => {
    onChange(
      produce(model, d => {
        ;(d as Record<string, unknown>)[key] = v
      })
    )
  }

  return {
    ...schema,
    key,
    read: getValue,
    write: setValue,

    boundItems(): BoundContainer[] {
      const items = getValue()
      const childSchema = schema.reference()
      return items.map((item, index) =>
        bindContainer(
          childSchema,
          item as object,
          newItem => {
            const newItems = [...items]
            newItems[index] = newItem
            setValue(newItems)
          },
          `${key}[${index}]`
        )
      )
    },

    add(): void {
      const newItem = schema.createItem()
      setValue([...getValue(), newItem])
    },

    remove(index: number): void {
      setValue(getValue().filter((_, i) => i !== index))
    },
  }
}

// === Utility: Rebind on model change ===

/**
 * Create a binding that stays fresh when the model changes.
 * Returns a function that takes the current model and returns bound descriptions.
 */
export function createBinder(
  schema: ContainerSchema
): (model: object, onChange: (m: object) => void) => BoundContainer {
  return (model, onChange) => bindContainer(schema, model, onChange)
}
