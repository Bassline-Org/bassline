import { A } from '@solidjs/router'
import { For, Show, createSignal, onMount } from 'solid-js'
import { useBassline, useResource } from '@bassline/solid'

export default function Home() {
  const bl = useBassline()
  const { data: vals, loading, error, refetch } = useResource(() => 'bl:///r/vals')

  return (
    <div class="home">
      <div class="hero">
        <h1>Welcome to baltown</h1>
        <p>Create, share, and remix resource compositions</p>
        <div class="hero-actions">
          <A href="/compose" class="btn btn-primary">Create New Val</A>
          <A href="/browse" class="btn btn-secondary">Browse Vals</A>
        </div>
      </div>

      <section class="section">
        <div class="page-header">
          <div>
            <h2 class="page-title">Val Types</h2>
            <p class="page-subtitle">Different ways to compose resources</p>
          </div>
        </div>

        <div class="grid grid-4">
          <A href="/compose/propagator" class="type-card">
            <div class="type-icon propagator">P</div>
            <h3>Propagator</h3>
            <p>Reactive computations that transform inputs to outputs using handlers</p>
          </A>

          <A href="/compose/recipe" class="type-card">
            <div class="type-icon recipe">R</div>
            <h3>Recipe</h3>
            <p>Templates that create multiple resources with parameters</p>
          </A>

          <A href="/compose/handler" class="type-card">
            <div class="type-icon handler">H</div>
            <h3>Handler</h3>
            <p>Reusable handler compositions from 110+ built-in primitives</p>
          </A>

          <A href="/compose/cell" class="type-card">
            <div class="type-icon cell">C</div>
            <h3>Cell</h3>
            <p>Shared data containers with lattice merge semantics</p>
          </A>
        </div>
      </section>

      <section class="section">
        <div class="page-header">
          <div>
            <h2 class="page-title">Recent Vals</h2>
            <p class="page-subtitle">Latest compositions from the community</p>
          </div>
          <A href="/browse" class="btn btn-secondary">View All</A>
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
          <Show when={vals()?.entries?.length > 0} fallback={
            <div class="empty-state">
              <h3>No vals yet</h3>
              <p>Be the first to create one!</p>
              <A href="/compose" class="btn btn-primary">Create Val</A>
            </div>
          }>
            <div class="grid grid-3">
              <For each={vals()?.entries?.slice(0, 6)}>
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
      </section>

      <style>{`
        .hero {
          text-align: center;
          padding: 48px 24px;
          background: linear-gradient(180deg, #161b22 0%, #0d1117 100%);
          border-radius: 12px;
          margin-bottom: 32px;
        }

        .hero h1 {
          font-size: 36px;
          font-weight: 700;
          color: #f0f6fc;
          margin-bottom: 12px;
        }

        .hero p {
          font-size: 18px;
          color: #8b949e;
          margin-bottom: 24px;
        }

        .hero-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .section {
          margin-bottom: 48px;
        }

        .type-card {
          display: block;
          padding: 24px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          text-decoration: none;
          transition: border-color 0.2s, transform 0.2s;
        }

        .type-card:hover {
          border-color: #58a6ff;
          transform: translateY(-2px);
        }

        .type-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 16px;
        }

        .type-icon.propagator { background: #1f6feb33; color: #58a6ff; }
        .type-icon.recipe { background: #23863633; color: #3fb950; }
        .type-icon.handler { background: #a371f733; color: #a371f7; }
        .type-icon.cell { background: #f7816633; color: #f78166; }

        .type-card h3 {
          font-size: 16px;
          font-weight: 600;
          color: #f0f6fc;
          margin-bottom: 8px;
        }

        .type-card p {
          font-size: 13px;
          color: #8b949e;
          line-height: 1.5;
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
