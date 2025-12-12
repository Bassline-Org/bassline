/**
 * Handler metadata for UI generation
 *
 * Maps handler names to their configuration UI requirements
 */

export type UIType =
  | 'numeric'
  | 'comparison'
  | 'keySelector'
  | 'multiKeySelector'
  | 'nested'
  | 'conditional'
  | 'template'
  | 'regex'
  | 'typeSelector'
  | 'none'

export interface HandlerMetadata {
  description: string
  category: string
  config?: Record<string, string>
  uiType: UIType
  uiOptions?: Record<string, any>
}

export const HANDLER_METADATA: Record<string, HandlerMetadata> = {
  // Arithmetic handlers - numeric config
  add: {
    description: 'Add a constant value',
    category: 'Arithmetic',
    config: { value: 'number' },
    uiType: 'numeric',
    uiOptions: { label: 'Value to add', step: 1 },
  },
  subtract: {
    description: 'Subtract a constant value',
    category: 'Arithmetic',
    config: { value: 'number' },
    uiType: 'numeric',
    uiOptions: { label: 'Value to subtract', step: 1 },
  },
  multiply: {
    description: 'Multiply by a constant',
    category: 'Arithmetic',
    config: { value: 'number' },
    uiType: 'numeric',
    uiOptions: { label: 'Multiplier', step: 0.1 },
  },
  divide: {
    description: 'Divide by a constant',
    category: 'Arithmetic',
    config: { value: 'number' },
    uiType: 'numeric',
    uiOptions: { label: 'Divisor', step: 0.1, min: 0.001 },
  },
  modulo: {
    description: 'Modulo by a constant',
    category: 'Arithmetic',
    config: { value: 'number' },
    uiType: 'numeric',
    uiOptions: { label: 'Modulo value', step: 1, min: 1 },
  },
  power: {
    description: 'Raise to a power',
    category: 'Arithmetic',
    config: { value: 'number' },
    uiType: 'numeric',
    uiOptions: { label: 'Exponent', step: 1 },
  },

  // Comparison handlers
  eq: {
    description: 'Equal to value',
    category: 'Comparison',
    config: { value: 'any' },
    uiType: 'comparison',
    uiOptions: { operator: '=' },
  },
  neq: {
    description: 'Not equal to value',
    category: 'Comparison',
    config: { value: 'any' },
    uiType: 'comparison',
    uiOptions: { operator: '!=' },
  },
  gt: {
    description: 'Greater than value',
    category: 'Comparison',
    config: { value: 'number' },
    uiType: 'numeric',
    uiOptions: { label: 'Greater than' },
  },
  gte: {
    description: 'Greater than or equal',
    category: 'Comparison',
    config: { value: 'number' },
    uiType: 'numeric',
    uiOptions: { label: 'Greater than or equal to' },
  },
  lt: {
    description: 'Less than value',
    category: 'Comparison',
    config: { value: 'number' },
    uiType: 'numeric',
    uiOptions: { label: 'Less than' },
  },
  lte: {
    description: 'Less than or equal',
    category: 'Comparison',
    config: { value: 'number' },
    uiType: 'numeric',
    uiOptions: { label: 'Less than or equal to' },
  },

  // Key selection handlers
  pick: {
    description: 'Pick a single key from object',
    category: 'Object',
    config: { key: 'string' },
    uiType: 'keySelector',
    uiOptions: { mode: 'single', placeholder: 'Key to pick' },
  },
  get: {
    description: 'Get value at path (supports dot notation)',
    category: 'Object',
    config: { path: 'string' },
    uiType: 'keySelector',
    uiOptions: { mode: 'path', placeholder: 'Path (e.g., user.name)' },
  },
  has: {
    description: 'Check if object has key',
    category: 'Object',
    config: { key: 'string' },
    uiType: 'keySelector',
    uiOptions: { mode: 'single', placeholder: 'Key to check' },
  },
  omit: {
    description: 'Omit keys from object',
    category: 'Object',
    config: { keys: 'array' },
    uiType: 'multiKeySelector',
    uiOptions: { placeholder: 'Keys to omit' },
  },
  groupBy: {
    description: 'Group array by key',
    category: 'ArrayReducers',
    config: { key: 'string' },
    uiType: 'keySelector',
    uiOptions: { mode: 'single', placeholder: 'Key to group by' },
  },
  sortBy: {
    description: 'Sort array by key',
    category: 'ArrayReducers',
    config: { key: 'string' },
    uiType: 'keySelector',
    uiOptions: { mode: 'single', placeholder: 'Key to sort by' },
  },
  indexBy: {
    description: 'Index array by key',
    category: 'ArrayReducers',
    config: { key: 'string' },
    uiType: 'keySelector',
    uiOptions: { mode: 'single', placeholder: 'Key to index by' },
  },
  sumBy: {
    description: 'Sum values by key',
    category: 'ArrayReducers',
    config: { key: 'string' },
    uiType: 'keySelector',
    uiOptions: { mode: 'single', placeholder: 'Key to sum' },
  },
  countBy: {
    description: 'Count by key',
    category: 'ArrayReducers',
    config: { key: 'string' },
    uiType: 'keySelector',
    uiOptions: { mode: 'single', placeholder: 'Key to count by' },
  },
  minBy: {
    description: 'Find minimum by key',
    category: 'ArrayReducers',
    config: { key: 'string' },
    uiType: 'keySelector',
    uiOptions: { mode: 'single', placeholder: 'Key to find min' },
  },
  maxBy: {
    description: 'Find maximum by key',
    category: 'ArrayReducers',
    config: { key: 'string' },
    uiType: 'keySelector',
    uiOptions: { mode: 'single', placeholder: 'Key to find max' },
  },

  // Array index handlers
  at: {
    description: 'Get element at index',
    category: 'Array',
    config: { index: 'number' },
    uiType: 'numeric',
    uiOptions: { label: 'Index', step: 1, min: 0 },
  },
  take: {
    description: 'Take first N elements',
    category: 'Array',
    config: { count: 'number' },
    uiType: 'numeric',
    uiOptions: { label: 'Count', step: 1, min: 1 },
  },
  drop: {
    description: 'Drop first N elements',
    category: 'Array',
    config: { count: 'number' },
    uiType: 'numeric',
    uiOptions: { label: 'Count', step: 1, min: 1 },
  },
  chunk: {
    description: 'Split into chunks of size N',
    category: 'Array',
    config: { size: 'number' },
    uiType: 'numeric',
    uiOptions: { label: 'Chunk size', step: 1, min: 1 },
  },

  // Nested handler configs
  filter: {
    description: 'Filter elements by predicate',
    category: 'Array',
    config: { handler: 'handler', config: 'object' },
    uiType: 'nested',
    uiOptions: { type: 'predicate' },
  },
  map: {
    description: 'Transform each element',
    category: 'Array',
    config: { handler: 'handler', config: 'object' },
    uiType: 'nested',
    uiOptions: { type: 'transform' },
  },
  when: {
    description: 'Apply handler conditionally',
    category: 'Conditional',
    config: { handler: 'handler', config: 'object' },
    uiType: 'nested',
    uiOptions: { type: 'predicate' },
  },
  tap: {
    description: 'Execute handler for side effect',
    category: 'Utility',
    config: { handler: 'handler', config: 'object' },
    uiType: 'nested',
    uiOptions: { type: 'any' },
  },

  // Conditional handlers
  ifElse: {
    description: 'If-then-else branching',
    category: 'Conditional',
    config: { predicate: 'handler', then: 'handler', else: 'handler' },
    uiType: 'conditional',
    uiOptions: { type: 'ifElse' },
  },
  cond: {
    description: 'Multiple condition branches',
    category: 'Conditional',
    config: { cases: 'array', default: 'handler' },
    uiType: 'conditional',
    uiOptions: { type: 'cond' },
  },

  // String handlers
  format: {
    description: 'Format string with template',
    category: 'String',
    config: { template: 'string' },
    uiType: 'template',
    uiOptions: { placeholder: 'Hello {0}, you have {1} messages' },
  },
  replace: {
    description: 'Replace pattern in string',
    category: 'String',
    config: { pattern: 'string', replacement: 'string', flags: 'string' },
    uiType: 'regex',
    uiOptions: {},
  },
  match: {
    description: 'Match pattern in string',
    category: 'String',
    config: { pattern: 'string', flags: 'string' },
    uiType: 'regex',
    uiOptions: { noReplacement: true },
  },
  split: {
    description: 'Split string by delimiter',
    category: 'String',
    config: { delimiter: 'string' },
    uiType: 'template',
    uiOptions: { label: 'Delimiter', presets: [',', ';', '\\n', '\\t', ' '] },
  },
  join: {
    description: 'Join array with delimiter',
    category: 'Array',
    config: { delimiter: 'string' },
    uiType: 'template',
    uiOptions: { label: 'Delimiter', presets: [',', ', ', ' ', '\\n'] },
  },

  // Type coercion
  coerce: {
    description: 'Convert to type',
    category: 'Type',
    config: { to: 'string' },
    uiType: 'typeSelector',
    uiOptions: { types: ['number', 'string', 'boolean', 'json'] },
  },

  // Structural handlers
  zip: {
    description: 'Combine inputs into object',
    category: 'Structural',
    config: { keys: 'array' },
    uiType: 'multiKeySelector',
    uiOptions: { ordered: true, placeholder: 'Keys for zipped object' },
  },

  // No config handlers
  identity: { description: 'Return input unchanged', category: 'Utility', uiType: 'none' },
  sum: { description: 'Sum all numbers', category: 'Reducers', uiType: 'none' },
  product: { description: 'Multiply all numbers', category: 'Reducers', uiType: 'none' },
  min: { description: 'Find minimum', category: 'Reducers', uiType: 'none' },
  max: { description: 'Find maximum', category: 'Reducers', uiType: 'none' },
  average: { description: 'Calculate average', category: 'Reducers', uiType: 'none' },
  count: { description: 'Count elements', category: 'Reducers', uiType: 'none' },
  first: { description: 'Get first element', category: 'Array', uiType: 'none' },
  last: { description: 'Get last element', category: 'Array', uiType: 'none' },
  reverse: { description: 'Reverse array', category: 'Array', uiType: 'none' },
  flatten: { description: 'Flatten nested arrays', category: 'Array', uiType: 'none' },
  unique: { description: 'Remove duplicates', category: 'Array', uiType: 'none' },
  compact: { description: 'Remove falsy values', category: 'Array', uiType: 'none' },
  keys: { description: 'Get object keys', category: 'Object', uiType: 'none' },
  values: { description: 'Get object values', category: 'Object', uiType: 'none' },
  entries: { description: 'Get object entries', category: 'Object', uiType: 'none' },
  not: { description: 'Logical NOT', category: 'Logic', uiType: 'none' },
  and: { description: 'Logical AND', category: 'Logic', uiType: 'none' },
  or: { description: 'Logical OR', category: 'Logic', uiType: 'none' },
  negate: { description: 'Negate number', category: 'Arithmetic', uiType: 'none' },
  abs: { description: 'Absolute value', category: 'Arithmetic', uiType: 'none' },
  floor: { description: 'Floor value', category: 'Arithmetic', uiType: 'none' },
  ceil: { description: 'Ceiling value', category: 'Arithmetic', uiType: 'none' },
  round: { description: 'Round value', category: 'Arithmetic', uiType: 'none' },
  lowercase: { description: 'Convert to lowercase', category: 'String', uiType: 'none' },
  uppercase: { description: 'Convert to uppercase', category: 'String', uiType: 'none' },
  trim: { description: 'Trim whitespace', category: 'String', uiType: 'none' },
  length: { description: 'Get length', category: 'Utility', uiType: 'none' },
  isEmpty: { description: 'Check if empty', category: 'Utility', uiType: 'none' },
  isNull: { description: 'Check if null', category: 'Utility', uiType: 'none' },
  isNumber: { description: 'Check if number', category: 'Type', uiType: 'none' },
  isString: { description: 'Check if string', category: 'Type', uiType: 'none' },
  isArray: { description: 'Check if array', category: 'Type', uiType: 'none' },
  isObject: { description: 'Check if object', category: 'Type', uiType: 'none' },
  isBoolean: { description: 'Check if boolean', category: 'Type', uiType: 'none' },
  pair: { description: 'Pair two inputs', category: 'Structural', uiType: 'none' },
  unzip: { description: 'Extract from object', category: 'Structural', uiType: 'none' },
}

// Get metadata for a handler
export function getHandlerMetadata(name: string): HandlerMetadata | null {
  return HANDLER_METADATA[name] || null
}

// Check if handler requires config
export function handlerRequiresConfig(name: string): boolean {
  const meta = HANDLER_METADATA[name]
  return meta?.uiType !== 'none' && meta?.uiType !== undefined
}

// Get handlers by UI type
function getHandlersByUIType(uiType: UIType): string[] {
  return Object.entries(HANDLER_METADATA)
    .filter(([_, meta]) => meta.uiType === uiType)
    .map(([name]) => name)
}
