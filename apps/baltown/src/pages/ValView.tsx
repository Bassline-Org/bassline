import { useParams, A, useNavigate, useSearchParams } from '@solidjs/router'
import { Show, For, createSignal, Switch, Match } from 'solid-js'
import { useBassline, useResource } from '@bassline/solid'
import ForkTree from '../components/ForkTree'
import { ExportButton } from '../components/ImportExport'
import { ViewTabs, SourceView, GraphView, UsageView, InstancesView } from '../components/views'

export default function ValView() {
  const params = useParams()
  const navigate = useNavigate()
  const bl = useBassline()

  const valUri = () => `bl:///r/vals/${params.owner}/${params.name}`
  const { data: val, loading, error, refetch } = useResource(valUri)

  const [searchParams, setSearchParams] = useSearchParams()
  const [forking, setForking] = createSignal(false)
  const [instantiating, setInstantiating] = createSignal(false)
  const [instanceName, setInstanceName] = createSignal('')
  const [instanceParamValues, setInstanceParamValues] = createSignal<Record<string, string>>({})
  const [instantiateError, setInstantiateError] = createSignal('')

  // Helper to update a single parameter value
  function updateParamValue(key: string, value: string) {
    setInstanceParamValues(prev => ({ ...prev, [key]: value }))
  }

  // Build params object from individual values
  function getParamsObject(): Record<string, any> {
    const values = instanceParamValues()
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(values)) {
      if (value.trim()) {
        // Try to parse as JSON, fallback to string
        try {
          result[key] = JSON.parse(value)
        } catch {
          result[key] = value
        }
      }
    }
    return result
  }

  // Current view tab
  const currentView = () => searchParams.view || 'overview'
  const setCurrentView = (view: string) => setSearchParams({ view: view === 'overview' ? undefined : view })

  // Fork the val
  async function handleFork() {
    setForking(true)
    try {
      await bl.put(`${valUri()}/fork`, { peer: 'anonymous' }, {
        name: `${params.name}-fork`
      })
      navigate(`/v/anonymous/${params.name}-fork`)
    } catch (err) {
      console.error('Fork failed:', err)
    } finally {
      setForking(false)
    }
  }

  // Instantiate a recipe val
  async function handleInstantiate() {
    setInstantiating(true)
    setInstantiateError('')

    // Check required params
    const recipeParams = val()?.definition?.params || {}
    const values = getParamsObject()
    const missingRequired = Object.entries(recipeParams)
      .filter(([key, config]: [string, any]) => config.required && !values[key])
      .map(([key]) => key)

    if (missingRequired.length > 0) {
      setInstantiateError(`Missing required parameters: ${missingRequired.join(', ')}`)
      setInstantiating(false)
      return
    }

    try {
      const result = await bl.put(`${valUri()}/instantiate`, {}, {
        instanceName: instanceName() || `${params.name}-instance`,
        params: values
      })

      // Check for error response
      if (result?.headers?.type === 'bl:///types/error') {
        setInstantiateError(result.body?.error || 'Unknown error')
      } else {
        // Clear form and refresh
        setInstanceName('')
        setInstanceParamValues({})
        refetch()
      }
    } catch (err: any) {
      setInstantiateError(err.message || 'Failed to create instance')
    } finally {
      setInstantiating(false)
    }
  }

  return (
    <div class="val-view">
      <Show when={loading()}>
        <div class="empty-state">Loading...</div>
      </Show>

      <Show when={error()}>
        <div class="empty-state">
          <h3>Error loading val</h3>
          <p>{error()?.message}</p>
          <button class="btn btn-secondary" onClick={refetch}>Retry</button>
        </div>
      </Show>

      <Show when={!loading() && !error() && val()}>
        <div class="val-header">
          <div class="val-title-row">
            <div>
              <h1 class="val-title">
                <span class="val-owner">{val().owner}/</span>
                {val().name}
              </h1>
              <p class="val-description">{val().description || 'No description'}</p>
            </div>
            <div class="val-actions">
              <ExportButton val={val()} owner={params.owner} name={params.name} />
              <button
                class="btn btn-secondary"
                onClick={handleFork}
                disabled={forking()}
              >
                {forking() ? 'Forking...' : 'Fork'}
              </button>
              <A href={`/v/${params.owner}/${params.name}/edit`} class="btn btn-secondary">Edit</A>
            </div>
          </div>

          <div class="val-meta">
            <span class={`tag ${val().valType}`}>{val().valType}</span>
            <span class="meta-item">v{val().version}</span>
            <Show when={val().parentVal}>
              <span class="meta-item">
                Forked from <A href={val().parentVal.replace('bl:///vals/', '/v/')}>{val().parentVal.split('/').slice(-2).join('/')}</A>
              </span>
            </Show>
          </div>

          <Show when={val().tags?.length > 0}>
            <div class="val-tags">
              <For each={val().tags}>
                {(tag) => <span class="tag">{tag}</span>}
              </For>
            </div>
          </Show>
        </div>

        {/* View Tabs */}
        <ViewTabs
          valType={val().valType}
          currentView={currentView()}
          onViewChange={setCurrentView}
        />

        <div class="val-content">
          <div class="val-main">
            {/* Overview - default view */}
            <Show when={currentView() === 'overview'}>
              <div class="card">
                <div class="card-header">
                  <span class="card-title">Definition</span>
                </div>
                <pre class="json-preview">{JSON.stringify(val().definition, null, 2)}</pre>
              </div>

              {/* Instantiate UI for recipe vals */}
              <Show when={val().valType === 'recipe'}>
                <div class="card">
                  <div class="card-header">
                    <span class="card-title">Create Instance</span>
                  </div>
                  <div class="card-body">
                    <div class="form-group">
                      <label class="form-label">Instance Name</label>
                      <input
                        type="text"
                        class="form-input"
                        placeholder={`${params.name}-instance`}
                        value={instanceName()}
                        onInput={(e) => setInstanceName(e.currentTarget.value)}
                      />
                    </div>

                    <Show when={Object.keys(val().definition?.params || {}).length > 0}>
                      <div class="param-fields">
                        <For each={Object.entries(val().definition?.params || {})}>
                          {([key, config]: [string, any]) => (
                            <div class="form-group">
                              <label class="form-label">
                                {key}
                                <Show when={config.required}>
                                  <span class="required-marker">*</span>
                                </Show>
                              </label>
                              <input
                                type="text"
                                class="form-input"
                                placeholder={config.description || `Enter ${key}`}
                                value={instanceParamValues()[key] || ''}
                                onInput={(e) => updateParamValue(key, e.currentTarget.value)}
                              />
                              <Show when={config.description}>
                                <div class="param-description">{config.description}</div>
                              </Show>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>

                    <Show when={instantiateError()}>
                      <div class="error-message">{instantiateError()}</div>
                    </Show>

                    <button
                      type="button"
                      class="btn btn-primary"
                      onClick={(e) => {
                        e.preventDefault()
                        handleInstantiate()
                      }}
                      disabled={instantiating()}
                    >
                      {instantiating() ? 'Creating...' : 'Create Instance'}
                    </button>
                  </div>
                </div>
              </Show>
            </Show>

            {/* Source View */}
            <Show when={currentView() === 'source'}>
              <SourceView
                data={val().definition}
                editable={true}
                onSave={async (newDef) => {
                  try {
                    await bl.put(valUri(), {}, {
                      ...val(),
                      definition: newDef
                    })
                    refetch()
                  } catch (err) {
                    console.error('Failed to update definition:', err)
                  }
                }}
              />
            </Show>

            {/* Graph View - for propagators and recipes */}
            <Show when={currentView() === 'graph' && (val().valType === 'propagator' || val().valType === 'recipe')}>
              <GraphView
                data={val().definition}
                valType={val().valType}
              />
            </Show>

            {/* Usage View */}
            <Show when={currentView() === 'usage'}>
              <UsageView uri={`bl:///vals/${params.owner}/${params.name}`} />
            </Show>

            {/* Instances View - for recipes */}
            <Show when={currentView() === 'instances' && val().valType === 'recipe'}>
              <InstancesView
                valUri={`bl:///r/vals/${params.owner}/${params.name}`}
              />
            </Show>
          </div>

          <div class="val-sidebar">
            <div class="card">
              <div class="card-header">
                <span class="card-title">Info</span>
              </div>
              <div class="info-list">
                <div class="info-item">
                  <span class="info-label">Owner</span>
                  <span class="info-value">{val().owner}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Version</span>
                  <span class="info-value">{val().version}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Created</span>
                  <span class="info-value">{new Date(val().createdAt).toLocaleDateString()}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Updated</span>
                  <span class="info-value">{new Date(val().updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <span class="card-title">Links</span>
              </div>
              <div class="link-list">
                <A href={`/v/${params.owner}/${params.name}/versions`} class="link-item">
                  Version History (v{val().version})
                </A>
                <Show when={val().entries}>
                  <For each={val().entries.filter(e => e.name !== 'versions' && e.name !== 'forks')}>
                    {(entry) => (
                      <A href={entry.uri.replace(/bl:\/\/\/(?:r\/)?vals\//, '/v/')} class="link-item">
                        {entry.name}
                      </A>
                    )}
                  </For>
                </Show>
              </div>
            </div>

            {/* Fork Tree */}
            <ForkTree
              valUri={`bl:///vals/${params.owner}/${params.name}`}
              parentVal={val().parentVal}
              owner={params.owner}
              name={params.name}
            />
          </div>
        </div>
      </Show>

      <style>{`
        .val-header {
          margin-bottom: 24px;
        }

        .val-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .val-title {
          font-size: 28px;
          font-weight: 700;
          color: #f0f6fc;
        }

        .val-owner {
          color: #8b949e;
          font-weight: 400;
        }

        .val-description {
          font-size: 16px;
          color: #8b949e;
          margin-top: 8px;
        }

        .val-actions {
          display: flex;
          gap: 8px;
        }

        .val-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .meta-item {
          font-size: 13px;
          color: #8b949e;
        }

        .meta-item a {
          color: #58a6ff;
          text-decoration: none;
        }

        .val-tags {
          display: flex;
          gap: 8px;
        }

        .val-content {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 24px;
        }

        @media (max-width: 1024px) {
          .val-content {
            grid-template-columns: 1fr;
          }
        }

        .info-list {
          padding: 12px 16px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #30363d;
        }

        .info-item:last-child {
          border-bottom: none;
        }

        .info-label {
          font-size: 13px;
          color: #8b949e;
        }

        .info-value {
          font-size: 13px;
          color: #c9d1d9;
        }

        .link-list {
          padding: 8px;
        }

        .link-item {
          display: block;
          padding: 8px;
          border-radius: 6px;
          color: #58a6ff;
          text-decoration: none;
          font-size: 13px;
        }

        .link-item:hover {
          background: #21262d;
        }

        .param-fields {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }

        .required-marker {
          color: #f85149;
          margin-left: 4px;
        }

        .param-description {
          font-size: 12px;
          color: #8b949e;
          margin-top: 4px;
        }

        .error-message {
          background: #f8514922;
          border: 1px solid #f85149;
          border-radius: 6px;
          padding: 12px;
          color: #f85149;
          font-size: 13px;
          margin-bottom: 16px;
        }
      `}</style>
    </div>
  )
}
