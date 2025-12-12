import { Show } from 'solid-js'
import type { StackedAction } from '../../actions/types'

interface StackCardProps {
  item: StackedAction
  isTop: boolean
  onClick?: () => void
  onHover?: (hovering: boolean) => void
}

/**
 * StackCard - Visual representation of an action on the stack
 *
 * Shows action name, status, and summary.
 * Clickable for meta-action targeting.
 */
export default function StackCard(props: StackCardProps) {
  const statusColors: Record<string, string> = {
    building: '#f0883e',
    pending: '#58a6ff',
    resolving: '#a371f7',
    resolved: '#3fb950',
    cancelled: '#f85149',
  }

  const statusLabels: Record<string, string> = {
    building: 'Building...',
    pending: 'Pending',
    resolving: 'Resolving...',
    resolved: 'Done',
    cancelled: 'Cancelled',
  }

  return (
    <div
      class={`stack-card ${props.item.status} ${props.isTop ? 'is-top' : ''}`}
      onClick={() => props.onClick?.()}
      onMouseEnter={() => props.onHover?.(true)}
      onMouseLeave={() => props.onHover?.(false)}
    >
      <div class="stack-card-header">
        <div class="stack-card-icon">{props.item.action.icon()}</div>
        <div class="stack-card-title">{props.item.action.name}</div>
        <div class="stack-card-status" style={{ background: statusColors[props.item.status] }}>
          {statusLabels[props.item.status]}
        </div>
      </div>

      <Show when={props.item.summary}>
        <div class="stack-card-summary">{props.item.summary}</div>
      </Show>

      <Show when={props.item.targets.resources.length > 0}>
        <div class="stack-card-targets">
          <span class="targets-label">Targets:</span>
          {props.item.targets.resources.map((r) => r.name).join(', ')}
        </div>
      </Show>

      <Show when={props.item.targets.stackItems.length > 0}>
        <div class="stack-card-meta-targets">
          <span class="targets-label">Stack targets:</span>
          {props.item.targets.stackItems.length} action(s)
        </div>
      </Show>

      <Show when={props.isTop}>
        <div class="top-indicator">Next to resolve</div>
      </Show>

      <style>{`
        .stack-card {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .stack-card:hover {
          border-color: #58a6ff;
          background: #1c2128;
        }

        .stack-card.is-top {
          border-color: #58a6ff;
          box-shadow: 0 0 12px rgba(88, 166, 255, 0.2);
        }

        .stack-card.resolving {
          border-color: #a371f7;
          animation: pulse 1s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .stack-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stack-card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          color: #8b949e;
        }

        .stack-card-icon svg {
          width: 16px;
          height: 16px;
        }

        .stack-card-title {
          flex: 1;
          font-size: 13px;
          font-weight: 500;
          color: #c9d1d9;
        }

        .stack-card-status {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          color: #0d1117;
          text-transform: uppercase;
        }

        .stack-card-summary {
          margin-top: 8px;
          font-size: 12px;
          color: #8b949e;
          padding-left: 32px;
        }

        .stack-card-targets,
        .stack-card-meta-targets {
          margin-top: 6px;
          font-size: 11px;
          color: #6e7681;
          padding-left: 32px;
        }

        .targets-label {
          color: #8b949e;
          margin-right: 4px;
        }

        .stack-card-meta-targets {
          color: #a371f7;
        }

        .top-indicator {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #30363d;
          font-size: 10px;
          color: #58a6ff;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `}</style>
    </div>
  )
}
