import { createEffect, onMount, onCleanup, createSignal, Show } from 'solid-js'
import cytoscape, { Core, NodeSingular, EdgeSingular } from 'cytoscape'
// @ts-ignore - dagre typings
import dagre from 'cytoscape-dagre'
import { useBassline } from '@bassline/solid'
import GraphToolbar from './GraphToolbar'
import InspectorPanel from './InspectorPanel'

// Register dagre layout
cytoscape.use(dagre)

interface CytoscapeGraphProps {
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
  onRefresh?: () => void
}

interface SelectedNodeData {
  id: string
  type: 'cell' | 'propagator'
  uri: string
  name: string
  x: number
  y: number
  lattice?: string
  value?: any
  handler?: string | any[]
  inputs?: string[]
  output?: string
}

/**
 * CytoscapeGraph - Interactive graph visualization using Cytoscape.js
 */
export default function CytoscapeGraph(props: CytoscapeGraphProps) {
  const bl = useBassline()
  let containerRef: HTMLDivElement | undefined
  let cy: Core | undefined

  const [selectedNode, setSelectedNode] = createSignal<SelectedNodeData | null>(null)
  const [zoom, setZoom] = createSignal(1)

  // Build Cytoscape elements from props
  function buildElements() {
    const nodes: cytoscape.ElementDefinition[] = []
    const edges: cytoscape.EdgeDefinition[] = []
    const seenCells = new Set<string>()

    // Add cells as nodes
    props.cells.forEach(cell => {
      seenCells.add(cell.uri)
      nodes.push({
        data: {
          id: cell.uri,
          label: cell.uri.split('/').pop() || 'cell',
          type: 'cell',
          uri: cell.uri,
          lattice: cell.lattice,
          value: cell.value
        },
        classes: 'cell'
      })
    })

    // Add propagators as nodes
    props.propagators.forEach(prop => {
      const handlerName = typeof prop.handler === 'string'
        ? prop.handler
        : Array.isArray(prop.handler)
          ? prop.handler[0]
          : '?'

      nodes.push({
        data: {
          id: prop.uri,
          label: handlerName,
          type: 'propagator',
          uri: prop.uri,
          handler: prop.handler,
          inputs: prop.inputs,
          output: prop.output
        },
        classes: 'propagator'
      })

      // Add edges from inputs to propagator
      prop.inputs?.forEach(input => {
        // Add input cell if not already added
        if (!seenCells.has(input)) {
          seenCells.add(input)
          nodes.push({
            data: {
              id: input,
              label: input.split('/').pop() || 'cell',
              type: 'cell',
              uri: input
            },
            classes: 'cell'
          })
        }

        edges.push({
          data: {
            id: `${input}->${prop.uri}`,
            source: input,
            target: prop.uri,
            edgeType: 'input'
          }
        })
      })

      // Add output cell and edge
      if (prop.output) {
        if (!seenCells.has(prop.output)) {
          seenCells.add(prop.output)
          nodes.push({
            data: {
              id: prop.output,
              label: prop.output.split('/').pop() || 'output',
              type: 'cell',
              uri: prop.output
            },
            classes: 'cell output'
          })
        }

        edges.push({
          data: {
            id: `${prop.uri}->${prop.output}`,
            source: prop.uri,
            target: prop.output,
            edgeType: 'output'
          }
        })
      }
    })

    return { nodes, edges }
  }

  // Initialize Cytoscape
  onMount(() => {
    if (!containerRef) return

    const { nodes, edges } = buildElements()

    cy = cytoscape({
      container: containerRef,
      elements: [...nodes, ...edges],
      style: [
        // Cell nodes - rectangles
        {
          selector: 'node.cell',
          style: {
            'shape': 'round-rectangle',
            'width': 120,
            'height': 50,
            'background-color': '#21262d',
            'border-width': 2,
            'border-color': '#30363d',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#c9d1d9',
            'font-size': '12px',
            'font-family': 'monospace'
          }
        },
        // Output cells - green tint
        {
          selector: 'node.cell.output',
          style: {
            'border-color': '#3fb950'
          }
        },
        // Propagator nodes - diamonds
        {
          selector: 'node.propagator',
          style: {
            'shape': 'diamond',
            'width': 100,
            'height': 60,
            'background-color': '#161b22',
            'border-width': 2,
            'border-color': '#58a6ff',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#58a6ff',
            'font-size': '11px',
            'font-family': 'monospace'
          }
        },
        // Selected nodes
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#f0883e'
          }
        },
        // Edges
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#30363d',
            'target-arrow-color': '#30363d',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.8
          }
        },
        // Output edges - green
        {
          selector: 'edge[edgeType="output"]',
          style: {
            'line-color': '#3fb950',
            'target-arrow-color': '#3fb950'
          }
        },
        // Highlighted edges (connected to selected)
        {
          selector: 'edge.highlighted',
          style: {
            'width': 3,
            'line-color': '#58a6ff',
            'target-arrow-color': '#58a6ff'
          }
        }
      ],
      layout: {
        name: 'dagre',
        rankDir: 'LR', // Left to right
        nodeSep: 80,
        rankSep: 150,
        padding: 50
      } as any,
      minZoom: 0.2,
      maxZoom: 3,
      wheelSensitivity: 0.3
    })

    // Handle node selection
    cy.on('tap', 'node', (evt) => {
      const node = evt.target as NodeSingular
      const data = node.data()
      const pos = node.position()

      // Highlight connected edges
      cy?.edges().removeClass('highlighted')
      node.connectedEdges().addClass('highlighted')

      setSelectedNode({
        id: data.id,
        type: data.type,
        uri: data.uri,
        name: data.label,
        x: pos.x,
        y: pos.y,
        lattice: data.lattice,
        value: data.value,
        handler: data.handler,
        inputs: data.inputs,
        output: data.output
      })

      if (data.type === 'cell') {
        props.onCellClick?.(data.uri)
      } else {
        props.onPropagatorClick?.(data.uri)
      }
    })

    // Clear selection on background tap
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null)
        cy?.edges().removeClass('highlighted')
      }
    })

    // Track zoom changes
    cy.on('zoom', () => {
      setZoom(cy?.zoom() || 1)
    })

    // Initial fit
    cy.fit(undefined, 50)
    setZoom(cy.zoom())
  })

  // Update elements when props change
  createEffect(() => {
    if (!cy) return

    const { nodes, edges } = buildElements()

    // Clear and rebuild
    cy.elements().remove()
    cy.add([...nodes, ...edges])

    // Re-run layout
    cy.layout({
      name: 'dagre',
      rankDir: 'LR',
      nodeSep: 80,
      rankSep: 150,
      padding: 50
    } as any).run()

    cy.fit(undefined, 50)
    setZoom(cy.zoom())
  })

  // Highlight firing propagators
  createEffect(() => {
    if (!cy || !props.firingPropagators) return

    cy.nodes('.propagator').forEach(node => {
      if (props.firingPropagators?.has(node.data('uri'))) {
        node.style('border-color', '#58a6ff')
        node.style('border-width', 4)
      } else {
        node.style('border-color', '#58a6ff')
        node.style('border-width', 2)
      }
    })
  })

  // Cleanup
  onCleanup(() => {
    cy?.destroy()
  })

  // Zoom controls
  function zoomIn() {
    cy?.zoom(cy.zoom() * 1.25)
    cy?.center()
    setZoom(cy?.zoom() || 1)
  }

  function zoomOut() {
    cy?.zoom(cy.zoom() * 0.8)
    cy?.center()
    setZoom(cy?.zoom() || 1)
  }

  function fitView() {
    cy?.fit(undefined, 50)
    setZoom(cy?.zoom() || 1)
  }

  function autoLayout() {
    cy?.layout({
      name: 'dagre',
      rankDir: 'LR',
      nodeSep: 80,
      rankSep: 150,
      padding: 50
    } as any).run()
    cy?.fit(undefined, 50)
    setZoom(cy?.zoom() || 1)
  }

  // Handle cell creation
  function handleCellCreated(_cellName: string) {
    props.onRefresh?.()
  }

  // Handle propagator creation
  function handlePropagatorCreated(_propagatorName: string) {
    props.onRefresh?.()
  }

  // Handle node deletion
  async function handleDeleteNode() {
    const node = selectedNode()
    if (!node) return

    if (!confirm(`Are you sure you want to delete ${node.name}?`)) {
      return
    }

    try {
      await bl.put(`${node.uri}/kill`, {}, {})
      setSelectedNode(null)
      props.onRefresh?.()
    } catch (err) {
      console.error('Failed to delete node:', err)
      alert(`Failed to delete ${node.name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <div class="cytoscape-graph-container">
      <GraphToolbar
        zoom={zoom()}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitView={fitView}
        onAutoLayout={autoLayout}
        onAddCell={handleCellCreated}
        onAddPropagator={handlePropagatorCreated}
        onDelete={handleDeleteNode}
        hasSelection={!!selectedNode()}
      />

      <div ref={containerRef} class="cytoscape-container" />

      <InspectorPanel
        node={selectedNode()}
        onClose={() => setSelectedNode(null)}
        onUpdate={() => props.onRefresh?.()}
        onDelete={handleDeleteNode}
      />

      <style>{`
        .cytoscape-graph-container {
          position: relative;
          width: 100%;
          height: 500px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 8px;
          overflow: hidden;
        }

        .cytoscape-container {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  )
}
