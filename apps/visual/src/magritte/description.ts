/**
 * Magritte Meta-Description Framework
 *
 * A framework for describing object structure with consequential validation.
 * Invalid states are possible but have visible effects.
 */

// === Accessor: Strategy for reading/writing values ===

export type Accessor<T, V> = {
  read: (model: T) => V
  write: (model: T, value: V) => T // Immutable update (returns new model)
}

/**
 * Create an accessor from a property name
 */
export const prop = <T, K extends keyof T>(key: K): Accessor<T, T[K]> => ({
  read: model => model[key],
  write: (model, value) => ({ ...model, [key]: value }),
})

/**
 * Create a nested accessor using a path
 */
export const path = <T, V>(getter: (model: T) => V, setter: (model: T, value: V) => T): Accessor<T, V> => ({
  read: getter,
  write: setter,
})

// === Validation ===

export type ValidationError = {
  path?: string[]
  message: string
  severity: 'error' | 'warning' | 'info'
}

/**
 * Effects for consequential validation - show what happens rather than block
 */
export type ValidationEffect = {
  type: 'highlight' | 'clamp' | 'truncate' | 'disable-downstream' | 'show-consequence'
  data?: unknown
}

export type ValidationResult = {
  valid: boolean
  errors: ValidationError[]
  effects?: ValidationEffect[]
}

export const validResult: ValidationResult = { valid: true, errors: [] }

export const invalidResult = (message: string, severity: ValidationError['severity'] = 'error'): ValidationResult => ({
  valid: false,
  errors: [{ message, severity }],
})

// === Base Description ===

type BaseDescription<T, V> = {
  // Data access
  accessor: Accessor<T, V>

  // Display metadata
  label?: string
  comment?: string
  group?: string

  // Behavior
  priority: number
  visible: boolean
  readOnly: boolean
  required: boolean

  // Validation (consequential - returns effects, not just errors)
  validate?: (value: V, model: T) => ValidationResult

  // Default value
  default?: V | (() => V)
  undefinedValue?: V

  // Extension point for additional component info
  properties: Map<string, unknown>
}

// === Specialized Description Types ===

export type StringDescription<T = unknown> = BaseDescription<T, string> & {
  kind: 'string'
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  placeholder?: string
  // For consequential validation: what happens when too long?
  onTooLong?: 'truncate' | 'wrap' | 'error'
}

export type NumberDescription<T = unknown> = BaseDescription<T, number> & {
  kind: 'number'
  min?: number
  max?: number
  step?: number
  integer?: boolean
  // For consequential validation: what happens out of range?
  onOutOfRange?: 'clamp' | 'error' | 'highlight'
}

export type BooleanDescription<T = unknown> = BaseDescription<T, boolean> & {
  kind: 'boolean'
  trueLabel?: string
  falseLabel?: string
  // Visual style hint
  style?: 'checkbox' | 'switch' | 'toggle'
}

export type ContainerDescription<T = unknown> = Omit<BaseDescription<T, T>, 'accessor'> & {
  kind: 'container'
  children: AnyDescription<T>[]
  // Container passes itself as the value
  accessor: { read: (m: T) => T; write: (_: T, v: T) => T }
}

// === Relation Descriptions ===

export type ToOneDescription<T = unknown, V = unknown> = BaseDescription<T, V | null> & {
  kind: 'toOne'

  // How to get the description of the related object
  reference: () => ContainerDescription<V>

  // How to get the list of selectable options (for dropdowns/pickers)
  options?: () => V[]

  // How to display an option in the selector
  optionLabel?: (value: V) => string

  // Can the relation be null/undefined?
  nullable?: boolean
}

export type ToManyDescription<T = unknown, V = unknown> = BaseDescription<T, V[]> & {
  kind: 'toMany'

  // How to get the description of each item
  reference: () => ContainerDescription<V>

  // Constraints
  minItems?: number
  maxItems?: number

  // Is the collection ordered? (affects UI: drag-to-reorder)
  ordered?: boolean

  // Are items unique? (affects UI: prevent duplicates)
  unique?: boolean

  // How to create a new item
  createItem?: () => V
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDescription<T = unknown> =
  | StringDescription<T>
  | NumberDescription<T>
  | BooleanDescription<T>
  | ContainerDescription<T>
  | ToOneDescription<T, any>
  | ToManyDescription<T, any>

// === Factory Functions (same pattern as Phlow) ===

const baseDefaults = {
  priority: 50,
  visible: true,
  readOnly: false,
  required: false,
  properties: new Map(),
}

type StringConfig<T> = Partial<Omit<StringDescription<T>, 'kind'>> & {
  accessor: Accessor<T, string>
}

type NumberConfig<T> = Partial<Omit<NumberDescription<T>, 'kind'>> & {
  accessor: Accessor<T, number>
}

type BooleanConfig<T> = Partial<Omit<BooleanDescription<T>, 'kind'>> & {
  accessor: Accessor<T, boolean>
}

type ContainerConfig<T> = Partial<Omit<ContainerDescription<T>, 'kind' | 'accessor'>> & {
  children: AnyDescription<T>[]
}

type ToOneConfig<T, V> = Partial<Omit<ToOneDescription<T, V>, 'kind'>> & {
  accessor: Accessor<T, V | null>
  reference: () => ContainerDescription<V>
}

type ToManyConfig<T, V> = Partial<Omit<ToManyDescription<T, V>, 'kind'>> & {
  accessor: Accessor<T, V[]>
  reference: () => ContainerDescription<V>
}

export const describe = {
  string<T>(config: StringConfig<T>): StringDescription<T> {
    return {
      kind: 'string',
      ...baseDefaults,
      ...config,
      properties: config.properties ?? new Map(),
    }
  },

  number<T>(config: NumberConfig<T>): NumberDescription<T> {
    return {
      kind: 'number',
      ...baseDefaults,
      ...config,
      properties: config.properties ?? new Map(),
    }
  },

  boolean<T>(config: BooleanConfig<T>): BooleanDescription<T> {
    return {
      kind: 'boolean',
      ...baseDefaults,
      ...config,
      properties: config.properties ?? new Map(),
    }
  },

  container<T>(config: ContainerConfig<T>): ContainerDescription<T> {
    return {
      kind: 'container',
      accessor: { read: m => m, write: (_, v) => v },
      ...baseDefaults,
      ...config,
      properties: config.properties ?? new Map(),
    }
  },

  toOne<T, V>(config: ToOneConfig<T, V>): ToOneDescription<T, V> {
    return {
      kind: 'toOne',
      nullable: true,
      ...baseDefaults,
      ...config,
      properties: config.properties ?? new Map(),
    }
  },

  toMany<T, V>(config: ToManyConfig<T, V>): ToManyDescription<T, V> {
    return {
      kind: 'toMany',
      ordered: true,
      unique: false,
      ...baseDefaults,
      ...config,
      properties: config.properties ?? new Map(),
    }
  },
}
