import { createSignal, createEffect, For, Show, onCleanup, createMemo } from 'solid-js'
import CellNode from './CellNode'
import PropagatorNode from './PropagatorNode'
import { createEdgePath } from './ConnectionEdge'
import GraphToolbar from './GraphToolbar'
import MiniMap from './MiniMap'
import InspectorPanel from './InspectorPanel'

interface Node {
  id: string
  type: 'cell' | 'propagator'
  uri: string
  name: string
  x: number
  y: number
  // Cell-specific
  lattice?: string
  value?: any
  // Propagator-specific
  handler?: string | any[]
  inputs?: string[]
  output?: string
}

interface Edge {
  id: string
  from: string
  to: string
  type: 'input' | 'output'
}

interface PropagatorGraphProps {
  cells: Array<{
    uri: string
    lattice?: string
    value?: any
  }>
  propagators: Array<{
    uri: string
    inputs: string[]
    output: string
    handler?: string | any[]
  }>
  onCellClick?: (uri: string) => void
  onPropagatorClick?: (uri: string) => void
  firingPropagators?: Set<string>
}

/**
 * PropagatorGraph - Interactive node-graph visualization
 *
 * Features:
 * - Pan/zoom with mouse
 * - Click node to select and edit
 * - Drag nodes to reposition
 * - Auto-layout option
 * - Mini-map navigation
 */
export default function PropagatorGraph(props: PropagatorGraphProps) {
  let svgRef: SVGSVGElement | undefined
  let containerRef: HTMLDivElement | undefined

  // View state
  const [viewBox, setViewBox] = createSignal({ x: -200, y: -150, width: 800, height: 600 })
  const [zoom, setZoom] = createSignal(1)
  const [isPanning, setIsPanning] = createSignal(false)
  const [panStart, setPanStart] = createSignal({ x: 0, y: 0 })

  // Selection state
  const [selectedNode, setSelectedNode] = createSignal<string | null>(null)
  const [draggingNode, setDraggingNode] = createSignal<string | null>(null)
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 })

  // Build nodes from props
  const [nodePositions, setNodePositions] = createSignal<Record<string, { x: number; y: number }>>({})

  // Initialize positions with auto-layout
  createEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {}

    // Position cells on the left
    props.cells.forEach((cell, i) => {
      positions[cell.uri] = {
        x: 0,
        y: i * 80 - (props.cells.length - 1) * 40
      }
    })

    // Position propagators in the middle
    props.propagators.forEach((prop, i) => {
      positions[prop.uri] = {
        x: 200,
        y: i * 80 - (props.propagators.length - 1) * 40
      }
    })

    // Position output cells on the right
    const outputCells = new Set(props.propagators.map(p => p.output).filter(Boolean))
    let outputIndex = 0
    outputCells.forEach(uri => {
      if (!positions[uri]) {
        positions[uri] = {
          x: 400,
          y: outputIndex * 80 - (outputCells.size - 1) * 40
        }
        outputIndex++
      }
    })

    setNodePositions(positions)
  })

  // Build nodes list
  const nodes = createMemo((): Node[] => {
    const positions = nodePositions()
    const result: Node[] = []

    // Add cells
    props.cells.forEach(cell => {
      const pos = positions[cell.uri] || { x: 0, y: 0 }
      result.push({
        id: cell.uri,
        type: 'cell',
        uri: cell.uri,
        name: cell.uri.split('/').pop() || 'cell',
        x: pos.x,
        y: pos.y,
        lattice: cell.lattice,
        value: cell.value
      })
    })

    // Add propagators
    props.propagators.forEach(prop => {
      const pos = positions[prop.uri] || { x: 200, y: 0 }
      result.push({
        id: prop.uri,
        type: 'propagator',
        uri: prop.uri,
        name: prop.uri.split('/').pop() || 'prop',
        x: pos.x,
        y: pos.y,
        handler: prop.handler,
        inputs: prop.inputs,
        output: prop.output
      })
    })

    // Add output cells that aren't already input cells
    const existingCells = new Set(props.cells.map(c => c.uri))
    props.propagators.forEach(prop => {
      if (prop.output && !existingCells.has(prop.output)) {
        const pos = positions[prop.output] || { x: 400, y: 0 }
        result.push({
          id: prop.output,
          type: 'cell',
          uri: prop.output,
          name: prop.output.split('/').pop() || 'output',
          x: pos.x,
          y: pos.y
        })
      }
    })

    return result
  })

  // Build edges
  const edges = createMemo((): Edge[] => {
    const result: Edge[] = []

    props.propagators.forEach(prop => {
      // Input edges
      prop.inputs?.forEach((input, i) => {
        result.push({
          id: `${input}->${prop.uri}`,
          from: input,
          to: prop.uri,
          type: 'input'
        })
      })

      // Output edge
      if (prop.output) {
        result.push({
          id: `${prop.uri}->${prop.output}`,
          from: prop.uri,
          to: prop.output,
          type: 'output'
        })
      }
    })

    return result
  })

  // Get selected node data
  const selectedNodeData = createMemo(() => {
    const id = selectedNode()
    if (!id) return null
    return nodes().find(n => n.id === id) || null
  })

  // Convert screen coords to SVG coords
  function screenToSVG(screenX: number, screenY: number): { x: number; y: number } {
    if (!svgRef) return { x: 0, y: 0 }
    const rect = svgRef.getBoundingClientRect()
    const vb = viewBox()
    const scaleX = vb.width / rect.width
    const scaleY = vb.height / rect.height
    return {
      x: (screenX - rect.left) * scaleX + vb.x,
      y: (screenY - rect.top) * scaleY + vb.y
    }
  }

  // Pan handlers
  function handleMouseDown(e: MouseEvent) {
    if (e.target === svgRef || (e.target as Element).classList.contains('graph-background')) {
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
      setSelectedNode(null)
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (isPanning()) {
      const vb = viewBox()
      const dx = (panStart().x - e.clientX) * (vb.width / (containerRef?.clientWidth || 800))
      const dy = (panStart().y - e.clientY) * (vb.height / (containerRef?.clientHeight || 600))
      setViewBox({ ...vb, x: vb.x + dx, y: vb.y + dy })
      setPanStart({ x: e.clientX, y: e.clientY })
    }

    if (draggingNode()) {
      const pos = screenToSVG(e.clientX, e.clientY)
      setNodePositions(prev => ({
        ...prev,
        [draggingNode()!]: {
          x: pos.x - dragOffset().x,
          y: pos.y - dragOffset().y
        }
      }))
    }
  }

  function handleMouseUp() {
    setIsPanning(false)
    setDraggingNode(null)
  }

  // Node drag handlers
  function handleNodeDragStart(nodeId: string, e: MouseEvent) {
    e.stopPropagation()
    const pos = screenToSVG(e.clientX, e.clientY)
    const nodePos = nodePositions()[nodeId] || { x: 0, y: 0 }
    setDragOffset({ x: pos.x - nodePos.x, y: pos.y - nodePos.y })
    setDraggingNode(nodeId)
    setSelectedNode(nodeId)
  }

  // Zoom handlers
  function handleWheel(e: WheelEvent) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 1.1 : 0.9
    const newZoom = Math.min(Math.max(zoom() * delta, 0.1), 5)
    setZoom(newZoom)

    const vb = viewBox()
    const pos = screenToSVG(e.clientX, e.clientY)
    const newWidth = vb.width * delta
    const newHeight = vb.height * delta

    setViewBox({
      x: pos.x - (pos.x - vb.x) * delta,
      y: pos.y - (pos.y - vb.y) * delta,
      width: newWidth,
      height: newHeight
    })
  }

  // Zoom controls
  function zoomIn() {
    const vb = viewBox()
    setViewBox({ ...vb, width: vb.width * 0.8, height: vb.height * 0.8 })
    setZoom(z => z * 1.25)
  }

  function zoomOut() {
    const vb = viewBox()
    setViewBox({ ...vb, width: vb.width * 1.2, height: vb.height * 1.2 })
    setZoom(z => z * 0.8)
  }

  function fitView() {
    if (nodes().length === 0) return

    const xs = nodes().map(n => n.x)
    const ys = nodes().map(n => n.y)
    const minX = Math.min(...xs) - 100
    const maxX = Math.max(...xs) + 100
    const minY = Math.min(...ys) - 100
    const maxY = Math.max(...ys) + 100

    setViewBox({
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    })
    setZoom(1)
  }

  // Auto-layout
  function autoLayout() {
    const positions: Record<string, { x: number; y: number }> = {}
    const inputCells = new Set(props.propagators.flatMap(p => p.inputs || []))
    const outputCells = new Set(props.propagators.map(p => p.output).filter(Boolean))

    // Pure inputs on left
    const pureInputs = props.cells.filter(c => inputCells.has(c.uri) && !outputCells.has(c.uri))
    pureInputs.forEach((c, i) => {
      positions[c.uri] = { x: 0, y: i * 100 - (pureInputs.length - 1) * 50 }
    })

    // Propagators in middle
    props.propagators.forEach((p, i) => {
      positions[p.uri] = { x: 250, y: i * 100 - (props.propagators.length - 1) * 50 }
    })

    // Pure outputs on right
    const pureOutputUris = [...outputCells].filter(u => !inputCells.has(u))
    pureOutputUris.forEach((uri, i) => {
      positions[uri] = { x: 500, y: i * 100 - (pureOutputUris.length - 1) * 50 }
    })

    // Mixed cells
    const mixed = props.cells.filter(c => inputCells.has(c.uri) && outputCells.has(c.uri))
    mixed.forEach((c, i) => {
      positions[c.uri] = { x: 250, y: i * 100 + 200 }
    })

    setNodePositions(positions)
    fitView()
  }

  // Setup event listeners
  createEffect(() => {
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mousemove', handleMouseMove)
    onCleanup(() => {
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mousemove', handleMouseMove)
    })
  })

  return (
    <div
      ref={containerRef}
      class="propagator-graph"
      onMouseDown={handleMouseDown}
    >
      <GraphToolbar
        zoom={zoom()}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitView={fitView}
        onAutoLayout={autoLayout}
        hasSelection={!!selectedNode()}
      />

      <svg
        ref={svgRef}
        class="graph-canvas"
        viewBox={`${viewBox().x} ${viewBox().y} ${viewBox().width} ${viewBox().height}`}
        onWheel={handleWheel}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#21262d" stroke-width="0.5"/>
          </pattern>
        </defs>

        {/* Background with grid */}
        <rect
          class="graph-background"
          x={viewBox().x - 1000}
          y={viewBox().y - 1000}
          width={viewBox().width + 2000}
          height={viewBox().height + 2000}
          fill="url(#grid)"
        />

        {/* Edges */}
        <g class="edges">
          <For each={edges()}>
            {(edge) => {
              const fromNode = nodes().find(n => n.id === edge.from)
              const toNode = nodes().find(n => n.id === edge.to)
              if (!fromNode || !toNode) return null

              const fromPort = fromNode.type === 'cell' ? 'right' : 'right'
              const toPort = toNode.type === 'propagator' ? 'left' : 'left'

              const path = createEdgePath(
                fromNode.x,
                fromNode.y,
                toNode.x,
                toNode.y,
                fromPort,
                toPort
              )

              const isFiring = props.firingPropagators?.has(edge.from) ||
                               props.firingPropagators?.has(edge.to)

              return (
                <g class={`edge ${isFiring ? 'firing' : ''}`}>
                  <path
                    d={path}
                    fill="none"
                    stroke={isFiring ? '#58a6ff' : edge.type === 'output' ? '#3fb950' : '#30363d'}
                    stroke-width={isFiring ? 2 : 1}
                    opacity={0.8}
                  />
                  <Show when={isFiring}>
                    <path
                      d={path}
                      fill="none"
                      stroke="#58a6ff"
                      stroke-width="4"
                      stroke-dasharray="8 12"
                      opacity="0.5"
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        values="20;0"
                        dur="0.5s"
                        repeatCount="indefinite"
                      />
                    </path>
                  </Show>
                </g>
              )
            }}
          </For>
        </g>

        {/* Nodes */}
        <g class="nodes">
          <For each={nodes()}>
            {(node) => (
              <Show when={node.type === 'cell'}>
                <CellNode
                  {...node}
                  selected={selectedNode() === node.id}
                  highlighted={edges().some(e =>
                    (e.from === node.id || e.to === node.id) &&
                    (selectedNode() === e.from || selectedNode() === e.to)
                  )}
                  onSelect={() => {
                    setSelectedNode(node.id)
                    props.onCellClick?.(node.uri)
                  }}
                  onDragStart={(e) => handleNodeDragStart(node.id, e)}
                />
              </Show>
            )}
          </For>

          <For each={nodes()}>
            {(node) => (
              <Show when={node.type === 'propagator'}>
                <PropagatorNode
                  {...node}
                  inputCount={node.inputs?.length || 0}
                  selected={selectedNode() === node.id}
                  firing={props.firingPropagators?.has(node.uri)}
                  onSelect={() => {
                    setSelectedNode(node.id)
                    props.onPropagatorClick?.(node.uri)
                  }}
                  onDragStart={(e) => handleNodeDragStart(node.id, e)}
                />
              </Show>
            )}
          </For>
        </g>
      </svg>

      <MiniMap
        nodes={nodes().map(n => ({ id: n.id, type: n.type, x: n.x, y: n.y }))}
        viewBox={viewBox()}
        viewport={{
          x: viewBox().x,
          y: viewBox().y,
          width: viewBox().width,
          height: viewBox().height
        }}
        onViewportChange={(x, y) => setViewBox(vb => ({ ...vb, x, y }))}
      />

      <InspectorPanel
        node={selectedNodeData()}
        onClose={() => setSelectedNode(null)}
        onUpdate={(updates) => {
          // Would update via Bassline API
          console.log('Update node:', selectedNode(), updates)
        }}
        onDelete={() => {
          // Would delete via Bassline API
          console.log('Delete node:', selectedNode())
          setSelectedNode(null)
        }}
      />

      <style>{`
        .propagator-graph {
          position: relative;
          width: 100%;
          height: 500px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 8px;
          overflow: hidden;
          cursor: grab;
        }

        .propagator-graph:active {
          cursor: grabbing;
        }

        .graph-canvas {
          width: 100%;
          height: 100%;
        }

        .graph-background {
          cursor: grab;
        }

        .edge.firing path {
          filter: drop-shadow(0 0 4px #58a6ff);
        }
      `}</style>
    </div>
  )
}
