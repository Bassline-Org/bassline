/**
 * Magritte Schema Types
 *
 * Schemas define the structure and constraints of data WITHOUT generics.
 * This is the "metadata layer" - pure type information with no runtime binding.
 */

// === Validation Types ===

export type ValidationError = {
  path?: string[]
  message: string
  severity: 'error' | 'warning' | 'info'
}

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

// === Base Schema (shared properties) ===

type BaseSchema = {
  label?: string
  comment?: string
  group?: string
  priority: number
  visible: boolean
  readOnly: boolean
  required: boolean
  properties: Map<string, unknown>
}

// === Primitive Schemas ===

export type StringSchema = BaseSchema & {
  kind: 'string'
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  placeholder?: string
  onTooLong?: 'truncate' | 'wrap' | 'error'
  default?: string | (() => string)
  undefinedValue?: string
  validate?: (value: string) => ValidationResult
}

export type NumberSchema = BaseSchema & {
  kind: 'number'
  min?: number
  max?: number
  step?: number
  integer?: boolean
  onOutOfRange?: 'clamp' | 'error' | 'highlight'
  default?: number | (() => number)
  undefinedValue?: number
  validate?: (value: number) => ValidationResult
}

export type BooleanSchema = BaseSchema & {
  kind: 'boolean'
  trueLabel?: string
  falseLabel?: string
  style?: 'checkbox' | 'switch' | 'toggle'
  default?: boolean | (() => boolean)
  validate?: (value: boolean) => ValidationResult
}

// === Container Schema ===

export type ContainerSchema = BaseSchema & {
  kind: 'container'
  children: Record<string, AnySchema> // keyed by property name
}

// === Relation Schemas ===

export type ToOneSchema = BaseSchema & {
  kind: 'toOne'
  reference: () => ContainerSchema
  nullable?: boolean
  options?: () => unknown[]
  optionLabel?: (value: unknown) => string
  default?: unknown | (() => unknown)
  validate?: (value: unknown) => ValidationResult
}

export type ToManySchema = BaseSchema & {
  kind: 'toMany'
  reference: () => ContainerSchema
  createItem: () => unknown
  minItems?: number
  maxItems?: number
  ordered?: boolean
  unique?: boolean
  validate?: (value: unknown[]) => ValidationResult
}

// === Union Type ===

export type AnySchema = StringSchema | NumberSchema | BooleanSchema | ContainerSchema | ToOneSchema | ToManySchema

// === Factory Defaults ===

const baseDefaults: Omit<BaseSchema, 'kind'> = {
  priority: 50,
  visible: true,
  readOnly: false,
  required: false,
  properties: new Map(),
}

// === Factory Functions ===

type StringConfig = Partial<Omit<StringSchema, 'kind'>>
type NumberConfig = Partial<Omit<NumberSchema, 'kind'>>
type BooleanConfig = Partial<Omit<BooleanSchema, 'kind'>>
type ContainerConfig = Partial<Omit<ContainerSchema, 'kind'>> & {
  children: Record<string, AnySchema>
}
type ToOneConfig = Partial<Omit<ToOneSchema, 'kind'>> & {
  reference: () => ContainerSchema
}
type ToManyConfig = Partial<Omit<ToManySchema, 'kind'>> & {
  reference: () => ContainerSchema
  createItem: () => unknown
}

export const schema = {
  string(config: StringConfig = {}): StringSchema {
    return {
      kind: 'string',
      ...baseDefaults,
      ...config,
      properties: config.properties ?? new Map(),
    }
  },

  number(config: NumberConfig = {}): NumberSchema {
    return {
      kind: 'number',
      ...baseDefaults,
      ...config,
      properties: config.properties ?? new Map(),
    }
  },

  boolean(config: BooleanConfig = {}): BooleanSchema {
    return {
      kind: 'boolean',
      ...baseDefaults,
      ...config,
      properties: config.properties ?? new Map(),
    }
  },

  container(config: ContainerConfig): ContainerSchema {
    return {
      kind: 'container',
      ...baseDefaults,
      ...config,
      properties: config.properties ?? new Map(),
    }
  },

  toOne(config: ToOneConfig): ToOneSchema {
    return {
      kind: 'toOne',
      nullable: true,
      ...baseDefaults,
      ...config,
      properties: config.properties ?? new Map(),
    }
  },

  toMany(config: ToManyConfig): ToManySchema {
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
