import { createSignal, createMemo, Show, For } from 'solid-js'

interface RegexEditorProps {
  pattern: string
  flags?: string
  replacement?: string
  onPatternChange: (pattern: string) => void
  onFlagsChange?: (flags: string) => void
  onReplacementChange?: (replacement: string) => void
  showReplacement?: boolean
  testString?: string
}

const FLAG_OPTIONS = [
  { flag: 'g', label: 'Global', description: 'Match all occurrences' },
  { flag: 'i', label: 'Ignore case', description: 'Case-insensitive matching' },
  { flag: 'm', label: 'Multiline', description: '^ and $ match line boundaries' },
]

const COMMON_PATTERNS = [
  { pattern: '\\d+', label: 'Numbers', example: '123' },
  { pattern: '\\w+', label: 'Words', example: 'hello' },
  { pattern: '\\s+', label: 'Whitespace', example: '   ' },
  { pattern: '[a-zA-Z]+', label: 'Letters', example: 'abc' },
  { pattern: '[^\\s]+', label: 'Non-whitespace', example: 'word' },
  { pattern: '\\b\\w+\\b', label: 'Word boundaries', example: 'the cat' },
]

/**
 * RegexEditor - Regex pattern builder with test area
 *
 * Used for handlers like replace and match.
 */
export default function RegexEditor(props: RegexEditorProps) {
  const [pattern, setPattern] = createSignal(props.pattern ?? '')
  const [flags, setFlags] = createSignal(props.flags ?? 'g')
  const [replacement, setReplacement] = createSignal(props.replacement ?? '')
  const [testInput, setTestInput] = createSignal(props.testString ?? 'Sample text to test')
  const [showPatterns, setShowPatterns] = createSignal(false)

  // Test the regex
  const testResult = createMemo(() => {
    try {
      const regex = new RegExp(pattern(), flags())
      const input = testInput()

      if (props.showReplacement !== false) {
        // Replace mode
        const result = input.replace(regex, replacement())
        const matches = input.match(regex) || []
        return { success: true, result, matches, matchCount: matches.length }
      } else {
        // Match mode
        const matches = input.match(regex) || []
        return { success: true, result: matches.join(', '), matches, matchCount: matches.length }
      }
    } catch (e: any) {
      return { success: false, error: e.message, matches: [], matchCount: 0 }
    }
  })

  // Highlight matches in test input
  const highlightedInput = createMemo(() => {
    try {
      const regex = new RegExp(pattern(), flags())
      return testInput().replace(regex, '<mark>$&</mark>')
    } catch {
      return testInput()
    }
  })

  function handlePatternChange(e: Event) {
    const value = (e.target as HTMLInputElement).value
    setPattern(value)
    props.onPatternChange(value)
  }

  function handleReplacementChange(e: Event) {
    const value = (e.target as HTMLInputElement).value
    setReplacement(value)
    props.onReplacementChange?.(value)
  }

  function toggleFlag(flag: string) {
    const current = flags()
    const newFlags = current.includes(flag)
      ? current.replace(flag, '')
      : current + flag
    setFlags(newFlags)
    props.onFlagsChange?.(newFlags)
  }

  function selectPattern(p: string) {
    setPattern(p)
    props.onPatternChange(p)
    setShowPatterns(false)
  }

  return (
    <div class="regex-editor">
      <div class="regex-main">
        <div class="regex-input-group">
          <span class="regex-slash">/</span>
          <input
            type="text"
            class="pattern-input"
            value={pattern()}
            placeholder="Enter regex pattern..."
            onInput={handlePatternChange}
          />
          <span class="regex-slash">/</span>
          <input
            type="text"
            class="flags-input"
            value={flags()}
            readonly
          />
          <button
            class="patterns-btn"
            onClick={() => setShowPatterns(!showPatterns())}
            title="Common patterns"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6h16M4 12h16M4 18h7"/>
            </svg>
          </button>
        </div>

        <Show when={showPatterns()}>
          <div class="patterns-dropdown">
            <For each={COMMON_PATTERNS}>
              {(p) => (
                <div class="pattern-option" onClick={() => selectPattern(p.pattern)}>
                  <code class="pattern-code">{p.pattern}</code>
                  <span class="pattern-label">{p.label}</span>
                  <span class="pattern-example">"{p.example}"</span>
                </div>
              )}
            </For>
          </div>
        </Show>

        <div class="flags-row">
          <For each={FLAG_OPTIONS}>
            {(opt) => (
              <label class="flag-option" title={opt.description}>
                <input
                  type="checkbox"
                  checked={flags().includes(opt.flag)}
                  onChange={() => toggleFlag(opt.flag)}
                />
                <span class="flag-label">{opt.label}</span>
                <span class="flag-char">({opt.flag})</span>
              </label>
            )}
          </For>
        </div>

        <Show when={props.showReplacement !== false}>
          <div class="replacement-row">
            <label class="field-label">Replace with:</label>
            <input
              type="text"
              class="replacement-input"
              value={replacement()}
              placeholder="Replacement text ($1, $2 for groups)"
              onInput={handleReplacementChange}
            />
          </div>
        </Show>
      </div>

      <div class="test-area">
        <label class="field-label">Test String:</label>
        <textarea
          class="test-input"
          value={testInput()}
          onInput={(e) => setTestInput(e.currentTarget.value)}
          rows={3}
        />

        <Show when={pattern()}>
          <div class="test-results">
            <Show when={testResult().success}>
              <div class="match-count">
                {testResult().matchCount} match{testResult().matchCount !== 1 ? 'es' : ''}
              </div>

              <Show when={testResult().matchCount > 0}>
                <div class="highlighted-preview" innerHTML={highlightedInput()} />
              </Show>

              <Show when={props.showReplacement !== false && testResult().matchCount > 0}>
                <div class="result-label">Result:</div>
                <div class="result-output">{testResult().result}</div>
              </Show>
            </Show>

            <Show when={!testResult().success}>
              <div class="regex-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4M12 16h.01"/>
                </svg>
                {testResult().error}
              </div>
            </Show>
          </div>
        </Show>
      </div>

      <style>{`
        .regex-editor {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .regex-main {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .regex-input-group {
          display: flex;
          align-items: center;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          overflow: hidden;
        }

        .regex-slash {
          padding: 0 8px;
          color: #6e7681;
          font-family: monospace;
          font-size: 18px;
        }

        .pattern-input {
          flex: 1;
          padding: 10px 4px;
          background: transparent;
          border: none;
          color: #79c0ff;
          font-family: monospace;
          font-size: 14px;
          outline: none;
        }

        .flags-input {
          width: 40px;
          padding: 10px 4px;
          background: transparent;
          border: none;
          color: #a371f7;
          font-family: monospace;
          font-size: 14px;
          outline: none;
          text-align: center;
        }

        .patterns-btn {
          padding: 10px 12px;
          background: #21262d;
          border: none;
          border-left: 1px solid #30363d;
          color: #8b949e;
          cursor: pointer;
        }

        .patterns-btn:hover {
          background: #30363d;
          color: #c9d1d9;
        }

        .patterns-dropdown {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          overflow: hidden;
        }

        .pattern-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          cursor: pointer;
        }

        .pattern-option:hover {
          background: #21262d;
        }

        .pattern-code {
          color: #79c0ff;
          font-size: 13px;
          min-width: 100px;
        }

        .pattern-label {
          color: #c9d1d9;
          font-size: 12px;
          flex: 1;
        }

        .pattern-example {
          color: #6e7681;
          font-size: 11px;
        }

        .flags-row {
          display: flex;
          gap: 16px;
        }

        .flag-option {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-size: 12px;
          color: #8b949e;
        }

        .flag-option:hover {
          color: #c9d1d9;
        }

        .flag-option input {
          accent-color: #238636;
        }

        .flag-char {
          color: #6e7681;
        }

        .field-label {
          font-size: 11px;
          color: #6e7681;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
          display: block;
        }

        .replacement-row {
          margin-top: 4px;
        }

        .replacement-input {
          width: 100%;
          padding: 10px 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-family: monospace;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
        }

        .replacement-input:focus {
          border-color: #58a6ff;
        }

        .test-area {
          padding: 12px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
        }

        .test-input {
          width: 100%;
          padding: 10px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-family: monospace;
          font-size: 13px;
          resize: vertical;
          outline: none;
          box-sizing: border-box;
        }

        .test-input:focus {
          border-color: #58a6ff;
        }

        .test-results {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .match-count {
          font-size: 12px;
          color: #3fb950;
          font-weight: 600;
        }

        .highlighted-preview {
          padding: 8px;
          background: #0d1117;
          border-radius: 4px;
          font-family: monospace;
          font-size: 13px;
          color: #c9d1d9;
        }

        .highlighted-preview mark {
          background: #388bfd44;
          color: #58a6ff;
          border-radius: 2px;
          padding: 0 2px;
        }

        .result-label {
          font-size: 11px;
          color: #6e7681;
          text-transform: uppercase;
        }

        .result-output {
          padding: 8px;
          background: #238636;
          border-radius: 4px;
          font-family: monospace;
          font-size: 13px;
          color: white;
        }

        .regex-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: #f8514922;
          border: 1px solid #f85149;
          border-radius: 4px;
          color: #f85149;
          font-size: 12px;
        }
      `}</style>
    </div>
  )
}
