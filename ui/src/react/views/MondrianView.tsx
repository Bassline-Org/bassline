import { useMemo, useState, useRef, useEffect, type ReactNode } from 'react'
import type { PhlowMondrianView, MondrianLayoutType } from '../../core/views'
import { inspect, canInspect } from '../../core/inspect'
import { usePanZoom } from './mondrian/usePanZoom'
import { computeLayout } from './mondrian/computeLayout'
import { resolveEdges } from './mondrian/resolveEdges'
import type { PositionedNode, PositionedEdge, LayoutResult } from './mondrian/types'
import styles from '~/css/views/MondrianView.module.css'

export interface MondrianViewProps {
  item: PhlowMondrianView<any>
  onInspect?: (target: unknown, label?: string) => void
}

const DEPTH_COLORS = [
  'var(--inspector-primary, #3b82f6)',
  '#8b5cf6',
  '#ef4444',
  '#eab308',
  '#10b981',
  '#6b7280',
]

const TREEMAP_DEPTH_COLORS = [
  'var(--inspector-card-bg, #ffffff)',
  '#3b82f6',
  '#ef4444',
  '#eab308',
  '#f3f4f6',
  '#6b7280',
]

const NODE_RX = 4
const MIN_LABEL_WIDTH = 30
const MIN_LABEL_HEIGHT = 14

const LAYOUT_LABELS: Record<MondrianLayoutType, string> = {
  tree: 'Tree',
  treemap: 'Treemap',
  radialTree: 'Radial',
  force: 'Force',
  circle: 'Circle',
  grid: 'Grid',
  pack: 'Pack',
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function truncateLabel(label: string, availableWidth: number): string {
  const maxChars = Math.floor(availableWidth / 7)
  if (label.length > maxChars) {
    return label.slice(0, Math.max(0, maxChars - 1)) + '\u2026'
  }
  return label
}

function getDepthColor(depth: number, palette: Record<string, string>, colorKey?: string, treemapColors = false): string {
  if (colorKey && palette[colorKey]) return palette[colorKey]
  const colors = treemapColors ? TREEMAP_DEPTH_COLORS : DEPTH_COLORS
  return colors[Math.min(depth, colors.length - 1)]
}

// ---------------------------------------------------------------------------
// Pan/Zoom SVG wrapper
// ---------------------------------------------------------------------------

function PanZoomSvg({
  width,
  height,
  containerRef,
  children,
}: {
  width: number
  height: number
  containerRef: React.RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  const { svgRef, viewBox, handlers, zoomIn, zoomOut, zoomToFit } = usePanZoom(width, height)

  return (
    <div ref={containerRef} className={styles.panZoomContainer}>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        {...handlers}
      >
        {children}
      </svg>
      <div className={styles.zoomControls}>
        <button className={styles.zoomButton} onClick={zoomIn} title="Zoom In">+</button>
        <button className={styles.zoomButton} onClick={zoomOut} title="Zoom Out">&minus;</button>
        <button className={styles.zoomButton} onClick={zoomToFit} title="Zoom to Fit">Fit</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MondrianView({ item, onInspect }: MondrianViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedLayout, setSelectedLayout] = useState<MondrianLayoutType>(item.type)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        setContainerSize({ width, height })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const rootNode = useMemo(() => item.root(), [item])
  const nodeConfig = item.nodes
  const edgeConfig = item.edges
  const userPalette = item.palette
  const isTreemap = selectedLayout === 'treemap'
  const isPack = selectedLayout === 'pack'

  const layoutResult = useMemo<LayoutResult | null>(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return null
    return computeLayout(selectedLayout, rootNode, {
      containerWidth: containerSize.width,
      containerHeight: containerSize.height,
      nodeWidth: nodeConfig.width,
      nodeHeight: nodeConfig.height,
      layout: item.layout,
      padding: item.padding,
    })
  }, [rootNode, containerSize.width, containerSize.height, selectedLayout, nodeConfig.width, nodeConfig.height, item.layout, item.padding])

  const allEdges = useMemo<PositionedEdge[]>(() => {
    if (!layoutResult) return []
    const base = layoutResult.edges
    if (!edgeConfig.connect?.length) return base
    const explicit = resolveEdges(edgeConfig.connect, layoutResult.nodes)
    return [...base, ...explicit]
  }, [layoutResult, edgeConfig.connect])

  const { nodes, width: svgWidth, height: svgHeight } = layoutResult ?? { nodes: [], width: 0, height: 0 }
  const hoveredNode = hoveredId ? nodes.find(n => n.id === hoveredId) : null
  const edgeStroke = edgeConfig.stroke || 'var(--inspector-border, #e5e7eb)'

  const renderEdge = (edge: PositionedEdge, i: number) => {
    const src = nodes.find(n => n.id === edge.sourceId)
    const tgt = nodes.find(n => n.id === edge.targetId)
    if (!src || !tgt) return null

    let d: string
    if (edgeConfig.shape === 'line') {
      d = `M ${src.x} ${src.y} L ${tgt.x} ${tgt.y}`
    } else if (edgeConfig.shape === 'step') {
      const midY = (src.y + tgt.y) / 2
      d = `M ${src.x} ${src.y} V ${midY} H ${tgt.x} V ${tgt.y}`
    } else {
      const midY = (src.y + tgt.y) / 2
      d = `M ${src.x} ${src.y} C ${src.x} ${midY}, ${tgt.x} ${midY}, ${tgt.x} ${tgt.y}`
    }

    return (
      <path
        key={`edge-${i}`}
        className={styles.edge}
        d={d}
        fill="none"
        stroke={edge.explicit ? (edgeConfig.stroke || '#94a3b8') : edgeStroke}
        strokeWidth={edgeConfig.strokeWidth}
        strokeDasharray={edge.explicit ? '6 3' : undefined}
      />
    )
  }

  const renderInnerLayout = (inner: LayoutResult, parentX: number, parentY: number, parentW: number, parentH: number) => {
    const offsetX = parentX - parentW / 2 + (parentW - inner.width) / 2
    const offsetY = parentY - parentH / 2 + (parentH - inner.height) / 2
    return (
      <g transform={`translate(${offsetX}, ${offsetY})`}>
        {inner.edges.map((e, i) => {
          const s = inner.nodes.find(n => n.id === e.sourceId)
          const t = inner.nodes.find(n => n.id === e.targetId)
          if (!s || !t) return null
          const midY = (s.y + t.y) / 2
          return (
            <path key={`inner-edge-${i}`} className={styles.edge} fill="none"
              stroke="var(--inspector-border, #e5e7eb)" strokeWidth={1}
              d={`M ${s.x} ${s.y} C ${s.x} ${midY}, ${t.x} ${midY}, ${t.x} ${t.y}`} />
          )
        })}
        {inner.nodes.map(n => {
          const c = getDepthColor(n.depth, userPalette, n.data.color)
          return (
            <g key={`inner-${n.id}`} className={styles.node}>
              <rect x={n.x - n.width / 2} y={n.y - n.height / 2} width={n.width} height={n.height}
                fill="var(--inspector-card-bg, #fff)" stroke={c} strokeWidth={1} rx={NODE_RX} />
              <text x={n.x} y={n.y} className={styles.label} textAnchor="middle" dominantBaseline="central">
                {truncateLabel(n.data.label, n.width)}
              </text>
            </g>
          )
        })}
      </g>
    )
  }

  const renderNode = (node: PositionedNode) => {
    const { id, data, x, y, width: nw, height: nh, depth } = node
    const isHovered = hoveredId === id
    const isClickable = !!(data.target && onInspect && canInspect(data.target))

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isClickable && data.target) {
        const viewable = inspect(data.target)
        if (viewable) onInspect!(viewable, data.label)
      }
    }

    const groupProps = {
      key: id,
      className: `${styles.node} ${isClickable ? styles.clickable : ''}`,
      onMouseEnter: () => setHoveredId(id),
      onMouseLeave: () => setHoveredId(null),
      onClick: handleClick,
    }

    if (node.innerLayout) {
      const color = getDepthColor(depth, userPalette, data.color)
      return (
        <g {...groupProps}>
          <rect x={x - nw / 2} y={y - nh / 2} width={nw} height={nh}
            fill="var(--inspector-card-bg, #fff)"
            stroke={color} strokeWidth={isHovered ? 2 : 1.5} rx={NODE_RX} />
          <text x={x} y={y - nh / 2 + 14} className={styles.label} textAnchor="middle" dominantBaseline="central"
            fontWeight="600" fontSize="11">
            {truncateLabel(data.label, nw)}
          </text>
          {renderInnerLayout(node.innerLayout, x, y + 8, nw - 8, nh - 24)}
        </g>
      )
    }

    if (nodeConfig.stencil) {
      return (
        <g {...groupProps}>
          <foreignObject x={x - nw / 2} y={y - nh / 2} width={nw} height={nh}>
            <div className={styles.foreignObjectWrapper}>
              {nodeConfig.stencil(data)}
            </div>
          </foreignObject>
        </g>
      )
    }

    if (isTreemap) {
      const color = getDepthColor(depth, userPalette, data.color, true)
      const showLabel = nw >= MIN_LABEL_WIDTH && nh >= MIN_LABEL_HEIGHT
      return (
        <g {...groupProps}>
          <rect x={x - nw / 2} y={y - nh / 2} width={nw} height={nh}
            fill={color} stroke="var(--inspector-border, #e5e7eb)"
            strokeWidth={depth === 0 ? 0 : 1} opacity={isHovered ? 0.85 : 1} rx={1} />
          {showLabel && (
            <text x={x - nw / 2 + 4} y={y - nh / 2 + 12} className={styles.label}>
              {truncateLabel(data.label, nw - 8)}
            </text>
          )}
        </g>
      )
    }

    if (isPack) {
      const color = getDepthColor(depth, userPalette, data.color)
      const r = nw / 2
      return (
        <g {...groupProps}>
          <circle cx={x} cy={y} r={r}
            fill={color} stroke="var(--inspector-border, #e5e7eb)"
            strokeWidth={depth === 0 ? 0 : 1} opacity={isHovered ? 0.85 : 1} />
          {r >= 15 && (
            <text x={x} y={y} className={styles.label} textAnchor="middle" dominantBaseline="central">
              {truncateLabel(data.label, r * 1.4)}
            </text>
          )}
        </g>
      )
    }

    const color = getDepthColor(depth, userPalette, data.color)
    return (
      <g {...groupProps}>
        <rect x={x - nw / 2} y={y - nh / 2} width={nw} height={nh}
          fill={isHovered ? 'var(--inspector-hover-bg-active, rgba(0,0,0,0.08))' : 'var(--inspector-card-bg, #fff)'}
          stroke={color} strokeWidth={isHovered ? 2 : 1.5} rx={NODE_RX} />
        <text x={x} y={y} className={styles.label} textAnchor="middle" dominantBaseline="central">
          {truncateLabel(data.label, nw)}
        </text>
      </g>
    )
  }

  return (
    <div className={styles.container}>
      <LayoutSelector selected={selectedLayout} onSelect={setSelectedLayout} />

      <PanZoomSvg width={svgWidth} height={svgHeight} containerRef={containerRef}>
        {layoutResult && (
          <>
            {allEdges.map(renderEdge)}
            {nodes.map(renderNode)}
          </>
        )}
      </PanZoomSvg>

      {hoveredNode && (
        <div className={styles.tooltip}
          style={{ left: hoveredNode.x, top: hoveredNode.y - hoveredNode.height / 2 - 8 }}>
          {hoveredNode.data.label}
          {hoveredNode.data.value !== undefined && (
            <span className={styles.tooltipValue}> ({hoveredNode.data.value})</span>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Layout selector
// ---------------------------------------------------------------------------

function LayoutSelector({
  selected,
  onSelect,
}: {
  selected: MondrianLayoutType
  onSelect: (layout: MondrianLayoutType) => void
}) {
  return (
    <div className={styles.layoutSelector}>
      {(Object.keys(LAYOUT_LABELS) as MondrianLayoutType[]).map(key => (
        <button
          key={key}
          className={`${styles.layoutPill} ${selected === key ? styles.layoutPillActive : ''}`}
          onClick={() => onSelect(key)}
        >
          {LAYOUT_LABELS[key]}
        </button>
      ))}
    </div>
  )
}
