import { createSignal, Show, createMemo } from 'solid-js'

interface PropagatorNodeProps {
  id: string
  uri: string
  name: string
  handler: string | any[]
  inputCount: number
  x: number
  y: number
  selected?: boolean
  highlighted?: boolean
  firing?: boolean
  onSelect?: () => void
  onDragStart?: (e: MouseEvent) => void
}

/**
 * PropagatorNode - Draggable propagator node for flow graph
 *
 * Diamond/pill shape representing a reactive computation.
 */
export default function PropagatorNode(props: PropagatorNodeProps) {
  const [hovered, setHovered] = createSignal(false)

  // Get handler name
  const handlerName = createMemo(() => {
    const h = props.handler
    if (typeof h === 'string') return h
    if (Array.isArray(h)) return h[0]
    return 'custom'
  })

  // Handler has config
  const hasConfig = createMemo(() => {
    const h = props.handler
    return Array.isArray(h) && h.length > 1
  })

  // Diamond path
  const diamondPath = createMemo(() => {
    const w = 100
    const h = 40
    return `M ${-w/2} 0 L 0 ${-h/2} L ${w/2} 0 L 0 ${h/2} Z`
  })

  return (
    <g
      class={`propagator-node ${props.selected ? 'selected' : ''} ${props.highlighted ? 'highlighted' : ''} ${props.firing ? 'firing' : ''}`}
      transform={`translate(${props.x}, ${props.y})`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => props.onSelect?.()}
      onMouseDown={(e) => props.onDragStart?.(e)}
      style={{ cursor: 'grab' }}
    >
      {/* Shadow */}
      <path
        d={diamondPath()}
        fill="rgba(0,0,0,0.3)"
        filter="blur(4px)"
        transform="translate(2, 2)"
      />

      {/* Firing animation ring */}
      <Show when={props.firing}>
        <path
          d={diamondPath()}
          fill="none"
          stroke="#58a6ff"
          stroke-width="3"
          opacity="0.5"
          transform="scale(1.15)"
        >
          <animate
            attributeName="opacity"
            values="0.5;0;0.5"
            dur="1s"
            repeatCount="indefinite"
          />
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1.05;1.2;1.05"
            dur="1s"
            repeatCount="indefinite"
          />
        </path>
      </Show>

      {/* Background */}
      <path
        d={diamondPath()}
        fill="#21262d"
        stroke={props.selected ? '#58a6ff' : props.firing ? '#58a6ff' : '#30363d'}
        stroke-width={props.selected || props.firing ? 2 : 1}
        stroke-dasharray={props.firing ? 'none' : '4 2'}
      />

      {/* Icon */}
      <g transform="translate(-12, -8)">
        <path
          d="M2 6h4l3-4 6 12 3-4h4"
          stroke="#f0883e"
          stroke-width="1.5"
          fill="none"
          transform="scale(0.8)"
        />
      </g>

      {/* Handler name */}
      <text
        x="0"
        y="4"
        font-size="11"
        font-weight="600"
        fill="#c9d1d9"
        text-anchor="middle"
      >
        {handlerName().length > 12 ? handlerName().slice(0, 12) + '...' : handlerName()}
      </text>

      {/* Config indicator */}
      <Show when={hasConfig()}>
        <circle
          cx="35"
          cy="-10"
          r="6"
          fill="#f0883e"
          opacity="0.8"
        />
        <text
          x="35"
          y="-7"
          font-size="8"
          fill="#0d1117"
          text-anchor="middle"
        >
          ⚙
        </text>
      </Show>

      {/* Input port(s) */}
      <circle cx="-50" cy="0" r="6" fill="#0d1117" stroke="#30363d" stroke-width="1" />
      <Show when={props.inputCount > 1}>
        <text
          x="-50"
          y="3"
          font-size="8"
          fill="#8b949e"
          text-anchor="middle"
        >
          {props.inputCount}
        </text>
      </Show>

      {/* Output port */}
      <circle cx="50" cy="0" r="6" fill="#0d1117" stroke="#30363d" stroke-width="1" />

      {/* Hover tooltip */}
      <Show when={hovered()}>
        <g transform="translate(0, 30)">
          <rect
            x="-60"
            y="0"
            width="120"
            height="20"
            rx="4"
            fill="#21262d"
            stroke="#30363d"
          />
          <text
            x="0"
            y="14"
            font-size="9"
            fill="#8b949e"
            text-anchor="middle"
          >
            {props.name}
          </text>
        </g>
      </Show>
    </g>
  )
}
