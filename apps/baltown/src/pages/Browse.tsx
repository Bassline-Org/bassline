import { A, useSearchParams } from '@solidjs/router'
import { For, Show, createSignal, createMemo } from 'solid-js'
import { useResource } from '@bassline/solid'

export default function Browse() {
  const [searchParams] = useSearchParams()
  const [search, setSearch] = createSignal('')

  const { data: vals, loading, error, refetch } = useResource(() => 'bl:///r/vals')

  // Filter vals based on search and type
  const filteredVals = createMemo(() => {
    let entries = vals()?.entries || []

    // Filter by type if specified
    const typeFilter = searchParams.type
    if (typeFilter) {
      entries = entries.filter(v => v.valType === typeFilter)
    }

    // Filter by search term
    const searchTerm = search().toLowerCase()
    if (searchTerm) {
      entries = entries.filter(v =>
        v.name.toLowerCase().includes(searchTerm) ||
        v.description?.toLowerCase().includes(searchTerm) ||
        v.owner?.toLowerCase().includes(searchTerm)
      )
    }

    return entries
  })

  return (
    <div class="browse">
      <div class="page-header">
        <div>
          <h1 class="page-title">Browse Vals</h1>
          <p class="page-subtitle">
            <Show when={searchParams.type} fallback="All resource compositions">
              {searchParams.type} vals
            </Show>
          </p>
        </div>
        <A href="/compose" class="btn btn-primary">Create Val</A>
      </div>

      <div class="filters">
        <input
          type="text"
          class="form-input search-input"
          placeholder="Search vals..."
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
        />

        <div class="filter-tags">
          <A href="/browse" class={`filter-tag ${!searchParams.type ? 'active' : ''}`}>All</A>
          <A href="/browse?type=propagator" class={`filter-tag ${searchParams.type === 'propagator' ? 'active' : ''}`}>Propagators</A>
          <A href="/browse?type=recipe" class={`filter-tag ${searchParams.type === 'recipe' ? 'active' : ''}`}>Recipes</A>
          <A href="/browse?type=handler" class={`filter-tag ${searchParams.type === 'handler' ? 'active' : ''}`}>Handlers</A>
          <A href="/browse?type=cell" class={`filter-tag ${searchParams.type === 'cell' ? 'active' : ''}`}>Cells</A>
        </div>
      </div>

      <Show when={loading()}>
        <div class="empty-state">Loading...</div>
      </Show>

      <Show when={error()}>
        <div class="empty-state">
          <h3>Connection Error</h3>
          <p>Make sure the Bassline daemon is running</p>
          <button class="btn btn-secondary" onClick={refetch}>Retry</button>
        </div>
      </Show>

      <Show when={!loading() && !error()}>
        <Show when={filteredVals().length > 0} fallback={
          <div class="empty-state">
            <h3>No vals found</h3>
            <Show when={search() || searchParams.type} fallback={
              <p>Be the first to create one!</p>
            }>
              <p>Try adjusting your filters</p>
            </Show>
            <A href="/compose" class="btn btn-primary">Create Val</A>
          </div>
        }>
          <div class="grid grid-3">
            <For each={filteredVals()}>
              {(val) => (
                <A href={`/v/${val.owner}/${val.name}`} class="card val-card">
                  <div class="card-header">
                    <span class="card-title">{val.name}</span>
                    <span class={`tag ${val.valType}`}>{val.valType}</span>
                  </div>
                  <div class="card-body">
                    <p class="card-subtitle">{val.owner}</p>
                    <p>{val.description || 'No description'}</p>
                  </div>
                  <Show when={val.tags?.length > 0}>
                    <div class="card-tags">
                      <For each={val.tags}>
                        {(tag) => <span class="tag">{tag}</span>}
                      </For>
                    </div>
                  </Show>
                </A>
              )}
            </For>
          </div>
        </Show>
      </Show>

      <style>{`
        .filters {
          margin-bottom: 24px;
        }

        .search-input {
          max-width: 400px;
          margin-bottom: 16px;
        }

        .filter-tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .filter-tag {
          padding: 6px 14px;
          border-radius: 16px;
          font-size: 13px;
          text-decoration: none;
          background: #21262d;
          color: #8b949e;
          border: 1px solid transparent;
        }

        .filter-tag:hover {
          background: #30363d;
          color: #c9d1d9;
        }

        .filter-tag.active {
          background: #1f6feb33;
          color: #58a6ff;
          border-color: #1f6feb;
        }

        .val-card {
          text-decoration: none;
          transition: border-color 0.2s;
        }

        .val-card:hover {
          border-color: #58a6ff;
        }

        .card-tags {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #30363d;
        }
      `}</style>
    </div>
  )
}
