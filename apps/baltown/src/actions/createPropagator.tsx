import { createSignal, For, Show } from 'solid-js'
import type { Action, ActionContext, Resource } from './types'

type Phase = 'name' | 'inputs' | 'output' | 'handler' | 'ready'

/**
 * Create Propagator Action
 *
 * Multi-step action with targeting:
 * 1. Enter propagator name
 * 2. Click cells to select inputs (Enter when done)
 * 3. Click cell to select output
 * 4. Select handler
 * 5. Create
 */
export function createPropagatorAction(): Action {
  // Internal state
  let ctx: ActionContext | null = null
  const [phase, setPhase] = createSignal<Phase>('name')
  const [name, setName] = createSignal('')
  const [inputs, setInputs] = createSignal<string[]>([])
  const [output, setOutput] = createSignal<string | null>(null)
  const [handler, setHandler] = createSignal('identity')

  // Phase prompts
  const phasePrompts: Record<Phase, string> = {
    name: 'Enter propagator name',
    inputs: 'Click cells to add as inputs (Enter when done)',
    output: 'Click a cell to set as output',
    handler: 'Select a handler',
    ready: 'Ready to create',
  }

  function advancePhase() {
    const current = phase()
    if (current === 'name' && name().trim()) {
      setPhase('inputs')
    } else if (current === 'inputs' && inputs().length > 0) {
      setPhase('output')
    } else if (current === 'output' && output()) {
      setPhase('handler')
    } else if (current === 'handler') {
      setPhase('ready')
      ctx?.complete()
    }
  }

  function goBack() {
    const current = phase()
    if (current === 'inputs') setPhase('name')
    else if (current === 'output') setPhase('inputs')
    else if (current === 'handler') setPhase('output')
  }

  return {
    id: 'create-propagator',
    name: 'Create Propagator',
    description: 'Connect cells with a handler',

    icon: () => (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
        <line x1="12" y1="22" x2="12" y2="15.5" />
        <line x1="22" y1="8.5" x2="12" y2="15.5" />
        <line x1="2" y1="8.5" x2="12" y2="15.5" />
      </svg>
    ),

    onStart(context) {
      ctx = context
      setPhase('name')
      setName('')
      setInputs([])
      setOutput(null)
      setHandler('identity')
    },

    onCancel() {
      ctx = null
    },

    onClick(target: Resource) {
      const currentPhase = phase()

      if (currentPhase === 'inputs' && target.type === 'cell') {
        const uri = target.uri
        // Toggle selection
        if (inputs().includes(uri)) {
          setInputs(inputs().filter((i) => i !== uri))
        } else {
          setInputs([...inputs(), uri])
        }
      } else if (currentPhase === 'output' && target.type === 'cell') {
        setOutput(target.uri)
        advancePhase()
      }
    },

    onKeyDown(event) {
      if (event.key === 'Enter') {
        advancePhase()
      } else if (event.key === 'Backspace' && phase() !== 'name') {
        goBack()
      }
    },

    renderOverlay() {
      const currentPhase = phase()

      return (
        <div class="create-propagator-overlay">
          {/* Targeting mode indicator */}
          <Show when={currentPhase === 'inputs' || currentPhase === 'output'}>
            <div class="targeting-prompt">
              <div class="prompt-content">
                <span class="prompt-step">Step {currentPhase === 'inputs' ? 2 : 3}/4</span>
                <span class="prompt-text">{phasePrompts[currentPhase]}</span>
              </div>
              <Show when={currentPhase === 'inputs'}>
                <div class="selected-items">
                  <For each={inputs()}>
                    {(uri) => (
                      <span class="selected-tag">
                        {uri.split('/').pop()}
                        <button onClick={() => setInputs(inputs().filter((i) => i !== uri))}>
                          ×
                        </button>
                      </span>
                    )}
                  </For>
                </div>
                <div class="prompt-hint">Press Enter when done selecting inputs</div>
              </Show>
              <Show when={currentPhase === 'output' && output()}>
                <div class="selected-output">
                  Output: <strong>{output()?.split('/').pop()}</strong>
                </div>
              </Show>
            </div>
          </Show>

          {/* Name entry form */}
          <Show when={currentPhase === 'name'}>
            <div class="overlay-card">
              <h3>Create Propagator</h3>
              <p class="step-indicator">Step 1/4: Name</p>

              <div class="form-field">
                <label>Propagator Name</label>
                <input
                  type="text"
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  placeholder="my-propagator"
                  autofocus
                />
              </div>

              <div class="form-actions">
                <button class="cancel-btn" onClick={() => ctx?.cancel()}>
                  Cancel
                </button>
                <button class="next-btn" disabled={!name().trim()} onClick={advancePhase}>
                  Next →
                </button>
              </div>
            </div>
          </Show>

          {/* Handler selection form */}
          <Show when={currentPhase === 'handler'}>
            <div class="overlay-card">
              <h3>Select Handler</h3>
              <p class="step-indicator">Step 4/4: Handler</p>

              <div class="form-field">
                <label>Handler</label>
                <select value={handler()} onChange={(e) => setHandler(e.currentTarget.value)}>
                  <optgroup label="Reducers">
                    <option value="sum">sum</option>
                    <option value="product">product</option>
                    <option value="min">min</option>
                    <option value="max">max</option>
                    <option value="average">average</option>
                  </optgroup>
                  <optgroup label="Math">
                    <option value="add">add</option>
                    <option value="subtract">subtract</option>
                    <option value="multiply">multiply</option>
                    <option value="divide">divide</option>
                    <option value="negate">negate</option>
                  </optgroup>
                  <optgroup label="Logic">
                    <option value="and">and</option>
                    <option value="or">or</option>
                    <option value="not">not</option>
                  </optgroup>
                  <optgroup label="Utility">
                    <option value="identity">identity</option>
                    <option value="constant">constant</option>
                    <option value="pick">pick</option>
                  </optgroup>
                </select>
              </div>

              <div class="summary">
                <div>
                  <strong>Name:</strong> {name()}
                </div>
                <div>
                  <strong>Inputs:</strong>{' '}
                  {inputs()
                    .map((i) => i.split('/').pop())
                    .join(', ')}
                </div>
                <div>
                  <strong>Output:</strong> {output()?.split('/').pop()}
                </div>
              </div>

              <div class="form-actions">
                <button class="back-btn" onClick={goBack}>
                  ← Back
                </button>
                <button class="create-btn" onClick={advancePhase}>
                  Create Propagator
                </button>
              </div>
            </div>
          </Show>

          <style>{`
            .create-propagator-overlay {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              pointer-events: none;
            }

            .targeting-prompt {
              position: absolute;
              top: 20px;
              left: 50%;
              transform: translateX(-50%);
              z-index: 10;
              background: #161b22;
              border: 2px solid #58a6ff;
              border-radius: 12px;
              padding: 16px 24px;
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
              pointer-events: auto;
            }

            .prompt-content {
              display: flex;
              align-items: center;
              gap: 12px;
            }

            .prompt-step {
              background: #58a6ff;
              color: #0d1117;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 600;
            }

            .prompt-text {
              color: #c9d1d9;
              font-size: 14px;
              font-weight: 500;
            }

            .selected-items {
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              margin-top: 12px;
            }

            .selected-tag {
              display: flex;
              align-items: center;
              gap: 4px;
              background: #238636;
              color: #fff;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
            }

            .selected-tag button {
              background: none;
              border: none;
              color: rgba(255,255,255,0.7);
              cursor: pointer;
              padding: 0 2px;
              font-size: 14px;
            }

            .selected-tag button:hover {
              color: #fff;
            }

            .prompt-hint {
              margin-top: 8px;
              color: #8b949e;
              font-size: 12px;
            }

            .selected-output {
              margin-top: 8px;
              color: #3fb950;
              font-size: 13px;
            }

            .overlay-card {
              position: relative;
              z-index: 10;
              background: #161b22;
              border: 1px solid #30363d;
              border-radius: 12px;
              padding: 24px;
              min-width: 360px;
              box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
              pointer-events: auto;
            }

            .overlay-card h3 {
              margin: 0 0 4px;
              color: #c9d1d9;
              font-size: 16px;
              font-weight: 600;
            }

            .step-indicator {
              margin: 0 0 20px;
              color: #8b949e;
              font-size: 12px;
            }

            .form-field {
              margin-bottom: 16px;
            }

            .form-field label {
              display: block;
              margin-bottom: 6px;
              font-size: 12px;
              font-weight: 500;
              color: #8b949e;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }

            .form-field input,
            .form-field select {
              width: 100%;
              padding: 10px 12px;
              background: #0d1117;
              border: 1px solid #30363d;
              border-radius: 6px;
              color: #c9d1d9;
              font-size: 14px;
            }

            .form-field input:focus,
            .form-field select:focus {
              outline: none;
              border-color: #58a6ff;
            }

            .summary {
              background: #0d1117;
              border-radius: 6px;
              padding: 12px;
              margin-bottom: 16px;
              font-size: 13px;
              color: #8b949e;
            }

            .summary div {
              margin-bottom: 4px;
            }

            .summary strong {
              color: #c9d1d9;
            }

            .form-actions {
              display: flex;
              justify-content: flex-end;
              gap: 8px;
              margin-top: 20px;
            }

            .cancel-btn,
            .back-btn {
              padding: 8px 16px;
              background: transparent;
              border: 1px solid #30363d;
              border-radius: 6px;
              color: #8b949e;
              font-size: 13px;
              cursor: pointer;
            }

            .cancel-btn:hover,
            .back-btn:hover {
              color: #c9d1d9;
              border-color: #8b949e;
            }

            .next-btn,
            .create-btn {
              padding: 8px 16px;
              background: #238636;
              border: none;
              border-radius: 6px;
              color: #fff;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
            }

            .next-btn:hover:not(:disabled),
            .create-btn:hover:not(:disabled) {
              background: #2ea043;
            }

            .next-btn:disabled,
            .create-btn:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
          `}</style>
        </div>
      )
    },

    isComplete() {
      return (
        phase() === 'ready' && name().trim().length > 0 && inputs().length > 0 && output() !== null
      )
    },

    async execute() {
      if (!ctx) return

      const propName = name().trim()

      try {
        await ctx.bl.put(
          `bl:///r/propagators/${propName}`,
          {},
          {
            inputs: inputs(),
            output: output(),
            handler: handler(),
          }
        )
        ctx.toast.success(`Created propagator "${propName}"`)
        ctx.refresh()
      } catch (err) {
        console.error('Failed to create propagator:', err)
        ctx.toast.error(`Failed to create propagator: ${err}`)
      }
    },
  }
}
