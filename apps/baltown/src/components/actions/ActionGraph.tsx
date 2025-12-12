import { createEffect, onMount, onCleanup, Show, JSX } from 'solid-js'
import cytoscape from 'cytoscape'
import dagre from 'cytoscape-dagre'
import type { Resource } from '../../actions/types'

// Register dagre layout
cytoscape.use(dagre)

interface CellData {
  uri: string
  lattice?: string
  value?: any
}

interface PropagatorData {
  uri: string
  inputs: string[]
  output: string
  handler?: string | any[]
}

interface ActionGraphProps {
  cells: CellData[]
  propagators: PropagatorData[]
  onNodeClick: (resource: Resource, event: MouseEvent) => void
  overlay: JSX.Element | null
}

/**
 * ActionGraph - Cytoscape graph for action system
 *
 * Simplified version of CytoscapeGraph focused on:
 * - Displaying cells and propagators
 * - Handling clicks during actions
 * - Showing action overlays
 */
export default function ActionGraph(props: ActionGraphProps) {
  let containerRef: HTMLDivElement | undefined
  let cy: cytoscape.Core | undefined

  onMount(() => {
    if (!containerRef) return

    cy = cytoscape({
      container: containerRef,
      style: [
        // Cell nodes
        {
          selector: 'node[type="cell"]',
          style: {
            shape: 'round-rectangle',
            width: 120,
            height: 50,
            'background-color': '#21262d',
            'border-width': 2,
            'border-color': '#30363d',
            label: 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            color: '#c9d1d9',
            'font-size': '12px',
            'font-weight': '500',
          },
        },
        // Cell with value
        {
          selector: 'node[type="cell"][hasValue]',
          style: {
            'border-color': '#3fb950',
          },
        },
        // Propagator nodes
        {
          selector: 'node[type="propagator"]',
          style: {
            shape: 'diamond',
            width: 80,
            height: 80,
            'background-color': '#161b22',
            'border-width': 2,
            'border-color': '#58a6ff',
            label: 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            color: '#58a6ff',
            'font-size': '11px',
          },
        },
        // Edges
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#30363d',
            'target-arrow-color': '#30363d',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          },
        },
        // Selected state
        {
          selector: ':selected',
          style: {
            'border-width': 3,
            'border-color': '#f0883e',
          },
        },
        // Hover state
        {
          selector: 'node:active',
          style: {
            'overlay-color': '#58a6ff',
            'overlay-opacity': 0.1,
          },
        },
      ],
      layout: { name: 'preset' },
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.3,
    })

    // Handle clicks
    cy.on('tap', 'node', (evt) => {
      const node = evt.target
      const data = node.data()
      const resource: Resource = {
        uri: data.uri,
        type: data.type,
        name: data.label,
        data: data.originalData,
      }
      props.onNodeClick(resource, evt.originalEvent as MouseEvent)
    })

    // Initial layout
    updateGraph()
  })

  onCleanup(() => {
    cy?.destroy()
  })

  // Update graph when data changes
  createEffect(() => {
    // Trigger on these dependencies
    props.cells
    props.propagators
    updateGraph()
  })

  function updateGraph() {
    if (!cy) return

    const elements: cytoscape.ElementDefinition[] = []

    // Add cell nodes
    props.cells.forEach((cell, i) => {
      const name = cell.uri.split('/').pop() || 'cell'
      elements.push({
        data: {
          id: cell.uri,
          uri: cell.uri,
          type: 'cell',
          label: name,
          hasValue: cell.value !== undefined,
          originalData: cell,
        },
        position: { x: 150 + (i % 3) * 180, y: 100 + Math.floor(i / 3) * 120 },
      })
    })

    // Add propagator nodes and edges
    props.propagators.forEach((prop, i) => {
      const name = prop.uri.split('/').pop() || 'propagator'
      const handlerName =
        typeof prop.handler === 'string'
          ? prop.handler
          : Array.isArray(prop.handler)
            ? prop.handler[0]
            : '?'

      // Calculate position (right side of cells)
      const x = 500 + (i % 2) * 150
      const y = 100 + Math.floor(i / 2) * 120

      elements.push({
        data: {
          id: prop.uri,
          uri: prop.uri,
          type: 'propagator',
          label: handlerName,
          originalData: prop,
        },
        position: { x, y },
      })

      // Add input edges
      prop.inputs.forEach((inputUri) => {
        elements.push({
          data: {
            id: `edge-${inputUri}-${prop.uri}`,
            source: inputUri,
            target: prop.uri,
          },
        })
      })

      // Add output edge
      if (prop.output) {
        elements.push({
          data: {
            id: `edge-${prop.uri}-${prop.output}`,
            source: prop.uri,
            target: prop.output,
          },
        })
      }
    })

    // Update cytoscape
    cy.elements().remove()
    cy.add(elements)

    // Apply dagre layout
    cy.layout({
      name: 'dagre',
      rankDir: 'LR',
      nodeSep: 60,
      rankSep: 100,
      animate: false,
    } as any).run()

    cy.fit(undefined, 50)
  }

  return (
    <div class="action-graph-container">
      <div ref={containerRef} class="action-graph" />

      {/* Action overlay */}
      <Show when={props.overlay}>
        <div class="action-overlay">{props.overlay}</div>
      </Show>

      <style>{`
        .action-graph-container {
          flex: 1;
          position: relative;
          min-height: 0;
        }

        .action-graph {
          width: 100%;
          height: 100%;
          background: #0d1117;
        }

        .action-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 100;
          pointer-events: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  )
}
