import { createSignal, Show, For } from 'solid-js'
import NestedHandlerEditor from './NestedHandlerEditor'

interface ConditionalEditorProps {
  type: 'ifElse' | 'cond'
  config: {
    predicate?: string
    predicateConfig?: Record<string, any>
    then?: string
    thenConfig?: Record<string, any>
    else?: string
    elseConfig?: Record<string, any>
    cases?: Array<{
      predicate: string
      predicateConfig?: Record<string, any>
      handler: string
      handlerConfig?: Record<string, any>
    }>
    default?: string
    defaultConfig?: Record<string, any>
  }
  onChange: (config: any) => void
}

/**
 * ConditionalEditor - Visual branch editor for conditional handlers
 *
 * Used for handlers like ifElse and cond.
 */
export default function ConditionalEditor(props: ConditionalEditorProps) {
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({
    predicate: true,
    then: true,
    else: true,
  })

  // Helper to update nested config
  function updateConfig(path: string, value: any) {
    const newConfig = { ...props.config, [path]: value }
    props.onChange(newConfig)
  }

  // Add a new case for cond
  function addCase() {
    const cases = [...(props.config.cases || [])]
    cases.push({
      predicate: 'eq',
      predicateConfig: { value: '' },
      handler: 'identity',
      handlerConfig: {},
    })
    updateConfig('cases', cases)
  }

  // Remove a case
  function removeCase(index: number) {
    const cases = [...(props.config.cases || [])]
    cases.splice(index, 1)
    updateConfig('cases', cases)
  }

  // Update a case
  function updateCase(index: number, key: string, value: any) {
    const cases = [...(props.config.cases || [])]
    cases[index] = { ...cases[index], [key]: value }
    updateConfig('cases', cases)
  }

  return (
    <div class="conditional-editor">
      <Show when={props.type === 'ifElse'}>
        {/* If-Else Editor */}
        <div class="branch-container">
          {/* Predicate (IF) */}
          <div class="branch if-branch">
            <div
              class="branch-header"
              onClick={() => setExpanded((e) => ({ ...e, predicate: !e.predicate }))}
            >
              <span class="branch-label">IF</span>
              <span class="branch-summary">{props.config.predicate || 'Select predicate...'}</span>
              <svg
                class={`expand-icon ${expanded().predicate ? 'expanded' : ''}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            <Show when={expanded().predicate}>
              <div class="branch-content">
                <NestedHandlerEditor
                  handler={props.config.predicate || ''}
                  config={props.config.predicateConfig || {}}
                  onHandlerChange={(h) => updateConfig('predicate', h)}
                  onConfigChange={(c) => updateConfig('predicateConfig', c)}
                  type="predicate"
                />
              </div>
            </Show>
          </div>

          <div class="branch-connector">
            <div class="connector-line" />
            <div class="connector-split">
              <span class="split-label true-label">TRUE</span>
              <span class="split-label false-label">FALSE</span>
            </div>
          </div>

          {/* Then (TRUE) */}
          <div class="branch then-branch">
            <div
              class="branch-header"
              onClick={() => setExpanded((e) => ({ ...e, then: !e.then }))}
            >
              <span class="branch-label then">THEN</span>
              <span class="branch-summary">{props.config.then || 'Select handler...'}</span>
              <svg
                class={`expand-icon ${expanded().then ? 'expanded' : ''}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            <Show when={expanded().then}>
              <div class="branch-content">
                <NestedHandlerEditor
                  handler={props.config.then || ''}
                  config={props.config.thenConfig || {}}
                  onHandlerChange={(h) => updateConfig('then', h)}
                  onConfigChange={(c) => updateConfig('thenConfig', c)}
                  type="transform"
                />
              </div>
            </Show>
          </div>

          {/* Else (FALSE) */}
          <div class="branch else-branch">
            <div
              class="branch-header"
              onClick={() => setExpanded((e) => ({ ...e, else: !e.else }))}
            >
              <span class="branch-label else">ELSE</span>
              <span class="branch-summary">{props.config.else || 'Select handler...'}</span>
              <svg
                class={`expand-icon ${expanded().else ? 'expanded' : ''}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            <Show when={expanded().else}>
              <div class="branch-content">
                <NestedHandlerEditor
                  handler={props.config.else || ''}
                  config={props.config.elseConfig || {}}
                  onHandlerChange={(h) => updateConfig('else', h)}
                  onConfigChange={(c) => updateConfig('elseConfig', c)}
                  type="transform"
                />
              </div>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={props.type === 'cond'}>
        {/* Cond Editor - Multiple Cases */}
        <div class="cond-container">
          <For each={props.config.cases || []}>
            {(caseItem, index) => (
              <div class="cond-case">
                <div class="case-header">
                  <span class="case-number">Case {index() + 1}</span>
                  <button
                    class="remove-case-btn"
                    onClick={() => removeCase(index())}
                    title="Remove case"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div class="case-content">
                  <div class="case-predicate">
                    <label class="case-label">When:</label>
                    <NestedHandlerEditor
                      handler={caseItem.predicate}
                      config={caseItem.predicateConfig || {}}
                      onHandlerChange={(h) => updateCase(index(), 'predicate', h)}
                      onConfigChange={(c) => updateCase(index(), 'predicateConfig', c)}
                      type="predicate"
                    />
                  </div>

                  <div class="case-handler">
                    <label class="case-label">Do:</label>
                    <NestedHandlerEditor
                      handler={caseItem.handler}
                      config={caseItem.handlerConfig || {}}
                      onHandlerChange={(h) => updateCase(index(), 'handler', h)}
                      onConfigChange={(c) => updateCase(index(), 'handlerConfig', c)}
                      type="transform"
                    />
                  </div>
                </div>
              </div>
            )}
          </For>

          <button class="add-case-btn" onClick={addCase}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Case
          </button>

          <div class="default-case">
            <label class="case-label">Default (no match):</label>
            <NestedHandlerEditor
              handler={props.config.default || ''}
              config={props.config.defaultConfig || {}}
              onHandlerChange={(h) => updateConfig('default', h)}
              onConfigChange={(c) => updateConfig('defaultConfig', c)}
              type="transform"
            />
          </div>
        </div>
      </Show>

      <style>{`
        .conditional-editor {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .branch-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .branch {
          border: 1px solid #30363d;
          border-radius: 8px;
          overflow: hidden;
        }

        .branch-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #161b22;
          cursor: pointer;
        }

        .branch-header:hover {
          background: #1c2128;
        }

        .branch-label {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 4px;
          background: #388bfd33;
          color: #58a6ff;
        }

        .branch-label.then {
          background: #23863633;
          color: #3fb950;
        }

        .branch-label.else {
          background: #f8514933;
          color: #f85149;
        }

        .branch-summary {
          flex: 1;
          color: #8b949e;
          font-size: 13px;
        }

        .expand-icon {
          color: #6e7681;
          transition: transform 0.2s ease;
        }

        .expand-icon.expanded {
          transform: rotate(180deg);
        }

        .branch-content {
          padding: 16px;
          background: #0d1117;
          border-top: 1px solid #30363d;
        }

        .branch-connector {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 0;
        }

        .connector-line {
          width: 2px;
          height: 20px;
          background: #30363d;
        }

        .connector-split {
          display: flex;
          gap: 40px;
          padding: 4px 0;
        }

        .split-label {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .true-label {
          background: #23863633;
          color: #3fb950;
        }

        .false-label {
          background: #f8514933;
          color: #f85149;
        }

        /* Cond styles */
        .cond-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .cond-case {
          border: 1px solid #30363d;
          border-radius: 8px;
          overflow: hidden;
        }

        .case-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: #161b22;
          border-bottom: 1px solid #30363d;
        }

        .case-number {
          font-size: 12px;
          font-weight: 600;
          color: #8b949e;
        }

        .remove-case-btn {
          background: none;
          border: none;
          color: #6e7681;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        }

        .remove-case-btn:hover {
          background: #f8514933;
          color: #f85149;
        }

        .case-content {
          padding: 12px;
          background: #0d1117;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .case-label {
          font-size: 11px;
          color: #6e7681;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
          display: block;
        }

        .add-case-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: #21262d;
          border: 1px dashed #30363d;
          border-radius: 8px;
          color: #8b949e;
          cursor: pointer;
          font-size: 13px;
        }

        .add-case-btn:hover {
          background: #30363d;
          border-style: solid;
          color: #c9d1d9;
        }

        .default-case {
          padding: 12px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
        }
      `}</style>
    </div>
  )
}
