import { Show, Switch, Match, createMemo } from 'solid-js'
import { getHandlerMetadata, type UIType } from '../../lib/handlerMetadata'
import NumericConfigEditor from './NumericConfigEditor'
import KeySelector from './KeySelector'
import TemplateEditor from './TemplateEditor'
import RegexEditor from './RegexEditor'
import NestedHandlerEditor from './NestedHandlerEditor'
import ConditionalEditor from './ConditionalEditor'
import CompositionEditor from './CompositionEditor'
import TypeSelector from './TypeSelector'

interface ConfigDispatcherProps {
  handler: string
  config: Record<string, any>
  onChange: (config: Record<string, any>) => void
  keySuggestions?: string[]
}

/**
 * ConfigDispatcher - Routes to appropriate config editor based on handler metadata
 *
 * This is the main entry point for handler configuration UI.
 */
export default function ConfigDispatcher(props: ConfigDispatcherProps) {
  const meta = createMemo(() => getHandlerMetadata(props.handler))

  // Helper to update config
  function updateConfig(key: string, value: any) {
    props.onChange({ ...props.config, [key]: value })
  }

  // Helper for comparison handlers that need both value and operator display
  function ComparisonEditor() {
    const operator = meta()?.uiOptions?.operator || '='

    return (
      <div class="comparison-editor">
        <div class="comparison-display">
          <span class="comparison-label">Value</span>
          <span class="comparison-operator">{operator}</span>
        </div>
        <input
          type="text"
          class="comparison-input"
          value={props.config.value ?? ''}
          placeholder="Enter value to compare..."
          onInput={(e) => {
            let val: any = e.currentTarget.value
            // Try to parse as number or boolean
            if (val === 'true') val = true
            else if (val === 'false') val = false
            else if (!isNaN(Number(val)) && val !== '') val = Number(val)
            updateConfig('value', val)
          }}
        />
        <style>{`
          .comparison-editor {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .comparison-display {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .comparison-label {
            font-size: 12px;
            color: #8b949e;
          }
          .comparison-operator {
            padding: 4px 10px;
            background: #388bfd33;
            color: #58a6ff;
            border-radius: 4px;
            font-weight: 600;
            font-family: monospace;
          }
          .comparison-input {
            padding: 10px 12px;
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 6px;
            color: #c9d1d9;
            font-size: 14px;
            outline: none;
          }
          .comparison-input:focus {
            border-color: #58a6ff;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div class="config-dispatcher">
      <Show when={!meta()}>
        {/* Unknown handler - fall back to JSON textarea */}
        <div class="fallback-editor">
          <label class="fallback-label">Config (JSON)</label>
          <textarea
            class="fallback-input"
            value={JSON.stringify(props.config, null, 2)}
            onInput={(e) => {
              try {
                const parsed = JSON.parse(e.currentTarget.value)
                props.onChange(parsed)
              } catch {}
            }}
            rows={4}
          />
        </div>
      </Show>

      <Show when={meta()}>
        <Switch
          fallback={
            <div class="no-config">
              <span class="no-config-icon">✓</span>
              <span class="no-config-text">No configuration needed</span>
            </div>
          }
        >
          <Match when={meta()!.uiType === 'numeric'}>
            <NumericConfigEditor
              value={props.config.value ?? 0}
              onChange={(v) => updateConfig('value', v)}
              label={meta()!.uiOptions?.label}
              min={meta()!.uiOptions?.min}
              max={meta()!.uiOptions?.max}
              step={meta()!.uiOptions?.step}
            />
          </Match>

          <Match when={meta()!.uiType === 'comparison'}>
            <ComparisonEditor />
          </Match>

          <Match when={meta()!.uiType === 'keySelector'}>
            <KeySelector
              value={props.config.key ?? props.config.path ?? ''}
              onChange={(v) => updateConfig(meta()!.uiOptions?.mode === 'path' ? 'path' : 'key', v)}
              mode={meta()!.uiOptions?.mode || 'single'}
              placeholder={meta()!.uiOptions?.placeholder}
              suggestions={props.keySuggestions}
            />
          </Match>

          <Match when={meta()!.uiType === 'multiKeySelector'}>
            <KeySelector
              value={props.config.keys ?? []}
              onChange={(v) => updateConfig('keys', v)}
              mode="multi"
              placeholder={meta()!.uiOptions?.placeholder}
              suggestions={props.keySuggestions}
            />
          </Match>

          <Match when={meta()!.uiType === 'template'}>
            <TemplateEditor
              value={props.config.template ?? props.config.delimiter ?? ''}
              onChange={(v) => {
                const key = meta()!.config?.template ? 'template' : 'delimiter'
                updateConfig(key, v)
              }}
              label={meta()!.uiOptions?.label}
              placeholder={meta()!.uiOptions?.placeholder}
              presets={meta()!.uiOptions?.presets}
            />
          </Match>

          <Match when={meta()!.uiType === 'regex'}>
            <RegexEditor
              pattern={props.config.pattern ?? ''}
              flags={props.config.flags ?? 'g'}
              replacement={props.config.replacement}
              onPatternChange={(p) => updateConfig('pattern', p)}
              onFlagsChange={(f) => updateConfig('flags', f)}
              onReplacementChange={(r) => updateConfig('replacement', r)}
              showReplacement={!meta()!.uiOptions?.noReplacement}
            />
          </Match>

          <Match when={meta()!.uiType === 'nested'}>
            <NestedHandlerEditor
              handler={props.config.handler ?? ''}
              config={props.config.config ?? {}}
              onHandlerChange={(h) => updateConfig('handler', h)}
              onConfigChange={(c) => updateConfig('config', c)}
              type={meta()!.uiOptions?.type}
              label={meta()!.description}
            />
          </Match>

          <Match when={meta()!.uiType === 'conditional'}>
            <ConditionalEditor
              type={meta()!.uiOptions?.type}
              config={props.config}
              onChange={props.onChange}
            />
          </Match>

          <Match when={meta()!.uiType === 'typeSelector'}>
            <TypeSelector
              value={props.config.to ?? 'string'}
              onChange={(v) => updateConfig('to', v)}
              types={meta()!.uiOptions?.types}
              label="Convert to type"
            />
          </Match>
        </Switch>
      </Show>

      <style>{`
        .config-dispatcher {
          padding: 16px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
        }

        .fallback-editor {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .fallback-label {
          font-size: 12px;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .fallback-input {
          padding: 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #79c0ff;
          font-family: monospace;
          font-size: 13px;
          resize: vertical;
          outline: none;
        }

        .fallback-input:focus {
          border-color: #58a6ff;
        }

        .no-config {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px;
          background: #0d1117;
          border-radius: 8px;
        }

        .no-config-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #23863633;
          color: #3fb950;
          border-radius: 50%;
          font-size: 16px;
        }

        .no-config-text {
          color: #8b949e;
          font-size: 14px;
        }
      `}</style>
    </div>
  )
}
