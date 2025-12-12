import { createSignal, Show } from 'solid-js'

interface ResourceNodeProps {
  id: string
  uri: string
  position: { x: number; y: number }
  onDrop?: (id: string, data: any) => void
  onClick?: (id: string) => void
  selected?: boolean
}

/**
 * ResourceNode - A URI endpoint on the canvas
 *
 * Represents a Bassline resource. Click to GET, drop data to PUT.
 */
function ResourceNode(props: ResourceNodeProps) {
  const [isHovering, setIsHovering] = createSignal(false)
  const [isDropTarget, setIsDropTarget] = createSignal(false)

  // Extract the short name from URI
  const shortName = () => {
    const uri = props.uri
    if (uri === 'spawn') return 'SPAWN'
    // bl:///cells/counter -> cells/counter
    const match = uri.match(/bl:\/\/\/(.*)/)
    return match ? match[1] : uri
  }

  // Get icon based on resource type
  const icon = () => {
    const uri = props.uri
    if (uri === 'spawn') {
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      )
    }
    if (uri.includes('/cells/')) {
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      )
    }
    if (uri.includes('/propagators/')) {
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" />
        </svg>
      )
    }
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="10" />
      </svg>
    )
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    setIsDropTarget(true)
  }

  function handleDragLeave() {
    setIsDropTarget(false)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setIsDropTarget(false)

    // Get dropped data
    const data = e.dataTransfer?.getData('application/json')
    if (data) {
      try {
        const parsed = JSON.parse(data)
        props.onDrop?.(props.id, parsed)
      } catch (err) {
        console.error('Failed to parse dropped data:', err)
      }
    }
  }

  return (
    <div
      class="resource-node"
      classList={{
        'resource-node--selected': props.selected,
        'resource-node--hovering': isHovering(),
        'resource-node--drop-target': isDropTarget(),
        'resource-node--spawn': props.uri === 'spawn',
      }}
      style={{
        transform: `translate(${props.position.x}px, ${props.position.y}px)`,
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={() => props.onClick?.(props.id)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div class="resource-node__icon">{icon()}</div>
      <div class="resource-node__label">{shortName()}</div>

      <Show when={isDropTarget()}>
        <div class="resource-node__drop-hint">PUT</div>
      </Show>

      <style>{`
        .resource-node {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 12px 16px;
          background: #21262d;
          border: 2px solid #30363d;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .resource-node:hover {
          border-color: #58a6ff;
          background: #161b22;
        }

        .resource-node--selected {
          border-color: #f0883e;
          box-shadow: 0 0 0 2px rgba(240, 136, 62, 0.3);
        }

        .resource-node--drop-target {
          border-color: #3fb950;
          background: rgba(63, 185, 80, 0.1);
          transform: scale(1.05);
        }

        .resource-node--spawn {
          border-color: #a371f7;
          background: rgba(163, 113, 247, 0.1);
        }

        .resource-node--spawn:hover {
          border-color: #a371f7;
          box-shadow: 0 0 0 2px rgba(163, 113, 247, 0.3);
        }

        .resource-node__icon {
          color: #8b949e;
        }

        .resource-node:hover .resource-node__icon {
          color: #58a6ff;
        }

        .resource-node--spawn .resource-node__icon {
          color: #a371f7;
        }

        .resource-node__label {
          font-size: 12px;
          font-weight: 500;
          color: #c9d1d9;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .resource-node__drop-hint {
          position: absolute;
          top: -8px;
          right: -8px;
          padding: 2px 6px;
          background: #3fb950;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          color: #fff;
        }
      `}</style>
    </div>
  )
}

export default ResourceNode
