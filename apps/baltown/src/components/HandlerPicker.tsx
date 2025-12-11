import { createSignal, createMemo, For, Show } from 'solid-js'
import { useResource } from '@bassline/solid'

// Handler categories with descriptions based on packages/handlers/README.md
const HANDLER_CATEGORIES = {
  reducers: {
    name: 'Reducers',
    description: 'Variadic handlers that reduce multiple values to one',
    handlers: {
      sum: { description: 'Sum all input values', config: null },
      product: { description: 'Multiply all input values', config: null },
      min: { description: 'Return minimum numeric value', config: null },
      max: { description: 'Return maximum numeric value', config: null },
      average: { description: 'Return average of numeric values', config: null },
      concat: { description: 'Concatenate arrays or strings', config: null },
      first: { description: 'Return first non-null value', config: null },
      last: { description: 'Return last non-null value', config: null }
    }
  },
  binary: {
    name: 'Binary Operations',
    description: 'Two-argument arithmetic operations',
    handlers: {
      add: { description: 'Add value to input', config: { value: 'number' } },
      subtract: { description: 'Subtract value from input', config: { value: 'number' } },
      multiply: { description: 'Multiply input by value', config: { value: 'number' } },
      divide: { description: 'Divide input by value', config: { value: 'number' } },
      modulo: { description: 'Return input modulo value', config: { value: 'number' } },
      power: { description: 'Raise input to power', config: { value: 'number' } }
    }
  },
  arithmetic: {
    name: 'Arithmetic (Unary)',
    description: 'Single-argument math operations',
    handlers: {
      negate: { description: 'Negate the input value', config: null },
      abs: { description: 'Return absolute value', config: null },
      round: { description: 'Round to nearest integer', config: null },
      floor: { description: 'Round down to integer', config: null },
      ceil: { description: 'Round up to integer', config: null }
    }
  },
  comparison: {
    name: 'Comparison',
    description: 'Compare values, return boolean',
    handlers: {
      eq: { description: 'Equal to value', config: { value: 'any' } },
      neq: { description: 'Not equal to value', config: { value: 'any' } },
      gt: { description: 'Greater than value', config: { value: 'number' } },
      gte: { description: 'Greater than or equal', config: { value: 'number' } },
      lt: { description: 'Less than value', config: { value: 'number' } },
      lte: { description: 'Less than or equal', config: { value: 'number' } },
      deepEq: { description: 'Deep equality check', config: { value: 'any' } }
    }
  },
  logic: {
    name: 'Logic',
    description: 'Boolean logic operations',
    handlers: {
      and: { description: 'Logical AND of all inputs', config: null },
      or: { description: 'Logical OR of all inputs', config: null },
      not: { description: 'Logical NOT', config: null },
      xor: { description: 'Logical XOR', config: null }
    }
  },
  string: {
    name: 'String',
    description: 'String manipulation handlers',
    handlers: {
      split: { description: 'Split string by separator', config: { separator: 'string' } },
      join: { description: 'Join array with separator', config: { separator: 'string' } },
      trim: { description: 'Remove whitespace from ends', config: null },
      uppercase: { description: 'Convert to uppercase', config: null },
      lowercase: { description: 'Convert to lowercase', config: null },
      strSlice: { description: 'Extract substring', config: { start: 'number', end: 'number' } },
      replace: { description: 'Replace pattern with string', config: { pattern: 'string', replacement: 'string' } },
      match: { description: 'Match against regex pattern', config: { pattern: 'string' } },
      startsWith: { description: 'Check if starts with prefix', config: { value: 'string' } },
      endsWith: { description: 'Check if ends with suffix', config: { value: 'string' } },
      includes: { description: 'Check if contains substring', config: { value: 'string' } }
    }
  },
  array: {
    name: 'Array',
    description: 'Array manipulation handlers',
    handlers: {
      length: { description: 'Get array/string length', config: null },
      at: { description: 'Get element at index', config: { index: 'number' } },
      head: { description: 'Get first element', config: null },
      tail: { description: 'Get all but first element', config: null },
      init: { description: 'Get all but last element', config: null },
      reverse: { description: 'Reverse array order', config: null },
      sort: { description: 'Sort array', config: null },
      sortBy: { description: 'Sort by key', config: { key: 'string' } },
      unique: { description: 'Remove duplicates', config: null },
      flatten: { description: 'Flatten nested arrays', config: null },
      compact: { description: 'Remove null/undefined', config: null },
      take: { description: 'Take first n elements', config: { count: 'number' } },
      drop: { description: 'Drop first n elements', config: { count: 'number' } },
      chunk: { description: 'Split into chunks', config: { size: 'number' } }
    }
  },
  arrayReducers: {
    name: 'Array Reducers',
    description: 'Reduce arrays to values',
    handlers: {
      arraySum: { description: 'Sum array elements', config: null },
      arrayProduct: { description: 'Multiply array elements', config: null },
      arrayAverage: { description: 'Average of array', config: null },
      arrayMin: { description: 'Minimum in array', config: null },
      arrayMax: { description: 'Maximum in array', config: null },
      sumBy: { description: 'Sum by key', config: { key: 'string' } },
      countBy: { description: 'Count by key', config: { key: 'string' } },
      groupBy: { description: 'Group by key', config: { key: 'string' } },
      indexBy: { description: 'Index by key', config: { key: 'string' } },
      minBy: { description: 'Min by key', config: { key: 'string' } },
      maxBy: { description: 'Max by key', config: { key: 'string' } },
      fold: { description: 'Reduce with handler', config: { handler: 'string', initial: 'any' } },
      scan: { description: 'Reduce keeping intermediates', config: { handler: 'string', initial: 'any' } }
    }
  },
  object: {
    name: 'Object',
    description: 'Object manipulation handlers',
    handlers: {
      keys: { description: 'Get object keys', config: null },
      values: { description: 'Get object values', config: null },
      entries: { description: 'Get [key, value] pairs', config: null },
      fromEntries: { description: 'Create object from pairs', config: null },
      get: { description: 'Get nested property', config: { path: 'string' } },
      has: { description: 'Check if property exists', config: { key: 'string' } },
      omit: { description: 'Remove keys', config: { keys: 'array' } },
      defaults: { description: 'Apply default values', config: { defaults: 'object' } },
      merge: { description: 'Merge objects', config: null }
    }
  },
  type: {
    name: 'Type Checking',
    description: 'Check value types',
    handlers: {
      isNull: { description: 'Check if null/undefined', config: null },
      isNumber: { description: 'Check if number', config: null },
      isString: { description: 'Check if string', config: null },
      isArray: { description: 'Check if array', config: null },
      isObject: { description: 'Check if object', config: null },
      typeOf: { description: 'Get type name', config: null }
    }
  },
  conditional: {
    name: 'Conditional',
    description: 'Conditional logic handlers',
    handlers: {
      filter: { description: 'Filter by predicate handler', config: { handler: 'string' } },
      when: { description: 'Apply handler if predicate', config: { predicate: 'string', handler: 'string' } },
      ifElse: { description: 'If-then-else with handlers', config: { predicate: 'string', onTrue: 'string', onFalse: 'string' } },
      cond: { description: 'Multiple conditions', config: { conditions: 'array' } }
    }
  },
  structural: {
    name: 'Structural',
    description: 'Restructure data',
    handlers: {
      pair: { description: 'Create [a, b] pair', config: null },
      zip: { description: 'Combine into object', config: { keys: 'array' } },
      unzip: { description: 'Split object to arrays', config: null },
      pick: { description: 'Select keys', config: { keys: 'array' } },
      map: { description: 'Apply handler to each', config: { handler: 'string' } }
    }
  },
  utility: {
    name: 'Utility',
    description: 'General purpose handlers',
    handlers: {
      identity: { description: 'Return input unchanged', config: null },
      passthrough: { description: 'Pass through unchanged', config: null },
      constant: { description: 'Always return value', config: { value: 'any' } },
      always: { description: 'Alias for constant', config: { value: 'any' } },
      tap: { description: 'Side effect, return input', config: { handler: 'string' } },
      defaultTo: { description: 'Default if null', config: { value: 'any' } },
      format: { description: 'Format string template', config: { template: 'string' } },
      coerce: { description: 'Convert to type', config: { to: 'string' } }
    }
  },
  combinators: {
    name: 'Combinators',
    description: 'Compose handlers together',
    handlers: {
      pipe: { description: 'Left-to-right composition', config: null },
      sequence: { description: 'Same as pipe', config: null },
      compose: { description: 'Right-to-left composition', config: null },
      hook: { description: 'f(x, g(x))', config: null },
      both: { description: '[f(x,y), g(x,y)]', config: null },
      flip: { description: 'f(y,x) instead of f(x,y)', config: null },
      fork: { description: 'Apply multiple handlers', config: null },
      converge: { description: 'Converge results', config: null },
      tryCatch: { description: 'Try handler, catch errors', config: { handler: 'string', fallback: 'string' } }
    }
  }
}

interface HandlerPickerProps {
  value: string
  onChange: (handler: string) => void
  onConfigChange?: (config: object) => void
  showComposition?: boolean
}

export default function HandlerPicker(props: HandlerPickerProps) {
  const [search, setSearch] = createSignal('')
  const [selectedCategory, setSelectedCategory] = createSignal<string | null>(null)
  const [expanded, setExpanded] = createSignal(false)

  // Filter handlers based on search
  const filteredCategories = createMemo(() => {
    const searchTerm = search().toLowerCase()
    if (!searchTerm) return HANDLER_CATEGORIES

    const filtered: typeof HANDLER_CATEGORIES = {} as any
    for (const [catKey, category] of Object.entries(HANDLER_CATEGORIES)) {
      const matchingHandlers: typeof category.handlers = {} as any
      for (const [name, info] of Object.entries(category.handlers)) {
        if (name.toLowerCase().includes(searchTerm) ||
            info.description.toLowerCase().includes(searchTerm)) {
          matchingHandlers[name] = info
        }
      }
      if (Object.keys(matchingHandlers).length > 0) {
        filtered[catKey] = { ...category, handlers: matchingHandlers }
      }
    }
    return filtered
  })

  // Get currently selected handler info
  const selectedInfo = createMemo(() => {
    const handlerName = props.value
    if (!handlerName) return null

    for (const category of Object.values(HANDLER_CATEGORIES)) {
      if (handlerName in category.handlers) {
        return {
          name: handlerName,
          ...category.handlers[handlerName as keyof typeof category.handlers]
        }
      }
    }
    return null
  })

  function selectHandler(name: string) {
    props.onChange(name)
    setExpanded(false)
  }

  return (
    <div class="handler-picker">
      <div class="picker-input" onClick={() => setExpanded(!expanded())}>
        <Show when={props.value} fallback={<span class="placeholder">Select a handler...</span>}>
          <span class="selected-handler">
            <code>{props.value}</code>
            <Show when={selectedInfo()}>
              <span class="handler-desc">{selectedInfo()?.description}</span>
            </Show>
          </span>
        </Show>
        <span class="expand-icon">{expanded() ? '▲' : '▼'}</span>
      </div>

      <Show when={expanded()}>
        <div class="picker-dropdown">
          <input
            type="text"
            class="picker-search"
            placeholder="Search handlers..."
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            onClick={(e) => e.stopPropagation()}
          />

          <div class="picker-categories">
            <For each={Object.entries(filteredCategories())}>
              {([catKey, category]) => (
                <div class="picker-category">
                  <div
                    class={`category-header ${selectedCategory() === catKey ? 'expanded' : ''}`}
                    onClick={() => setSelectedCategory(selectedCategory() === catKey ? null : catKey)}
                  >
                    <span class="category-name">{category.name}</span>
                    <span class="category-count">{Object.keys(category.handlers).length}</span>
                  </div>
                  <Show when={selectedCategory() === catKey || search()}>
                    <div class="category-handlers">
                      <For each={Object.entries(category.handlers)}>
                        {([name, info]) => (
                          <div
                            class={`handler-item ${props.value === name ? 'selected' : ''}`}
                            onClick={() => selectHandler(name)}
                          >
                            <code class="handler-name">{name}</code>
                            <span class="handler-description">{info.description}</span>
                            <Show when={info.config}>
                              <span class="has-config" title="Requires config">*</span>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      <style>{`
        .handler-picker {
          position: relative;
        }

        .picker-input {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          cursor: pointer;
          min-height: 38px;
        }

        .picker-input:hover {
          border-color: #58a6ff;
        }

        .placeholder {
          color: #8b949e;
        }

        .selected-handler {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .selected-handler code {
          color: #58a6ff;
          font-size: 13px;
        }

        .handler-desc {
          color: #8b949e;
          font-size: 12px;
        }

        .expand-icon {
          color: #8b949e;
          font-size: 10px;
        }

        .picker-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 4px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          max-height: 400px;
          overflow-y: auto;
          z-index: 100;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }

        .picker-search {
          width: 100%;
          padding: 10px 12px;
          background: #0d1117;
          border: none;
          border-bottom: 1px solid #30363d;
          color: #c9d1d9;
          font-size: 13px;
        }

        .picker-search:focus {
          outline: none;
          background: #161b22;
        }

        .picker-categories {
          padding: 4px 0;
        }

        .category-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .category-header:hover {
          background: #21262d;
          color: #c9d1d9;
        }

        .category-header.expanded {
          color: #58a6ff;
        }

        .category-count {
          background: #30363d;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 11px;
        }

        .category-handlers {
          padding: 4px 0;
          border-bottom: 1px solid #21262d;
        }

        .handler-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px 6px 24px;
          cursor: pointer;
          font-size: 13px;
        }

        .handler-item:hover {
          background: #21262d;
        }

        .handler-item.selected {
          background: #1f6feb33;
        }

        .handler-name {
          color: #79c0ff;
          min-width: 100px;
        }

        .handler-description {
          color: #8b949e;
          font-size: 12px;
          flex: 1;
        }

        .has-config {
          color: #f78166;
          font-weight: bold;
        }
      `}</style>
    </div>
  )
}

// Export the categories for use elsewhere
export { HANDLER_CATEGORIES }
