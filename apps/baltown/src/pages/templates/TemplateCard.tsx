import { Show } from 'solid-js'

interface TemplateCardProps {
  name: string
  description: string
  category: 'propagator' | 'recipe' | 'handler' | 'cell'
  preview?: any
  popularity?: number
  onUse: () => void
  onPreview?: () => void
}

const CATEGORY_COLORS = {
  propagator: { bg: '#f0883e22', color: '#f0883e' },
  recipe: { bg: '#3fb95022', color: '#3fb950' },
  handler: { bg: '#f778ba22', color: '#f778ba' },
  cell: { bg: '#388bfd22', color: '#58a6ff' }
}

const CATEGORY_ICONS = {
  propagator: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M4 12h4l3-9 6 18 3-9h4"/>
    </svg>
  ),
  recipe: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
    </svg>
  ),
  handler: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  ),
  cell: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="4" y="4" width="16" height="16" rx="2"/>
    </svg>
  )
}

/**
 * TemplateCard - Card displaying a template with preview and use action
 */
export default function TemplateCard(props: TemplateCardProps) {
  const colors = () => CATEGORY_COLORS[props.category]

  return (
    <div class="template-card">
      <div class="card-header">
        <div
          class="category-icon"
          style={{
            background: colors().bg,
            color: colors().color
          }}
        >
          {CATEGORY_ICONS[props.category]}
        </div>
        <div class="category-badge" style={{ background: colors().bg, color: colors().color }}>
          {props.category}
        </div>
      </div>

      <div class="card-content">
        <h3 class="template-name">{props.name}</h3>
        <p class="template-description">{props.description}</p>

        <Show when={props.preview}>
          <div class="template-preview">
            <pre>{JSON.stringify(props.preview, null, 2)}</pre>
          </div>
        </Show>
      </div>

      <div class="card-footer">
        <Show when={props.popularity !== undefined}>
          <span class="popularity">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            {props.popularity}
          </span>
        </Show>

        <div class="card-actions">
          <Show when={props.onPreview}>
            <button class="btn preview" onClick={props.onPreview}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Preview
            </button>
          </Show>
          <button class="btn use" onClick={props.onUse}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Use Template
          </button>
        </div>
      </div>

      <style>{`
        .template-card {
          display: flex;
          flex-direction: column;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.2s ease;
        }

        .template-card:hover {
          border-color: #484f58;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 20px;
          background: #21262d;
        }

        .category-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
        }

        .category-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .card-content {
          padding: 20px;
          flex: 1;
        }

        .template-name {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
          color: #c9d1d9;
        }

        .template-description {
          margin: 0;
          font-size: 13px;
          color: #8b949e;
          line-height: 1.5;
        }

        .template-preview {
          margin-top: 16px;
          padding: 12px;
          background: #0d1117;
          border-radius: 8px;
          max-height: 120px;
          overflow: auto;
        }

        .template-preview pre {
          margin: 0;
          font-size: 11px;
          color: #79c0ff;
          white-space: pre-wrap;
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: #0d1117;
          border-top: 1px solid #30363d;
        }

        .popularity {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #ffa657;
        }

        .card-actions {
          display: flex;
          gap: 8px;
        }

        .btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn.preview {
          background: #21262d;
          color: #8b949e;
        }

        .btn.preview:hover {
          background: #30363d;
          color: #c9d1d9;
        }

        .btn.use {
          background: #238636;
          color: white;
        }

        .btn.use:hover {
          background: #2ea043;
        }
      `}</style>
    </div>
  )
}
