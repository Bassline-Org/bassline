import { createSignal, createMemo, For, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import TemplateCard from './TemplateCard'

interface Template {
  id: string
  name: string
  description: string
  category: 'propagator' | 'recipe' | 'handler' | 'cell'
  preview: any
  popularity: number
  tags: string[]
}

// Built-in templates - exported for use by Compose page
export const TEMPLATES: Template[] = [
  // Propagator templates
  {
    id: 'math-reducer',
    name: 'Math Reducer',
    description: 'Sum, average, or multiply values from multiple input cells.',
    category: 'propagator',
    preview: {
      inputs: ['bl:///cells/a', 'bl:///cells/b'],
      output: 'bl:///cells/result',
      handler: 'sum',
    },
    popularity: 156,
    tags: ['math', 'reduce', 'popular'],
  },
  {
    id: 'data-filter',
    name: 'Data Filter',
    description: 'Filter array values based on a predicate condition.',
    category: 'propagator',
    preview: {
      inputs: ['bl:///cells/items'],
      output: 'bl:///cells/filtered',
      handler: 'filter',
      handlerConfig: { handler: 'gt', config: { value: 0 } },
    },
    popularity: 89,
    tags: ['filter', 'array', 'predicate'],
  },
  {
    id: 'format-transform',
    name: 'Format Transform',
    description: 'Transform data using template strings with placeholders.',
    category: 'propagator',
    preview: {
      inputs: ['bl:///cells/name', 'bl:///cells/count'],
      output: 'bl:///cells/message',
      handler: 'format',
      handlerConfig: { template: 'Hello {0}, you have {1} items' },
    },
    popularity: 67,
    tags: ['string', 'format', 'template'],
  },
  {
    id: 'conditional-logic',
    name: 'Conditional Logic',
    description: 'Apply different handlers based on conditions (if-then-else).',
    category: 'propagator',
    preview: {
      inputs: ['bl:///cells/value'],
      output: 'bl:///cells/result',
      handler: 'ifElse',
      handlerConfig: {
        predicate: 'gt',
        predicateConfig: { value: 10 },
        then: 'identity',
        else: ['multiply', { value: 2 }],
      },
    },
    popularity: 45,
    tags: ['conditional', 'logic', 'branch'],
  },
  {
    id: 'data-pipeline',
    name: 'Data Pipeline',
    description: 'Chain multiple transformations: pipe handlers in sequence.',
    category: 'propagator',
    preview: {
      inputs: ['bl:///cells/raw'],
      output: 'bl:///cells/processed',
      handler: ['pipe', 'trim', 'lowercase', ['split', { delimiter: ',' }]],
    },
    popularity: 112,
    tags: ['pipe', 'chain', 'transform'],
  },

  // Recipe templates
  {
    id: 'monitoring-dashboard',
    name: 'Monitoring Dashboard',
    description: 'Template for monitoring status with automatic refresh.',
    category: 'recipe',
    preview: {
      params: { name: { required: true }, interval: { default: 5000 } },
      resources: [
        { id: 'status', type: 'cell', lattice: 'lww' },
        { id: 'lastUpdate', type: 'cell', lattice: 'lww' },
        { id: 'errorCount', type: 'cell', lattice: 'counter' },
      ],
    },
    popularity: 78,
    tags: ['monitoring', 'dashboard', 'status'],
  },
  {
    id: 'state-machine',
    name: 'State Machine',
    description: 'Simple state machine with transitions and guards.',
    category: 'recipe',
    preview: {
      params: { name: { required: true }, initialState: { default: 'idle' } },
      resources: [
        { id: 'state', type: 'cell', lattice: 'lww' },
        { id: 'history', type: 'cell', lattice: 'setUnion' },
      ],
    },
    popularity: 56,
    tags: ['state', 'machine', 'transitions'],
  },
  {
    id: 'config-registry',
    name: 'Configuration Registry',
    description: 'Centralized configuration with validation and defaults.',
    category: 'recipe',
    preview: {
      params: { name: { required: true } },
      resources: [
        { id: 'config', type: 'cell', lattice: 'object' },
        { id: 'validated', type: 'propagator' },
      ],
    },
    popularity: 34,
    tags: ['config', 'registry', 'settings'],
  },

  // Handler templates
  {
    id: 'celsius-fahrenheit',
    name: 'Celsius to Fahrenheit',
    description: 'Convert temperature from Celsius to Fahrenheit.',
    category: 'handler',
    preview: ['pipe', ['multiply', { value: 9 }], ['divide', { value: 5 }], ['add', { value: 32 }]],
    popularity: 23,
    tags: ['convert', 'temperature', 'math'],
  },
  {
    id: 'slug-generator',
    name: 'Slug Generator',
    description: 'Convert text to URL-friendly slug format.',
    category: 'handler',
    preview: [
      'pipe',
      'lowercase',
      'trim',
      ['replace', { pattern: '\\s+', replacement: '-', flags: 'g' }],
    ],
    popularity: 41,
    tags: ['string', 'url', 'format'],
  },

  // Cell templates
  {
    id: 'click-counter',
    name: 'Click Counter',
    description: 'Counter cell that only increments (monotonic).',
    category: 'cell',
    preview: { lattice: 'counter', initial: 0 },
    popularity: 98,
    tags: ['counter', 'clicks', 'metrics'],
  },
  {
    id: 'status-toggle',
    name: 'Status Toggle',
    description: 'Boolean flag that once set to true, stays true.',
    category: 'cell',
    preview: { lattice: 'boolean', initial: false },
    popularity: 67,
    tags: ['boolean', 'toggle', 'flag'],
  },
  {
    id: 'tag-collection',
    name: 'Tag Collection',
    description: 'Accumulating set of unique tags.',
    category: 'cell',
    preview: { lattice: 'setUnion', initial: [] },
    popularity: 54,
    tags: ['tags', 'set', 'collection'],
  },
  {
    id: 'config-object',
    name: 'Config Object',
    description: 'Mergeable configuration object.',
    category: 'cell',
    preview: { lattice: 'object', initial: {} },
    popularity: 43,
    tags: ['config', 'object', 'settings'],
  },
  {
    id: 'high-score',
    name: 'High Score',
    description: 'Tracks maximum value (only goes up).',
    category: 'cell',
    preview: { lattice: 'maxNumber', initial: 0 },
    popularity: 38,
    tags: ['max', 'score', 'metrics'],
  },
]

/**
 * TemplateGallery - Browse and select templates
 */
export default function TemplateGallery() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = createSignal('')
  const [selectedCategory, setSelectedCategory] = createSignal<string | null>(null)
  const [sortBy, setSortBy] = createSignal<'popularity' | 'name'>('popularity')

  // Filter and sort templates
  const filteredTemplates = createMemo(() => {
    let result = [...TEMPLATES]

    // Filter by search
    const query = searchQuery().toLowerCase()
    if (query) {
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.tags.some((tag) => tag.includes(query))
      )
    }

    // Filter by category
    const category = selectedCategory()
    if (category) {
      result = result.filter((t) => t.category === category)
    }

    // Sort
    if (sortBy() === 'popularity') {
      result.sort((a, b) => b.popularity - a.popularity)
    } else {
      result.sort((a, b) => a.name.localeCompare(b.name))
    }

    return result
  })

  // Category counts
  const categoryCounts = createMemo(() => ({
    propagator: TEMPLATES.filter((t) => t.category === 'propagator').length,
    recipe: TEMPLATES.filter((t) => t.category === 'recipe').length,
    handler: TEMPLATES.filter((t) => t.category === 'handler').length,
    cell: TEMPLATES.filter((t) => t.category === 'cell').length,
  }))

  function useTemplate(template: Template) {
    // Navigate to compose page with template pre-filled
    navigate(`/compose?template=${template.id}&type=${template.category}`)
  }

  return (
    <div class="template-gallery">
      <div class="gallery-header">
        <div class="header-content">
          <h1>Template Gallery</h1>
          <p>Start quickly with pre-built templates for common patterns</p>
        </div>
      </div>

      <div class="gallery-controls">
        <div class="search-box">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </div>

        <div class="filter-tabs">
          <button
            class={`filter-tab ${selectedCategory() === null ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            All ({TEMPLATES.length})
          </button>
          <button
            class={`filter-tab ${selectedCategory() === 'propagator' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('propagator')}
          >
            Propagators ({categoryCounts().propagator})
          </button>
          <button
            class={`filter-tab ${selectedCategory() === 'recipe' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('recipe')}
          >
            Recipes ({categoryCounts().recipe})
          </button>
          <button
            class={`filter-tab ${selectedCategory() === 'handler' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('handler')}
          >
            Handlers ({categoryCounts().handler})
          </button>
          <button
            class={`filter-tab ${selectedCategory() === 'cell' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('cell')}
          >
            Cells ({categoryCounts().cell})
          </button>
        </div>

        <div class="sort-control">
          <label>Sort by:</label>
          <select value={sortBy()} onChange={(e) => setSortBy(e.currentTarget.value as any)}>
            <option value="popularity">Popularity</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      <Show when={filteredTemplates().length === 0}>
        <div class="empty-state">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <h3>No templates found</h3>
          <p>Try a different search term or category</p>
        </div>
      </Show>

      <div class="template-grid">
        <For each={filteredTemplates()}>
          {(template) => (
            <TemplateCard
              name={template.name}
              description={template.description}
              category={template.category}
              preview={template.preview}
              popularity={template.popularity}
              onUse={() => useTemplate(template)}
            />
          )}
        </For>
      </div>

      <style>{`
        .template-gallery {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .gallery-header {
          margin-bottom: 32px;
        }

        .header-content h1 {
          margin: 0 0 8px 0;
          font-size: 28px;
          font-weight: 700;
          color: #c9d1d9;
        }

        .header-content p {
          margin: 0;
          font-size: 14px;
          color: #8b949e;
        }

        .gallery-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: center;
          margin-bottom: 24px;
          padding: 16px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 12px;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 8px;
          flex: 1;
          min-width: 200px;
          max-width: 400px;
        }

        .search-box svg {
          color: #6e7681;
        }

        .search-box input {
          flex: 1;
          background: transparent;
          border: none;
          color: #c9d1d9;
          font-size: 14px;
          outline: none;
        }

        .search-box input::placeholder {
          color: #6e7681;
        }

        .filter-tabs {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .filter-tab {
          padding: 8px 14px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #8b949e;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-tab:hover {
          background: #30363d;
          color: #c9d1d9;
        }

        .filter-tab.active {
          background: #388bfd22;
          border-color: #58a6ff;
          color: #58a6ff;
        }

        .sort-control {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }

        .sort-control label {
          font-size: 12px;
          color: #8b949e;
        }

        .sort-control select {
          padding: 8px 12px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 12px;
          outline: none;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 60px;
          color: #6e7681;
          text-align: center;
        }

        .empty-state h3 {
          margin: 0;
          font-size: 16px;
          color: #8b949e;
        }

        .empty-state p {
          margin: 0;
          font-size: 13px;
        }

        .template-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }

        @media (max-width: 600px) {
          .template-gallery {
            padding: 16px;
          }

          .gallery-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .search-box {
            max-width: none;
          }

          .sort-control {
            margin-left: 0;
          }
        }
      `}</style>
    </div>
  )
}
