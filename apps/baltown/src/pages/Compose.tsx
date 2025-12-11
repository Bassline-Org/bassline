import { useParams, useNavigate, useSearchParams } from '@solidjs/router'
import { createSignal, createMemo, Show, For, onMount } from 'solid-js'
import { useBassline, useResource } from '@bassline/solid'
import HandlerPicker from '../components/HandlerPicker'
import HiccupComposer, { createEmptyComposition } from '../components/HiccupComposer'
import RecipeEditor, { createEmptyRecipe } from '../components/RecipeEditor'
import { ConfigDispatcher } from '../components/handlers'
import { handlerRequiresConfig } from '../lib/handlerMetadata'
import { TEMPLATES } from './templates/TemplateGallery'

export default function Compose() {
  const params = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const bl = useBassline()

  // Form state
  const [name, setName] = createSignal('')
  const [owner, setOwner] = createSignal('anonymous')
  const [description, setDescription] = createSignal('')
  const [valType, setValType] = createSignal(params.type || 'propagator')
  const [tags, setTags] = createSignal('')
  const [saving, setSaving] = createSignal(false)
  const [error, setError] = createSignal('')

  // Definition state (varies by valType)
  const [inputs, setInputs] = createSignal([''])
  const [output, setOutput] = createSignal('')
  const [handler, setHandler] = createSignal('')
  const [handlerConfig, setHandlerConfig] = createSignal<Record<string, any>>({})

  // Handler composition (for handler vals)
  const [handlerComposition, setHandlerComposition] = createSignal<any>(createEmptyComposition())

  // Cell-specific
  const [lattice, setLattice] = createSignal('lww')
  const [initialValue, setInitialValue] = createSignal('')

  // Recipe-specific (visual editor)
  const [recipeDefinition, setRecipeDefinition] = createSignal<any>(createEmptyRecipe())

  // Load handlers list
  const { data: handlers } = useResource(() => 'bl:///r/handlers')

  // Load template if specified in query params
  onMount(() => {
    const templateId = searchParams.template
    const templateType = searchParams.type

    if (templateId) {
      const template = TEMPLATES.find(t => t.id === templateId)
      if (template) {
        // Set basic info from template
        setName(template.id)
        setDescription(template.description)
        setValType(template.category)
        setTags(template.tags.join(', '))

        // Load definition based on category
        const preview = template.preview

        if (template.category === 'propagator' && preview) {
          if (preview.inputs) setInputs(preview.inputs)
          if (preview.output) setOutput(preview.output)
          if (preview.handler) {
            // Handler can be string or array (hiccup)
            if (typeof preview.handler === 'string') {
              setHandler(preview.handler)
            } else if (Array.isArray(preview.handler)) {
              // For hiccup-style handlers like ['pipe', 'trim', 'lowercase']
              setHandler(preview.handler[0])
            }
          }
          if (preview.handlerConfig) setHandlerConfig(preview.handlerConfig)
        }

        if (template.category === 'handler' && preview) {
          setHandlerComposition(preview)
        }

        if (template.category === 'cell' && preview) {
          if (preview.lattice) setLattice(preview.lattice)
          if (preview.initial !== undefined) setInitialValue(JSON.stringify(preview.initial))
        }

        if (template.category === 'recipe' && preview) {
          setRecipeDefinition(preview)
        }
      }
    } else if (templateType) {
      // Just set the type if specified without template
      setValType(templateType)
    }
  })

  // Build definition based on valType
  const definition = createMemo(() => {
    const type = valType()

    if (type === 'propagator') {
      const config = handlerConfig()
      const def: any = {
        inputs: inputs().filter(i => i.trim()),
        output: output(),
        handler: handler()
      }
      // Only include handlerConfig if it has values
      if (Object.keys(config).length > 0) {
        def.handlerConfig = config
      }
      return def
    }

    if (type === 'handler') {
      // Use the visual hiccup composition
      return handlerComposition()
    }

    if (type === 'cell') {
      let initial = initialValue()
      try { initial = JSON.parse(initial) } catch {}

      return {
        lattice: lattice(),
        initial
      }
    }

    if (type === 'recipe') {
      // Use the visual recipe editor
      return recipeDefinition()
    }

    return {}
  })

  // Preview JSON
  const preview = createMemo(() => {
    return JSON.stringify({
      name: name(),
      owner: owner(),
      description: description(),
      valType: valType(),
      definition: definition(),
      tags: tags().split(',').map(t => t.trim()).filter(Boolean)
    }, null, 2)
  })

  // Save val
  async function handleSave() {
    if (!name()) {
      setError('Name is required')
      return
    }

    setSaving(true)
    setError('')

    try {
      await bl.put(`bl:///r/vals/${owner()}/${name()}`, {}, {
        description: description(),
        valType: valType(),
        definition: definition(),
        tags: tags().split(',').map(t => t.trim()).filter(Boolean)
      })

      navigate(`/v/${owner()}/${name()}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Add input field
  function addInput() {
    setInputs([...inputs(), ''])
  }

  // Update input at index
  function updateInput(index: number, value: string) {
    const current = [...inputs()]
    current[index] = value
    setInputs(current)
  }

  // Remove input at index
  function removeInput(index: number) {
    setInputs(inputs().filter((_, i) => i !== index))
  }

  return (
    <div class="compose">
      <div class="page-header">
        <div>
          <h1 class="page-title">Create Val</h1>
          <p class="page-subtitle">Define a new resource composition</p>
        </div>
      </div>

      <div class="compose-layout">
        <div class="compose-form">
          {/* Basic Info */}
          <div class="form-section">
            <h3>Basic Info</h3>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Owner</label>
                <input
                  type="text"
                  class="form-input"
                  value={owner()}
                  onInput={(e) => setOwner(e.currentTarget.value)}
                />
              </div>

              <div class="form-group">
                <label class="form-label">Name</label>
                <input
                  type="text"
                  class="form-input"
                  placeholder="my-val"
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Description</label>
              <input
                type="text"
                class="form-input"
                placeholder="What does this val do?"
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
              />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Type</label>
                <select
                  class="form-select"
                  value={valType()}
                  onChange={(e) => setValType(e.currentTarget.value)}
                >
                  <option value="propagator">Propagator</option>
                  <option value="recipe">Recipe</option>
                  <option value="handler">Handler</option>
                  <option value="cell">Cell</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Tags</label>
                <input
                  type="text"
                  class="form-input"
                  placeholder="utility, math"
                  value={tags()}
                  onInput={(e) => setTags(e.currentTarget.value)}
                />
              </div>
            </div>
          </div>

          {/* Propagator Definition */}
          <Show when={valType() === 'propagator'}>
            <div class="form-section">
              <h3>Propagator Definition</h3>

              <div class="form-group">
                <label class="form-label">Inputs</label>
                <For each={inputs()}>
                  {(input, i) => (
                    <div class="input-row">
                      <input
                        type="text"
                        class="form-input"
                        placeholder="bl:///r/cells/my-cell"
                        value={input}
                        onInput={(e) => updateInput(i(), e.currentTarget.value)}
                      />
                      <button class="btn btn-secondary" onClick={() => removeInput(i())}>-</button>
                    </div>
                  )}
                </For>
                <button class="btn btn-secondary" onClick={addInput}>+ Add Input</button>
              </div>

              <div class="form-group">
                <label class="form-label">Output</label>
                <input
                  type="text"
                  class="form-input"
                  placeholder="bl:///r/cells/result"
                  value={output()}
                  onInput={(e) => setOutput(e.currentTarget.value)}
                />
              </div>

              <div class="form-group">
                <label class="form-label">Handler</label>
                <HandlerPicker
                  value={handler()}
                  onChange={setHandler}
                />
              </div>

              <Show when={handler() && handlerRequiresConfig(handler())}>
                <div class="form-group">
                  <label class="form-label">Handler Configuration</label>
                  <ConfigDispatcher
                    handler={handler()}
                    config={handlerConfig()}
                    onChange={setHandlerConfig}
                  />
                </div>
              </Show>

              <Show when={handler() && !handlerRequiresConfig(handler())}>
                <div class="form-group">
                  <div class="no-config-hint">
                    This handler doesn't require configuration
                  </div>
                </div>
              </Show>
            </div>
          </Show>

          {/* Handler Definition */}
          <Show when={valType() === 'handler'}>
            <div class="form-section">
              <h3>Handler Composition</h3>
              <p class="form-hint">Build a handler composition visually. Click handler names to change them, use + Add to compose.</p>

              <div class="form-group">
                <HiccupComposer
                  value={handlerComposition()}
                  onChange={setHandlerComposition}
                />
              </div>
            </div>
          </Show>

          {/* Cell Definition */}
          <Show when={valType() === 'cell'}>
            <div class="form-section">
              <h3>Cell Definition</h3>

              <div class="form-group">
                <label class="form-label">Lattice</label>
                <select
                  class="form-select"
                  value={lattice()}
                  onChange={(e) => setLattice(e.currentTarget.value)}
                >
                  <option value="lww">Last-Writer-Wins (lww)</option>
                  <option value="maxNumber">Max Number</option>
                  <option value="minNumber">Min Number</option>
                  <option value="counter">Counter</option>
                  <option value="setUnion">Set Union</option>
                  <option value="setIntersection">Set Intersection</option>
                  <option value="boolean">Boolean</option>
                  <option value="object">Object Merge</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Initial Value (JSON)</label>
                <textarea
                  class="form-textarea"
                  placeholder='null'
                  value={initialValue()}
                  onInput={(e) => setInitialValue(e.currentTarget.value)}
                />
              </div>
            </div>
          </Show>

          {/* Recipe Definition */}
          <Show when={valType() === 'recipe'}>
            <div class="form-section">
              <h3>Recipe Definition</h3>
              <p class="form-hint">Define parameters and resources that will be created when the recipe is instantiated.</p>

              <RecipeEditor
                value={recipeDefinition()}
                onChange={setRecipeDefinition}
              />
            </div>
          </Show>

          <Show when={error()}>
            <div class="error-message">{error()}</div>
          </Show>

          <div class="form-actions">
            <button
              class="btn btn-primary"
              onClick={handleSave}
              disabled={saving()}
            >
              {saving() ? 'Saving...' : 'Save Val'}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div class="compose-preview">
          <h3>Preview</h3>
          <pre class="json-preview">{preview()}</pre>
        </div>
      </div>

      <style>{`
        .compose-layout {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 24px;
        }

        @media (max-width: 1024px) {
          .compose-layout {
            grid-template-columns: 1fr;
          }
        }

        .form-section {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .form-section h3 {
          font-size: 16px;
          font-weight: 600;
          color: #f0f6fc;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #30363d;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-hint {
          font-size: 13px;
          color: #8b949e;
          margin-bottom: 16px;
        }

        .input-row {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }

        .input-row .form-input {
          flex: 1;
        }

        .handler-hints {
          font-size: 12px;
          color: #8b949e;
          margin-top: 4px;
        }

        .compose-preview {
          position: sticky;
          top: 24px;
        }

        .compose-preview h3 {
          font-size: 14px;
          font-weight: 600;
          color: #8b949e;
          margin-bottom: 12px;
        }

        .error-message {
          background: #f8514933;
          border: 1px solid #f85149;
          border-radius: 6px;
          padding: 12px;
          color: #f85149;
          margin-bottom: 16px;
        }

        .form-actions {
          display: flex;
          gap: 12px;
        }

        .no-config-hint {
          font-size: 13px;
          color: #8b949e;
          padding: 12px;
          background: #21262d;
          border-radius: 6px;
          text-align: center;
        }
      `}</style>
    </div>
  )
}
