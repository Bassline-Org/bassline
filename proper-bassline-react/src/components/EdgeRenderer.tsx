/**
 * EdgeRenderer - Renders connections between nodes as SVG paths
 */

import React from 'react'
import { useCell } from '../hooks'
import type { VisualNode } from 'proper-bassline/src/visual-node'

interface Edge {
  id: string
  source: VisualNode
  target: VisualNode
  sourceOutput?: string
  targetInput?: string
}

interface EdgeRendererProps {
  edge: Edge
  selected?: boolean
}

export function EdgeRenderer({ edge, selected = false }: EdgeRendererProps) {
  const [sourcePos] = useCell(edge.source.position)
  const [sourceSize] = useCell(edge.source.size)
  const [targetPos] = useCell(edge.target.position)
  const [targetSize] = useCell(edge.target.size)
  
  // Extract values
  const sourceX = (sourcePos as any)?.x?.value ?? 0
  const sourceY = (sourcePos as any)?.y?.value ?? 0
  const sourceWidth = (sourceSize as any)?.width?.value ?? 150
  const sourceHeight = (sourceSize as any)?.height?.value ?? 100
  
  const targetX = (targetPos as any)?.x?.value ?? 0
  const targetY = (targetPos as any)?.y?.value ?? 0
  const targetWidth = (targetSize as any)?.width?.value ?? 150
  const targetHeight = (targetSize as any)?.height?.value ?? 100
  
  // Calculate connection points (right side of source to left side of target)
  const x1 = sourceX + sourceWidth
  const y1 = sourceY + sourceHeight / 2
  const x2 = targetX
  const y2 = targetY + targetHeight / 2
  
  // Create a smooth bezier curve
  const controlPointOffset = Math.abs(x2 - x1) * 0.5
  const d = `M ${x1} ${y1} C ${x1 + controlPointOffset} ${y1}, ${x2 - controlPointOffset} ${y2}, ${x2} ${y2}`
  
  return (
    <g>
      {/* Shadow/background path for better visibility */}
      <path
        d={d}
        fill="none"
        stroke="white"
        strokeWidth={selected ? 5 : 4}
        opacity={0.8}
      />
      
      {/* Main path */}
      <path
        d={d}
        fill="none"
        stroke={selected ? '#3b82f6' : '#9ca3af'}
        strokeWidth={selected ? 3 : 2}
        strokeDasharray={selected ? '0' : '5,5'}
        className="transition-all"
      />
      
      {/* Arrowhead */}
      <polygon
        points={`${x2},${y2} ${x2 - 8},${y2 - 4} ${x2 - 8},${y2 + 4}`}
        fill={selected ? '#3b82f6' : '#9ca3af'}
      />
      
      {/* Connection labels */}
      {edge.sourceOutput && (
        <text
          x={x1 + 10}
          y={y1 - 5}
          fontSize="10"
          fill="#666"
          className="select-none"
        >
          {edge.sourceOutput}
        </text>
      )}
      
      {edge.targetInput && (
        <text
          x={x2 - 30}
          y={y2 - 5}
          fontSize="10"
          fill="#666"
          className="select-none"
        >
          {edge.targetInput}
        </text>
      )}
    </g>
  )
}

interface EdgesProps {
  edges: Edge[]
  selectedEdgeId?: string
}

export function Edges({ edges, selectedEdgeId }: EdgesProps) {
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    >
      {edges.map(edge => (
        <EdgeRenderer
          key={edge.id}
          edge={edge}
          selected={edge.id === selectedEdgeId}
        />
      ))}
    </svg>
  )
}