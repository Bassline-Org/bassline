import { createMemo, Show } from 'solid-js'

interface ConnectionEdgeProps {
  from: { x: number; y: number }
  to: { x: number; y: number }
  type?: 'input' | 'output'
  animated?: boolean
  highlighted?: boolean
  firing?: boolean
}

/**
 * ConnectionEdge - Animated edge connecting nodes
 *
 * Shows data flow direction with optional animation.
 */
export default function ConnectionEdge(props: ConnectionEdgeProps) {
  // Calculate bezier control points for smooth curves
  const pathData = createMemo(() => {
    const { from, to } = props
    const dx = to.x - from.x
    const dy = to.y - from.y

    // Offset from node centers to ports
    const startX = from.x + 60  // Right port of cell
    const startY = from.y
    const endX = to.x - 50  // Left port of propagator
    const endY = to.y

    // Control points for bezier curve
    const midX = (startX + endX) / 2
    const cp1x = midX
    const cp1y = startY
    const cp2x = midX
    const cp2y = endY

    return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`
  })

  // Arrow marker
  const arrowPath = createMemo(() => {
    const { to } = props
    const x = to.x - 50  // At the end port
    const y = to.y
    return `M ${x - 8} ${y - 4} L ${x} ${y} L ${x - 8} ${y + 4}`
  })

  // Edge color based on type and state
  const color = createMemo(() => {
    if (props.firing) return '#58a6ff'
    if (props.highlighted) return '#58a6ff'
    if (props.type === 'output') return '#3fb950'
    return '#30363d'
  })

  return (
    <g class={`connection-edge ${props.highlighted ? 'highlighted' : ''} ${props.firing ? 'firing' : ''}`}>
      {/* Base edge */}
      <path
        d={pathData()}
        fill="none"
        stroke={color()}
        stroke-width={props.highlighted || props.firing ? 2 : 1}
        stroke-linecap="round"
        opacity={props.highlighted || props.firing ? 1 : 0.6}
      />

      {/* Animated flow indicator */}
      <Show when={props.animated || props.firing}>
        <path
          d={pathData()}
          fill="none"
          stroke={props.firing ? '#58a6ff' : color()}
          stroke-width="4"
          stroke-linecap="round"
          stroke-dasharray="8 12"
          opacity="0.6"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="20;0"
            dur={props.firing ? '0.5s' : '1s'}
            repeatCount="indefinite"
          />
        </path>
      </Show>

      {/* Data packet animation when firing */}
      <Show when={props.firing}>
        <circle r="4" fill="#58a6ff">
          <animateMotion
            path={pathData()}
            dur="0.5s"
            repeatCount="indefinite"
          />
        </circle>
      </Show>

      {/* Arrow head */}
      <path
        d={arrowPath()}
        fill="none"
        stroke={color()}
        stroke-width={props.highlighted || props.firing ? 2 : 1}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </g>
  )
}

// Utility function to create edge between two nodes
export function createEdgePath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  fromPort: 'left' | 'right' = 'right',
  toPort: 'left' | 'right' = 'left'
): string {
  // Port offsets
  const startX = fromPort === 'right' ? fromX + 60 : fromX - 60
  const startY = fromY
  const endX = toPort === 'left' ? toX - 50 : toX + 50
  const endY = toY

  // Control points for smooth bezier
  const dx = endX - startX
  const cp1x = startX + dx * 0.5
  const cp1y = startY
  const cp2x = startX + dx * 0.5
  const cp2y = endY

  return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`
}
