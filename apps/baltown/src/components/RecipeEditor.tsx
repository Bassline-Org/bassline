import { createSignal, Show, For, createMemo } from 'solid-js'
import HandlerPicker from './HandlerPicker'

interface RecipeParam {
  required?: boolean
  description?: string
  default?: any
}

interface RecipeResource {
  id: string
  uri: string
  body: any
  init?: any
}

interface RecipeDefinition {
  params: Record<string, RecipeParam>
  resources: RecipeResource[]
}

interface RecipeEditorProps {
  value: RecipeDefinition
  onChange: (value: RecipeDefinition) => void
}

/**
 * Visual editor for recipe definitions
 *
 * Allows editing:
 * - Parameters with required/description/default
 * - Resources with id, uri template, body, init
 */
export default function RecipeEditor(props: RecipeEditorProps) {
  const [activeTab, setActiveTab] = createSignal<'params' | 'resources'>('params')

  // Get all parameter names for template hints
  const paramNames = createMemo(() => Object.keys(props.value.params || {}))

  // Get all resource IDs for ref hints
  const resourceIds = createMemo(() => (props.value.resources || []).map(r => r.id))

  // Update params
  function updateParams(params: Record<string, RecipeParam>) {
    props.onChange({ ...props.value, params })
  }

  // Update resources
  function updateResources(resources: RecipeResource[]) {
    props.onChange({ ...props.value, resources })
  }

  return (
    <div class="recipe-editor">
      <div class="editor-tabs">
        <button
          class={`tab ${activeTab() === 'params' ? 'active' : ''}`}
          onClick={() => setActiveTab('params')}
        >
          Parameters ({Object.keys(props.value.params || {}).length})
        </button>
        <button
          class={`tab ${activeTab() === 'resources' ? 'active' : ''}`}
          onClick={() => setActiveTab('resources')}
        >
          Resources ({(props.value.resources || []).length})
        </button>
      </div>

      <Show when={activeTab() === 'params'}>
        <ParamsEditor
          params={props.value.params || {}}
          onChange={updateParams}
        />
      </Show>

      <Show when={activeTab() === 'resources'}>
        <ResourcesEditor
          resources={props.value.resources || []}
          onChange={updateResources}
          paramNames={paramNames()}
          resourceIds={resourceIds()}
        />
      </Show>

      <div class="template-hints">
        <span class="hint-label">Template variables:</span>
        <For each={paramNames()}>
          {(name) => <code class="hint-var">${`{${name}}`}</code>}
        </For>
        <For each={resourceIds()}>
          {(id) => <code class="hint-ref">${`{ref.${id}}`}</code>}
        </For>
      </div>

      <style>{`
        .recipe-editor {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          overflow: hidden;
        }

        .editor-tabs {
          display: flex;
          border-bottom: 1px solid #30363d;
        }

        .tab {
          flex: 1;
          padding: 12px;
          background: #0d1117;
          border: none;
          color: #8b949e;
          font-size: 13px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
        }

        .tab:hover {
          background: #161b22;
          color: #c9d1d9;
        }

        .tab.active {
          background: #161b22;
          color: #58a6ff;
          border-bottom-color: #58a6ff;
        }

        .template-hints {
          padding: 12px 16px;
          background: #0d1117;
          border-top: 1px solid #30363d;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .hint-label {
          font-size: 11px;
          color: #8b949e;
        }

        .hint-var {
          font-size: 11px;
          padding: 2px 6px;
          background: #1f6feb33;
          color: #58a6ff;
          border-radius: 3px;
        }

        .hint-ref {
          font-size: 11px;
          padding: 2px 6px;
          background: #23863633;
          color: #3fb950;
          border-radius: 3px;
        }
      `}</style>
    </div>
  )
}

// Parameters Editor
interface ParamsEditorProps {
  params: Record<string, RecipeParam>
  onChange: (params: Record<string, RecipeParam>) => void
}

function ParamsEditor(props: ParamsEditorProps) {
  const [newParamName, setNewParamName] = createSignal('')

  function addParam() {
    const name = newParamName().trim()
    if (!name || name in props.params) return

    props.onChange({
      ...props.params,
      [name]: { required: true, description: '' }
    })
    setNewParamName('')
  }

  function updateParam(name: string, updates: Partial<RecipeParam>) {
    props.onChange({
      ...props.params,
      [name]: { ...props.params[name], ...updates }
    })
  }

  function removeParam(name: string) {
    const { [name]: _, ...rest } = props.params
    props.onChange(rest)
  }

  return (
    <div class="params-editor">
      <div class="add-param">
        <input
          type="text"
          class="param-input"
          placeholder="Parameter name"
          value={newParamName()}
          onInput={(e) => setNewParamName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && addParam()}
        />
        <button class="btn-add" onClick={addParam}>Add Parameter</button>
      </div>

      <Show when={Object.keys(props.params).length === 0}>
        <div class="empty-params">No parameters defined. Add parameters to make your recipe configurable.</div>
      </Show>

      <For each={Object.entries(props.params)}>
        {([name, param]) => (
          <div class="param-item">
            <div class="param-header">
              <code class="param-name">{name}</code>
              <label class="param-required">
                <input
                  type="checkbox"
                  checked={param.required}
                  onChange={(e) => updateParam(name, { required: e.currentTarget.checked })}
                />
                Required
              </label>
              <button class="btn-remove" onClick={() => removeParam(name)}>Remove</button>
            </div>
            <input
              type="text"
              class="param-desc"
              placeholder="Description"
              value={param.description || ''}
              onInput={(e) => updateParam(name, { description: e.currentTarget.value })}
            />
          </div>
        )}
      </For>

      <style>{`
        .params-editor {
          padding: 16px;
        }

        .add-param {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .param-input {
          flex: 1;
          padding: 8px 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 13px;
        }

        .btn-add {
          padding: 8px 16px;
          background: #238636;
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 13px;
          cursor: pointer;
        }

        .btn-add:hover {
          background: #2ea043;
        }

        .empty-params {
          padding: 24px;
          text-align: center;
          color: #8b949e;
          font-size: 13px;
        }

        .param-item {
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 8px;
        }

        .param-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .param-name {
          font-size: 14px;
          color: #79c0ff;
        }

        .param-required {
          font-size: 12px;
          color: #8b949e;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .btn-remove {
          margin-left: auto;
          padding: 4px 8px;
          background: transparent;
          border: 1px solid #30363d;
          border-radius: 4px;
          color: #8b949e;
          font-size: 11px;
          cursor: pointer;
        }

        .btn-remove:hover {
          background: #f8514933;
          border-color: #f85149;
          color: #f85149;
        }

        .param-desc {
          width: 100%;
          padding: 6px 10px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 4px;
          color: #c9d1d9;
          font-size: 12px;
        }
      `}</style>
    </div>
  )
}

// Resources Editor
interface ResourcesEditorProps {
  resources: RecipeResource[]
  onChange: (resources: RecipeResource[]) => void
  paramNames: string[]
  resourceIds: string[]
}

function ResourcesEditor(props: ResourcesEditorProps) {
  const [expandedIndex, setExpandedIndex] = createSignal<number | null>(null)

  function addResource() {
    const newId = `resource${props.resources.length + 1}`
    props.onChange([
      ...props.resources,
      { id: newId, uri: 'bl:///cells/', body: {} }
    ])
    setExpandedIndex(props.resources.length)
  }

  function updateResource(index: number, updates: Partial<RecipeResource>) {
    const updated = [...props.resources]
    updated[index] = { ...updated[index], ...updates }
    props.onChange(updated)
  }

  function removeResource(index: number) {
    props.onChange(props.resources.filter((_, i) => i !== index))
  }

  function moveResource(index: number, direction: -1 | 1) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= props.resources.length) return
    const updated = [...props.resources]
    ;[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
    props.onChange(updated)
    setExpandedIndex(newIndex)
  }

  return (
    <div class="resources-editor">
      <Show when={props.resources.length === 0}>
        <div class="empty-resources">No resources defined. Add resources to create when the recipe is instantiated.</div>
      </Show>

      <For each={props.resources}>
        {(resource, i) => (
          <div class={`resource-item ${expandedIndex() === i() ? 'expanded' : ''}`}>
            <div class="resource-header" onClick={() => setExpandedIndex(expandedIndex() === i() ? null : i())}>
              <span class="resource-icon">{getResourceIcon(resource.uri)}</span>
              <code class="resource-id">{resource.id}</code>
              <span class="resource-uri">{resource.uri}</span>
              <span class="expand-arrow">{expandedIndex() === i() ? '▼' : '▶'}</span>
            </div>

            <Show when={expandedIndex() === i()}>
              <div class="resource-body">
                <div class="resource-field">
                  <label>ID</label>
                  <input
                    type="text"
                    value={resource.id}
                    onInput={(e) => updateResource(i(), { id: e.currentTarget.value })}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <div class="resource-field">
                  <label>URI Template</label>
                  <input
                    type="text"
                    value={resource.uri}
                    onInput={(e) => updateResource(i(), { uri: e.currentTarget.value })}
                    placeholder="bl:///cells/${name}"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <div class="resource-field">
                  <label>Body (JSON)</label>
                  <textarea
                    value={JSON.stringify(resource.body, null, 2)}
                    onInput={(e) => {
                      try {
                        const body = JSON.parse(e.currentTarget.value)
                        updateResource(i(), { body })
                      } catch {}
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <Show when={resource.init !== undefined}>
                  <div class="resource-field">
                    <label>Initial Value (JSON)</label>
                    <input
                      type="text"
                      value={JSON.stringify(resource.init)}
                      onInput={(e) => {
                        try {
                          const init = JSON.parse(e.currentTarget.value)
                          updateResource(i(), { init })
                        } catch {}
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </Show>

                <div class="resource-actions">
                  <button class="btn-action" onClick={() => moveResource(i(), -1)} disabled={i() === 0}>↑</button>
                  <button class="btn-action" onClick={() => moveResource(i(), 1)} disabled={i() === props.resources.length - 1}>↓</button>
                  <button class="btn-action delete" onClick={() => removeResource(i())}>Delete</button>
                </div>
              </div>
            </Show>
          </div>
        )}
      </For>

      <button class="btn-add-resource" onClick={addResource}>+ Add Resource</button>

      <style>{`
        .resources-editor {
          padding: 16px;
        }

        .empty-resources {
          padding: 24px;
          text-align: center;
          color: #8b949e;
          font-size: 13px;
        }

        .resource-item {
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          margin-bottom: 8px;
          overflow: hidden;
        }

        .resource-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          cursor: pointer;
        }

        .resource-header:hover {
          background: #161b22;
        }

        .resource-icon {
          font-size: 14px;
        }

        .resource-id {
          font-size: 13px;
          color: #79c0ff;
          min-width: 80px;
        }

        .resource-uri {
          flex: 1;
          font-size: 12px;
          color: #8b949e;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .expand-arrow {
          font-size: 10px;
          color: #8b949e;
        }

        .resource-body {
          padding: 12px;
          border-top: 1px solid #30363d;
          background: #161b22;
        }

        .resource-field {
          margin-bottom: 12px;
        }

        .resource-field label {
          display: block;
          font-size: 11px;
          color: #8b949e;
          margin-bottom: 4px;
        }

        .resource-field input,
        .resource-field textarea {
          width: 100%;
          padding: 6px 10px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 4px;
          color: #c9d1d9;
          font-size: 12px;
          font-family: monospace;
        }

        .resource-field textarea {
          min-height: 80px;
          resize: vertical;
        }

        .resource-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #30363d;
        }

        .btn-action {
          padding: 4px 12px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 4px;
          color: #c9d1d9;
          font-size: 12px;
          cursor: pointer;
        }

        .btn-action:hover:not(:disabled) {
          background: #30363d;
        }

        .btn-action:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-action.delete {
          margin-left: auto;
          color: #f85149;
        }

        .btn-action.delete:hover {
          background: #f8514933;
        }

        .btn-add-resource {
          width: 100%;
          padding: 12px;
          background: #21262d;
          border: 1px dashed #30363d;
          border-radius: 6px;
          color: #8b949e;
          font-size: 13px;
          cursor: pointer;
        }

        .btn-add-resource:hover {
          background: #30363d;
          color: #c9d1d9;
        }
      `}</style>
    </div>
  )
}

// Helper to get icon based on URI
function getResourceIcon(uri: string): string {
  if (uri.includes('/cells/')) return '📦'
  if (uri.includes('/propagators/')) return '⚡'
  if (uri.includes('/data/')) return '📄'
  return '📁'
}

// Export empty recipe helper
export function createEmptyRecipe(): RecipeDefinition {
  return {
    params: {},
    resources: []
  }
}
