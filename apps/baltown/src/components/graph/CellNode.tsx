import { createSignal, Show, createMemo } from 'solid-js'

interface CellNodeProps {
  id: string
  uri: string
  name: string
  lattice?: string
  value?: any
  x: number
  y: number
  selected?: boolean
  highlighted?: boolean
  onSelect?: () => void
  onDragStart?: (e: MouseEvent) => void
}

const LATTICE_COLORS: Record<string, string> = {
  counter: '#3fb950',
  maxNumber: '#58a6ff',
  minNumber: '#a371f7',
  setUnion: '#f0883e',
  lww: '#8b949e',
  boolean: '#f778ba',
  object: '#ffa657',
  default: '#6e7681'
}

/**
 * CellNode - Draggable cell node for flow graph
 */
export default function CellNode(props: CellNodeProps) {
  const [hovered, setHovered] = createSignal(false)

  const color = createMemo(() => LATTICE_COLORS[props.lattice || ''] || LATTICE_COLORS.default)

  // Format value for display
  const displayValue = createMemo(() => {
    const v = props.value
    if (v === undefined || v === null) return '—'
    if (typeof v === 'object') {
      if ('value' in v) return formatValue(v.value)
      return '{...}'
    }
    return formatValue(v)
  })

  function formatValue(v: any): string {
    if (typeof v === 'number') {
      return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
    }
    if (typeof v === 'string') {
      return v.length > 10 ? v.slice(0, 10) + '...' : v
    }
    if (typeof v === 'boolean') {
      return v ? 'true' : 'false'
    }
    if (Array.isArray(v)) {
      return `[${v.length}]`
    }
    return String(v).slice(0, 10)
  }

  return (
    <g
      class={`cell-node ${props.selected ? 'selected' : ''} ${props.highlighted ? 'highlighted' : ''}`}
      transform={`translate(${props.x}, ${props.y})`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => props.onSelect?.()}
      onMouseDown={(e) => props.onDragStart?.(e)}
      style={{ cursor: 'grab' }}
    >
      {/* Shadow */}
      <rect
        x="-60"
        y="-25"
        width="120"
        height="50"
        rx="8"
        fill="rgba(0,0,0,0.3)"
        filter="blur(4px)"
        transform="translate(2, 2)"
      />

      {/* Background */}
      <rect
        x="-60"
        y="-25"
        width="120"
        height="50"
        rx="8"
        fill="#161b22"
        stroke={props.selected ? '#58a6ff' : props.highlighted ? color() : '#30363d'}
        stroke-width={props.selected || props.highlighted ? 2 : 1}
      />

      {/* Lattice indicator bar */}
      <rect
        x="-60"
        y="-25"
        width="4"
        height="50"
        rx="2"
        fill={color()}
      />

      {/* Icon */}
      <g transform="translate(-45, -8)">
        <rect width="16" height="16" rx="3" fill={color()} opacity="0.2" />
        <path
          d="M3 3h10v10H3z"
          stroke={color()}
          stroke-width="1.5"
          fill="none"
          transform="translate(3, 3) scale(0.7)"
        />
      </g>

      {/* Name */}
      <text
        x="-24"
        y="-6"
        font-size="12"
        font-weight="600"
        fill="#c9d1d9"
      >
        {props.name.length > 10 ? props.name.slice(0, 10) + '...' : props.name}
      </text>

      {/* Value */}
      <text
        x="-24"
        y="10"
        font-size="11"
        font-family="monospace"
        fill={color()}
      >
        {displayValue()}
      </text>

      {/* Lattice badge */}
      <Show when={props.lattice}>
        <g transform="translate(20, -15)">
          <rect
            x="0"
            y="0"
            width={props.lattice!.length * 5 + 10}
            height="14"
            rx="7"
            fill={color()}
            opacity="0.2"
          />
          <text
            x="5"
            y="10"
            font-size="8"
            fill={color()}
          >
            {props.lattice}
          </text>
        </g>
      </Show>

      {/* Connection ports */}
      <circle cx="-60" cy="0" r="6" fill="#0d1117" stroke="#30363d" stroke-width="1" />
      <circle cx="60" cy="0" r="6" fill="#0d1117" stroke="#30363d" stroke-width="1" />

      {/* Hover tooltip */}
      <Show when={hovered()}>
        <g transform="translate(0, 35)">
          <rect
            x="-70"
            y="0"
            width="140"
            height="24"
            rx="4"
            fill="#21262d"
            stroke="#30363d"
          />
          <text
            x="0"
            y="16"
            font-size="9"
            fill="#8b949e"
            text-anchor="middle"
            font-family="monospace"
          >
            {props.uri.length > 25 ? '...' + props.uri.slice(-25) : props.uri}
          </text>
        </g>
      </Show>
    </g>
  )
}
