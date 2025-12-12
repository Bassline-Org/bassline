import { createSignal, createMemo, For, Show } from 'solid-js'

interface KeySelectorProps {
  value: string | string[]
  onChange: (value: string | string[]) => void
  mode: 'single' | 'multi' | 'path'
  placeholder?: string
  suggestions?: string[]
}

/**
 * KeySelector - Autocomplete dropdown for key selection
 *
 * Used for handlers like pick, get, groupBy, sortBy, etc.
 * Supports single key, multiple keys, and dot-notation paths.
 */
export default function KeySelector(props: KeySelectorProps) {
  const [inputValue, setInputValue] = createSignal(
    Array.isArray(props.value) ? props.value.join(', ') : (props.value ?? '')
  )
  const [showSuggestions, setShowSuggestions] = createSignal(false)
  const [focusedIndex, setFocusedIndex] = createSignal(-1)

  const isMulti = () => props.mode === 'multi'
  const isPath = () => props.mode === 'path'

  // Parse current keys from input
  const currentKeys = createMemo(() => {
    const val = inputValue()
    if (!val) return []
    if (isMulti()) {
      return val
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
    }
    return [val]
  })

  // Filter suggestions based on input
  const filteredSuggestions = createMemo(() => {
    if (!props.suggestions?.length) return []
    const input = inputValue().toLowerCase()
    const lastPart = isMulti() ? input.split(',').pop()?.trim() || '' : input

    return props.suggestions
      .filter((s) => s.toLowerCase().includes(lastPart) && !currentKeys().includes(s))
      .slice(0, 10)
  })

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement
    setInputValue(target.value)
    setShowSuggestions(true)
    setFocusedIndex(-1)

    // Emit change for single/path mode immediately
    if (!isMulti()) {
      props.onChange(target.value)
    }
  }

  function handleBlur() {
    // Delay to allow click on suggestion
    setTimeout(() => {
      setShowSuggestions(false)
      if (isMulti()) {
        props.onChange(currentKeys())
      }
    }, 150)
  }

  function selectSuggestion(suggestion: string) {
    if (isMulti()) {
      const keys = currentKeys()
      // Remove partial input and add suggestion
      const parts = inputValue().split(',')
      parts.pop()
      parts.push(suggestion)
      const newValue = parts.join(', ') + ', '
      setInputValue(newValue)
      props.onChange([...keys.slice(0, -1), suggestion])
    } else {
      setInputValue(suggestion)
      props.onChange(suggestion)
    }
    setShowSuggestions(false)
  }

  function handleKeyDown(e: KeyboardEvent) {
    const suggestions = filteredSuggestions()

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((prev) => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && focusedIndex() >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[focusedIndex()])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  // Remove a key chip (multi mode)
  function removeKey(key: string) {
    const keys = currentKeys().filter((k) => k !== key)
    setInputValue(keys.join(', '))
    props.onChange(keys)
  }

  return (
    <div class="key-selector">
      <Show when={isMulti() && currentKeys().length > 0}>
        <div class="key-chips">
          <For each={currentKeys()}>
            {(key) => (
              <span class="key-chip">
                {key}
                <button class="chip-remove" onClick={() => removeKey(key)}>
                  ×
                </button>
              </span>
            )}
          </For>
        </div>
      </Show>

      <div class="input-wrapper">
        <Show when={isPath()}>
          <span class="path-icon">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </span>
        </Show>

        <input
          type="text"
          class={`key-input ${isPath() ? 'with-icon' : ''}`}
          value={inputValue()}
          placeholder={
            props.placeholder || (isMulti() ? 'Enter keys, comma-separated' : 'Enter key')
          }
          onInput={handleInput}
          onFocus={() => setShowSuggestions(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />

        <Show when={isPath() && inputValue()}>
          <div class="path-preview">
            <For each={inputValue().split('.')}>
              {(part, i) => (
                <>
                  <Show when={i() > 0}>
                    <span class="path-dot">.</span>
                  </Show>
                  <span class="path-part">{part}</span>
                </>
              )}
            </For>
          </div>
        </Show>
      </div>

      <Show when={showSuggestions() && filteredSuggestions().length > 0}>
        <div class="suggestions-dropdown">
          <For each={filteredSuggestions()}>
            {(suggestion, i) => (
              <div
                class={`suggestion-item ${focusedIndex() === i() ? 'focused' : ''}`}
                onClick={() => selectSuggestion(suggestion)}
              >
                {suggestion}
              </div>
            )}
          </For>
        </div>
      </Show>

      <style>{`
        .key-selector {
          position: relative;
        }

        .key-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 8px;
        }

        .key-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: #238636;
          color: white;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .chip-remove {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 0;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-size: 14px;
          opacity: 0.7;
        }

        .chip-remove:hover {
          opacity: 1;
          background: rgba(255,255,255,0.2);
        }

        .input-wrapper {
          position: relative;
        }

        .key-input {
          width: 100%;
          padding: 10px 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
        }

        .key-input.with-icon {
          padding-left: 36px;
        }

        .key-input:focus {
          border-color: #58a6ff;
        }

        .key-input::placeholder {
          color: #6e7681;
        }

        .path-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #6e7681;
        }

        .path-preview {
          margin-top: 8px;
          padding: 8px;
          background: #21262d;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
        }

        .path-part {
          color: #58a6ff;
        }

        .path-dot {
          color: #6e7681;
          margin: 0 2px;
        }

        .suggestions-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 4px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          max-height: 200px;
          overflow-y: auto;
          z-index: 100;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }

        .suggestion-item {
          padding: 8px 12px;
          cursor: pointer;
          font-size: 13px;
          color: #c9d1d9;
        }

        .suggestion-item:hover,
        .suggestion-item.focused {
          background: #21262d;
        }

        .suggestion-item:first-child {
          border-radius: 6px 6px 0 0;
        }

        .suggestion-item:last-child {
          border-radius: 0 0 6px 6px;
        }
      `}</style>
    </div>
  )
}
