import { useState, useEffect, useRef, useCallback } from 'react'
import { useBassline } from '@bassline/react'
import { IconCircle, IconArrowRight, IconRefresh, IconZoomIn, IconZoomOut, IconFocus } from '@tabler/icons-react'
import { REMOTE_PREFIX } from '../config.js'

/**
 * Simple force-directed graph simulation
 */
function useForceSimulation(nodes, edges, width, height) {
  const [positions, setPositions] = useState({})
  const animationRef = useRef(null)

  useEffect(() => {
    if (nodes.length === 0) return

    // Initialize positions randomly
    const pos = {}
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2
      const radius = Math.min(width, height) * 0.3
      pos[node.id] = {
        x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
        y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0
      }
    })

    // Create edge lookup
    const edgeMap = {}
    edges.forEach(e => {
      if (!edgeMap[e.source]) edgeMap[e.source] = []
      if (!edgeMap[e.target]) edgeMap[e.target] = []
      edgeMap[e.source].push(e.target)
      edgeMap[e.target].push(e.source)
    })

    // Simulation step
    let iteration = 0
    const maxIterations = 300
    const simulate = () => {
      if (iteration >= maxIterations) return

      const alpha = 1 - iteration / maxIterations

      // Repulsion between all nodes
      nodes.forEach(node1 => {
        nodes.forEach(node2 => {
          if (node1.id === node2.id) return
          const p1 = pos[node1.id]
          const p2 = pos[node2.id]
          const dx = p2.x - p1.x
          const dy = p2.y - p1.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = -500 * alpha / (dist * dist)
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          p1.vx -= fx
          p1.vy -= fy
          p2.vx += fx
          p2.vy += fy
        })
      })

      // Attraction along edges
      edges.forEach(edge => {
        const p1 = pos[edge.source]
        const p2 = pos[edge.target]
        if (!p1 || !p2) return
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = (dist - 100) * 0.05 * alpha
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        p1.vx += fx
        p1.vy += fy
        p2.vx -= fx
        p2.vy -= fy
      })

      // Center gravity
      nodes.forEach(node => {
        const p = pos[node.id]
        p.vx += (width / 2 - p.x) * 0.01 * alpha
        p.vy += (height / 2 - p.y) * 0.01 * alpha
      })

      // Apply velocity with damping
      nodes.forEach(node => {
        const p = pos[node.id]
        p.vx *= 0.8
        p.vy *= 0.8
        p.x += p.vx
        p.y += p.vy
        // Bounds
        p.x = Math.max(50, Math.min(width - 50, p.x))
        p.y = Math.max(50, Math.min(height - 50, p.y))
      })

      iteration++
      setPositions({ ...pos })
      animationRef.current = requestAnimationFrame(simulate)
    }

    simulate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [nodes, edges, width, height])

  return positions
}

/**
 * Network Graph View - Force-directed visualization of cells and propagators
 */
export default function NetworkGraph({ onNavigate }) {
  const bl = useBassline()
  const containerRef = useRef(null)
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState(null)

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        })
      }
    }
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const newNodes = []
      const newEdges = []
      const nodeIds = new Set()

      // Fetch cells from remote daemon
      try {
        const cellsRes = await bl.get(`${REMOTE_PREFIX}/cells`)
        if (cellsRes?.body?.entries) {
          cellsRes.body.entries.forEach(cell => {
            const id = cell.uri || `cell:${cell.name}`
            if (!nodeIds.has(id)) {
              nodeIds.add(id)
              newNodes.push({
                id,
                type: 'cell',
                label: cell.label || cell.name,
                value: cell.value,
                uri: cell.uri
              })
            }
          })
        }
      } catch {}

      // Fetch propagators from remote daemon
      try {
        const propsRes = await bl.get(`${REMOTE_PREFIX}/propagators`)
        if (propsRes?.body?.entries) {
          propsRes.body.entries.forEach(prop => {
            const id = prop.uri || `prop:${prop.name}`
            if (!nodeIds.has(id)) {
              nodeIds.add(id)
              newNodes.push({
                id,
                type: 'propagator',
                label: prop.label || prop.name,
                firing: prop.firing,
                uri: prop.uri
              })
            }

            // Create edges for inputs/output
            if (prop.inputs) {
              prop.inputs.forEach(input => {
                newEdges.push({
                  source: input,
                  target: id,
                  type: 'input'
                })
              })
            }
            if (prop.output) {
              newEdges.push({
                source: id,
                target: prop.output,
                type: 'output'
              })
            }
          })
        }
      } catch {}

      setNodes(newNodes)
      setEdges(newEdges)
    } finally {
      setLoading(false)
    }
  }, [bl])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Get simulated positions
  const positions = useForceSimulation(nodes, edges, dimensions.width, dimensions.height)

  const handleNodeClick = (node) => {
    setSelectedNode(node)
    if (onNavigate && node.uri) {
      onNavigate(node.uri)
    }
  }

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 3))
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.3))
  const handleReset = () => setZoom(1)

  if (loading) {
    return (
      <div className="network-graph">
        <div className="network-graph-loading pulse">Loading network...</div>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="network-graph">
        <div className="network-graph-empty">
          <p>No cells or propagators yet</p>
          <p className="text-muted">Create some cells and propagators to see the network</p>
        </div>
      </div>
    )
  }

  return (
    <div className="network-graph" ref={containerRef}>
      <div className="network-graph-controls">
        <button onClick={loadData} title="Refresh">
          <IconRefresh size={16} />
        </button>
        <button onClick={handleZoomIn} title="Zoom In">
          <IconZoomIn size={16} />
        </button>
        <button onClick={handleZoomOut} title="Zoom Out">
          <IconZoomOut size={16} />
        </button>
        <button onClick={handleReset} title="Reset View">
          <IconFocus size={16} />
        </button>
        <span className="network-graph-stats">
          {nodes.filter(n => n.type === 'cell').length} cells, {nodes.filter(n => n.type === 'propagator').length} propagators
        </span>
      </div>

      <svg
        width={dimensions.width}
        height={dimensions.height}
        style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--border)" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const source = positions[edge.source]
          const target = positions[edge.target]
          if (!source || !target) return null

          return (
            <line
              key={i}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="var(--border)"
              strokeWidth={2}
              markerEnd="url(#arrowhead)"
              opacity={0.6}
            />
          )
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const pos = positions[node.id]
          if (!pos) return null

          const isCell = node.type === 'cell'
          const color = isCell ? 'var(--type-cell)' : 'var(--type-propagator)'
          const size = isCell ? 30 : 25
          const isSelected = selectedNode?.id === node.id

          return (
            <g
              key={node.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={() => handleNodeClick(node)}
              style={{ cursor: 'pointer' }}
            >
              {/* Node shape */}
              {isCell ? (
                <circle
                  r={size / 2}
                  fill="var(--surface-1)"
                  stroke={color}
                  strokeWidth={isSelected ? 3 : 2}
                />
              ) : (
                <rect
                  x={-size / 2}
                  y={-size / 2}
                  width={size}
                  height={size}
                  fill="var(--surface-1)"
                  stroke={color}
                  strokeWidth={isSelected ? 3 : 2}
                />
              )}

              {/* Icon */}
              {isCell ? (
                <circle r={4} fill={color} />
              ) : (
                <polygon points="-4,0 4,-4 4,4" fill={color} />
              )}

              {/* Label */}
              <text
                y={size / 2 + 14}
                textAnchor="middle"
                fill="var(--fg)"
                fontSize={11}
                fontFamily="var(--mono)"
              >
                {node.label}
              </text>

              {/* Value for cells */}
              {isCell && node.value !== undefined && (
                <text
                  y={size / 2 + 26}
                  textAnchor="middle"
                  fill={color}
                  fontSize={10}
                  fontFamily="var(--mono)"
                  fontWeight="600"
                >
                  {String(node.value)}
                </text>
              )}

              {/* Firing indicator */}
              {!isCell && node.firing && (
                <circle
                  r={size / 2 + 4}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  opacity={0.5}
                  className="pulse"
                />
              )}
            </g>
          )
        })}
      </svg>

      {/* Selected node details */}
      {selectedNode && (
        <div className="network-graph-details">
          <div className="network-graph-details-header">
            {selectedNode.type === 'cell' ? (
              <IconCircle size={16} style={{ color: 'var(--type-cell)' }} />
            ) : (
              <IconArrowRight size={16} style={{ color: 'var(--type-propagator)' }} />
            )}
            <span>{selectedNode.label}</span>
          </div>
          {selectedNode.value !== undefined && (
            <div className="network-graph-details-value">
              Value: <strong>{String(selectedNode.value)}</strong>
            </div>
          )}
          {selectedNode.uri && (
            <div className="network-graph-details-uri">
              {selectedNode.uri}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
