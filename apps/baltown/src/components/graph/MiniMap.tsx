import { For, createMemo } from 'solid-js'

interface MiniMapProps {
  nodes: Array<{
    id: string
    type: 'cell' | 'propagator'
    x: number
    y: number
  }>
  viewBox: { x: number; y: number; width: number; height: number }
  viewport: { x: number; y: number; width: number; height: number }
  onViewportChange?: (x: number, y: number) => void
  width?: number
  height?: number
}

/**
 * MiniMap - Navigation overview of the graph
 */
export default function MiniMap(props: MiniMapProps) {
  const width = () => props.width ?? 150
  const height = () => props.height ?? 100

  // Calculate scale to fit all nodes
  const scale = createMemo(() => {
    const vb = props.viewBox
    const scaleX = width() / vb.width
    const scaleY = height() / vb.height
    return Math.min(scaleX, scaleY) * 0.9
  })

  // Calculate offset to center
  const offset = createMemo(() => {
    const vb = props.viewBox
    const s = scale()
    return {
      x: (width() - vb.width * s) / 2 - vb.x * s,
      y: (height() - vb.height * s) / 2 - vb.y * s
    }
  })

  // Transform node position to minimap
  function toMinimap(x: number, y: number) {
    const s = scale()
    const o = offset()
    return {
      x: x * s + o.x,
      y: y * s + o.y
    }
  }

  // Viewport rectangle in minimap coordinates
  const viewportRect = createMemo(() => {
    const vp = props.viewport
    const s = scale()
    const o = offset()
    return {
      x: vp.x * s + o.x,
      y: vp.y * s + o.y,
      width: vp.width * s,
      height: vp.height * s
    }
  })

  // Handle click to pan
  function handleClick(e: MouseEvent) {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
    const s = scale()
    const o = offset()

    const x = (e.clientX - rect.left - o.x) / s - props.viewport.width / 2
    const y = (e.clientY - rect.top - o.y) / s - props.viewport.height / 2

    props.onViewportChange?.(x, y)
  }

  return (
    <div class="minimap">
      <svg
        width={width()}
        height={height()}
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      >
        {/* Background */}
        <rect
          x="0"
          y="0"
          width={width()}
          height={height()}
          fill="#0d1117"
          rx="4"
        />

        {/* Nodes */}
        <For each={props.nodes}>
          {(node) => {
            const pos = toMinimap(node.x, node.y)
            return (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={node.type === 'cell' ? 4 : 3}
                fill={node.type === 'cell' ? '#58a6ff' : '#f0883e'}
              />
            )
          }}
        </For>

        {/* Viewport indicator */}
        <rect
          x={viewportRect().x}
          y={viewportRect().y}
          width={Math.max(10, viewportRect().width)}
          height={Math.max(10, viewportRect().height)}
          fill="none"
          stroke="#58a6ff"
          stroke-width="1"
          rx="2"
          opacity="0.8"
        />
      </svg>

      <style>{`
        .minimap {
          position: absolute;
          bottom: 12px;
          right: 12px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 4px;
          z-index: 100;
        }
      `}</style>
    </div>
  )
}
