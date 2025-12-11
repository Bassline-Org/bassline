import { createEffect, onMount, onCleanup, createSignal, Show } from 'solid-js'
import cytoscape, { Core, NodeSingular } from 'cytoscape'
// @ts-ignore - dagre typings
import dagre from 'cytoscape-dagre'

// Register dagre layout
cytoscape.use(dagre)

interface PlugboardGraphProps {
  sources: Array<{
    type: string
    events: string[]
  }>
  rules: Array<{
    name: string
    match: object
    port: string
    uri: string
  }>
  ports: Array<{
    name: string
    listenerCount: number
  }>
  onSourceClick?: (source: { type: string; events: string[] }) => void
  onRuleClick?: (rule: { name: string; match: object; port: string; uri: string }) => void
  onPortClick?: (port: { name: string; listenerCount: number }) => void
}

interface SelectedNodeData {
  id: string
  type: 'source' | 'rule' | 'port'
  label: string
  data: any
}

/**
 * PlugboardGraph - Visualizes message routing through the plumber
 * Layout: Sources (left) -> Rules (center) -> Ports (right)
 */
export default function PlugboardGraph(props: PlugboardGraphProps) {
  let containerRef: HTMLDivElement | undefined
  let cy: Core | undefined

  const [selectedNode, setSelectedNode] = createSignal<SelectedNodeData | null>(null)
  const [zoom, setZoom] = createSignal(1)

  // Build Cytoscape elements from props
  function buildElements() {
    const nodes: cytoscape.ElementDefinition[] = []
    const edges: cytoscape.EdgeDefinition[] = []
    const addedPorts = new Set<string>()

    // 1. Add source nodes (left column)
    props.sources.forEach(source => {
      nodes.push({
        data: {
          id: `source-${source.type}`,
          label: source.type,
          type: 'source',
          sourceData: source
        },
        classes: 'source'
      })
    })

    // 2. Add port nodes FIRST (right column) - ports with listeners
    props.ports.forEach(port => {
      nodes.push({
        data: {
          id: `port-${port.name}`,
          label: `${port.name}\n(${port.listenerCount})`,
          type: 'port',
          portData: port
        },
        classes: port.listenerCount > 0 ? 'port active' : 'port inactive'
      })
      addedPorts.add(port.name)
    })

    // 3. Add rule nodes (center column) and collect edges
    props.rules.forEach(rule => {
      nodes.push({
        data: {
          id: `rule-${rule.name}`,
          label: rule.name,
          type: 'rule',
          ruleData: rule
        },
        classes: 'rule'
      })

      // Add port node if it doesn't exist yet (rule references port with no listeners)
      if (rule.port && !addedPorts.has(rule.port)) {
        nodes.push({
          data: {
            id: `port-${rule.port}`,
            label: `${rule.port}\n(no listeners)`,
            type: 'port',
            portData: { name: rule.port, listenerCount: 0 }
          },
          classes: 'port inactive'
        })
        addedPorts.add(rule.port)
      }
    })

    // 4. Add edges AFTER all nodes exist
    props.rules.forEach(rule => {
      // Connect sources to rules based on match pattern heuristics
      props.sources.forEach(source => {
        const matchStr = JSON.stringify(rule.match).toLowerCase()
        const mightMatch = source.events.some(event =>
          matchStr.includes(event.toLowerCase()) ||
          matchStr.includes(source.type.toLowerCase())
        )
        if (mightMatch) {
          edges.push({
            data: {
              id: `source-${source.type}->rule-${rule.name}`,
              source: `source-${source.type}`,
              target: `rule-${rule.name}`,
              edgeType: 'source-to-rule'
            }
          })
        }
      })

      // Connect rule to its port
      if (rule.port) {
        edges.push({
          data: {
            id: `rule-${rule.name}->port-${rule.port}`,
            source: `rule-${rule.name}`,
            target: `port-${rule.port}`,
            edgeType: 'rule-to-port'
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
        // Source nodes (green rectangles)
        {
          selector: 'node.source',
          style: {
            'shape': 'round-rectangle',
            'width': 100,
            'height': 40,
            'background-color': '#238636',
            'border-width': 2,
            'border-color': '#3fb950',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#ffffff',
            'font-size': '11px',
            'font-family': 'monospace',
            'font-weight': 'bold'
          }
        },
        // Rule nodes (orange diamonds)
        {
          selector: 'node.rule',
          style: {
            'shape': 'diamond',
            'width': 110,
            'height': 70,
            'background-color': '#9a6700',
            'border-width': 2,
            'border-color': '#f0883e',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#ffffff',
            'font-size': '10px',
            'font-family': 'monospace',
            'text-wrap': 'ellipsis',
            'text-max-width': '90px'
          }
        },
        // Port nodes (blue rectangles)
        {
          selector: 'node.port',
          style: {
            'shape': 'round-rectangle',
            'width': 110,
            'height': 50,
            'background-color': '#1f6feb',
            'border-width': 2,
            'border-color': '#58a6ff',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#ffffff',
            'font-size': '10px',
            'font-family': 'monospace',
            'text-wrap': 'wrap',
            'text-max-width': '100px'
          }
        },
        // Inactive ports (no listeners)
        {
          selector: 'node.port.inactive',
          style: {
            'background-color': '#21262d',
            'border-color': '#30363d',
            'color': '#8b949e'
          }
        },
        // Active ports
        {
          selector: 'node.port.active',
          style: {
            'background-color': '#1f6feb',
            'border-color': '#58a6ff'
          }
        },
        // Selected nodes
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#ffffff'
          }
        },
        // Edges from sources to rules
        {
          selector: 'edge[edgeType="source-to-rule"]',
          style: {
            'width': 2,
            'line-color': '#3fb950',
            'target-arrow-color': '#3fb950',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.8,
            'line-style': 'dashed'
          }
        },
        // Edges from rules to ports
        {
          selector: 'edge[edgeType="rule-to-port"]',
          style: {
            'width': 2,
            'line-color': '#f0883e',
            'target-arrow-color': '#f0883e',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.8
          }
        },
        // Highlighted edges
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
        nodeSep: 60,
        rankSep: 180,
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

      // Highlight connected edges
      cy?.edges().removeClass('highlighted')
      node.connectedEdges().addClass('highlighted')

      setSelectedNode({
        id: data.id,
        type: data.type,
        label: data.label,
        data: data.sourceData || data.ruleData || data.portData
      })

      if (data.type === 'source') {
        props.onSourceClick?.(data.sourceData)
      } else if (data.type === 'rule') {
        props.onRuleClick?.(data.ruleData)
      } else if (data.type === 'port') {
        props.onPortClick?.(data.portData)
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
      nodeSep: 60,
      rankSep: 180,
      padding: 50
    } as any).run()

    cy.fit(undefined, 50)
    setZoom(cy.zoom())
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
      nodeSep: 60,
      rankSep: 180,
      padding: 50
    } as any).run()
    cy?.fit(undefined, 50)
    setZoom(cy?.zoom() || 1)
  }

  return (
    <div class="plugboard-graph-container">
      <div class="plugboard-toolbar">
        <div class="toolbar-group">
          <button
            class="toolbar-btn"
            onClick={autoLayout}
            title="Auto Layout"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>

          <button
            class="toolbar-btn"
            onClick={fitView}
            title="Fit View"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/>
            </svg>
          </button>
        </div>

        <div class="toolbar-divider" />

        <div class="toolbar-group zoom-controls">
          <button
            class="toolbar-btn"
            onClick={zoomOut}
            title="Zoom Out"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35M8 11h6"/>
            </svg>
          </button>

          <span class="zoom-level">{Math.round(zoom() * 100)}%</span>

          <button
            class="toolbar-btn"
            onClick={zoomIn}
            title="Zoom In"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div class="plugboard-legend">
        <div class="legend-item">
          <div class="legend-color source" />
          <span>Sources</span>
        </div>
        <div class="legend-item">
          <div class="legend-color rule" />
          <span>Rules</span>
        </div>
        <div class="legend-item">
          <div class="legend-color port" />
          <span>Ports</span>
        </div>
      </div>

      <div ref={containerRef} class="cytoscape-container" />

      {/* Selected node info */}
      <Show when={selectedNode()}>
        <div class="selected-info">
          <div class="info-header">
            <span class={`info-type ${selectedNode()!.type}`}>{selectedNode()!.type}</span>
            <span class="info-label">{selectedNode()!.label.split('\n')[0]}</span>
          </div>
          <pre class="info-data">{JSON.stringify(selectedNode()!.data, null, 2)}</pre>
        </div>
      </Show>

      <style>{`
        .plugboard-graph-container {
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

        .plugboard-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 100;
        }

        .toolbar-group {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .toolbar-divider {
          width: 1px;
          height: 24px;
          background: #30363d;
        }

        .toolbar-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          padding: 0;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #8b949e;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .toolbar-btn:hover {
          background: #30363d;
          color: #c9d1d9;
          border-color: #484f58;
        }

        .zoom-controls {
          min-width: 100px;
          justify-content: center;
        }

        .zoom-level {
          font-size: 11px;
          color: #8b949e;
          min-width: 40px;
          text-align: center;
        }

        .plugboard-legend {
          display: flex;
          gap: 16px;
          padding: 8px 12px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 100;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #8b949e;
        }

        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }

        .legend-color.source {
          background: #238636;
          border: 1px solid #3fb950;
        }

        .legend-color.rule {
          background: #9a6700;
          border: 1px solid #f0883e;
        }

        .legend-color.port {
          background: #1f6feb;
          border: 1px solid #58a6ff;
        }

        .selected-info {
          position: absolute;
          bottom: 12px;
          right: 12px;
          max-width: 300px;
          padding: 12px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          z-index: 100;
        }

        .info-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .info-type {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .info-type.source {
          background: #238636;
          color: white;
        }

        .info-type.rule {
          background: #9a6700;
          color: white;
        }

        .info-type.port {
          background: #1f6feb;
          color: white;
        }

        .info-label {
          font-size: 13px;
          font-weight: 500;
          color: #c9d1d9;
          font-family: monospace;
        }

        .info-data {
          margin: 0;
          padding: 8px;
          background: #0d1117;
          border-radius: 4px;
          font-size: 11px;
          color: #8b949e;
          overflow: auto;
          max-height: 150px;
        }
      `}</style>
    </div>
  )
}
