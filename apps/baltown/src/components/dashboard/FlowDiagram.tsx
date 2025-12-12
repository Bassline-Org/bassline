import { createMemo, For, Show } from 'solid-js'

interface FlowNode {
  id: string
  type: 'cell' | 'propagator'
  label: string
  uri: string
  value?: any
  lattice?: string
  handler?: string
}

interface FlowEdge {
  from: string
  to: string
  label?: string
}

interface FlowDiagramProps {
  cells: Array<{ uri: string; value?: any; lattice?: string }>
  propagators: Array<{
    uri: string
    inputs: string[]
    output: string
    handler?: string | any[]
  }>
  compact?: boolean
  onNodeClick?: (node: FlowNode) => void
}

/**
 * FlowDiagram - Visual data flow between cells and propagators
 *
 * Simple ASCII-inspired flow visualization.
 */
export default function FlowDiagram(props: FlowDiagramProps) {
  // Build node list
  const nodes = createMemo(() => {
    const result: FlowNode[] = []

    // Add cells
    props.cells.forEach((cell) => {
      result.push({
        id: cell.uri,
        type: 'cell',
        label: cell.uri.split('/').pop() || 'cell',
        uri: cell.uri,
        value: cell.value,
        lattice: cell.lattice,
      })
    })

    // Add propagators
    props.propagators.forEach((prop) => {
      const handler = Array.isArray(prop.handler) ? prop.handler[0] : prop.handler
      result.push({
        id: prop.uri,
        type: 'propagator',
        label: prop.uri.split('/').pop() || 'prop',
        uri: prop.uri,
        handler: handler || 'custom',
      })
    })

    return result
  })

  // Build edge list
  const edges = createMemo(() => {
    const result: FlowEdge[] = []

    props.propagators.forEach((prop) => {
      // Input edges
      prop.inputs.forEach((input) => {
        result.push({
          from: input,
          to: prop.uri,
          label: 'in',
        })
      })

      // Output edge
      if (prop.output) {
        result.push({
          from: prop.uri,
          to: prop.output,
          label: 'out',
        })
      }
    })

    return result
  })

  // Group nodes by level (cells that are inputs, propagators, output cells)
  const layout = createMemo(() => {
    const inputCells = new Set<string>()
    const outputCells = new Set<string>()

    props.propagators.forEach((prop) => {
      prop.inputs.forEach((i) => inputCells.add(i))
      if (prop.output) outputCells.add(prop.output)
    })

    // Remove cells that are both input and output
    const pureInputs = [...inputCells].filter((c) => !outputCells.has(c))
    const pureOutputs = [...outputCells].filter((c) => !inputCells.has(c))
    const mixed = [...inputCells].filter((c) => outputCells.has(c))

    return {
      inputCells: pureInputs,
      propagators: props.propagators.map((p) => p.uri),
      mixedCells: mixed,
      outputCells: pureOutputs,
    }
  })

  // Get node by id
  function getNode(id: string): FlowNode | undefined {
    return nodes().find((n) => n.id === id)
  }

  // Format value for display
  function formatValue(value: any): string {
    if (value === undefined || value === null) return '—'
    if (typeof value === 'object') {
      if ('value' in value) return formatValue(value.value)
      return JSON.stringify(value).slice(0, 20)
    }
    return String(value).slice(0, 15)
  }

  return (
    <div class={`flow-diagram ${props.compact ? 'compact' : ''}`}>
      <div class="flow-container">
        {/* Input Cells Column */}
        <div class="flow-column inputs">
          <div class="column-label">Inputs</div>
          <For each={layout().inputCells}>
            {(uri) => {
              const node = getNode(uri)
              return (
                <Show when={node}>
                  <div class="flow-node cell" onClick={() => props.onNodeClick?.(node!)}>
                    <div class="node-icon cell-icon">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                      </svg>
                    </div>
                    <div class="node-content">
                      <span class="node-label">{node!.label}</span>
                      <span class="node-value">{formatValue(node!.value)}</span>
                    </div>
                    <Show when={node!.lattice}>
                      <span class="lattice-badge">{node!.lattice}</span>
                    </Show>
                  </div>
                </Show>
              )
            }}
          </For>
        </div>

        {/* Arrows */}
        <div class="flow-arrows left-arrows">
          <For each={layout().inputCells}>{() => <div class="arrow-line">→</div>}</For>
        </div>

        {/* Propagators Column */}
        <div class="flow-column propagators">
          <div class="column-label">Propagators</div>
          <For each={layout().propagators}>
            {(uri) => {
              const node = getNode(uri)
              return (
                <Show when={node}>
                  <div class="flow-node propagator" onClick={() => props.onNodeClick?.(node!)}>
                    <div class="node-icon prop-icon">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M4 12h4l3-9 6 18 3-9h4" />
                      </svg>
                    </div>
                    <div class="node-content">
                      <span class="node-label">{node!.label}</span>
                      <span class="node-handler">{node!.handler}</span>
                    </div>
                  </div>
                </Show>
              )
            }}
          </For>
        </div>

        {/* Arrows */}
        <div class="flow-arrows right-arrows">
          <For each={layout().propagators}>{() => <div class="arrow-line">→</div>}</For>
        </div>

        {/* Output Cells Column */}
        <div class="flow-column outputs">
          <div class="column-label">Outputs</div>
          <For each={layout().outputCells}>
            {(uri) => {
              const node = getNode(uri)
              return (
                <Show when={node}>
                  <div class="flow-node cell output" onClick={() => props.onNodeClick?.(node!)}>
                    <div class="node-icon cell-icon">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                        <path d="M9 12l2 2 4-4" />
                      </svg>
                    </div>
                    <div class="node-content">
                      <span class="node-label">{node!.label}</span>
                      <span class="node-value">{formatValue(node!.value)}</span>
                    </div>
                    <Show when={node!.lattice}>
                      <span class="lattice-badge">{node!.lattice}</span>
                    </Show>
                  </div>
                </Show>
              )
            }}
          </For>

          {/* Mixed cells (both input and output) */}
          <For each={layout().mixedCells}>
            {(uri) => {
              const node = getNode(uri)
              return (
                <Show when={node}>
                  <div class="flow-node cell mixed" onClick={() => props.onNodeClick?.(node!)}>
                    <div class="node-icon cell-icon">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                        <path d="M8 12h8M12 8v8" />
                      </svg>
                    </div>
                    <div class="node-content">
                      <span class="node-label">{node!.label}</span>
                      <span class="node-value">{formatValue(node!.value)}</span>
                    </div>
                    <span class="mixed-badge">I/O</span>
                  </div>
                </Show>
              )
            }}
          </For>
        </div>
      </div>

      <Show when={nodes().length === 0}>
        <div class="empty-state">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
          >
            <path d="M4 12h4l3-9 6 18 3-9h4" />
          </svg>
          <p>No data flow to display</p>
        </div>
      </Show>

      <style>{`
        .flow-diagram {
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 16px;
          overflow-x: auto;
        }

        .flow-diagram.compact {
          padding: 12px;
        }

        .flow-container {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          min-height: 100px;
        }

        .flow-column {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 120px;
        }

        .column-label {
          font-size: 10px;
          color: #6e7681;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 4px 8px;
          text-align: center;
        }

        .flow-arrows {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 8px;
          padding-top: 28px;
          color: #30363d;
          font-size: 20px;
        }

        .arrow-line {
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .flow-node {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .flow-node:hover {
          border-color: #58a6ff;
          transform: translateY(-1px);
        }

        .flow-node.propagator {
          background: #21262d;
          border-style: dashed;
        }

        .flow-node.output {
          border-color: #3fb950;
        }

        .flow-node.mixed {
          border-color: #a371f7;
        }

        .node-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #21262d;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .cell-icon {
          color: #58a6ff;
        }

        .prop-icon {
          color: #f0883e;
        }

        .output .cell-icon {
          color: #3fb950;
        }

        .node-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .node-label {
          font-weight: 500;
          font-size: 12px;
          color: #c9d1d9;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .node-value {
          font-family: monospace;
          font-size: 11px;
          color: #3fb950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .node-handler {
          font-family: monospace;
          font-size: 10px;
          color: #8b949e;
        }

        .lattice-badge, .mixed-badge {
          font-size: 9px;
          padding: 2px 5px;
          background: #388bfd22;
          color: #58a6ff;
          border-radius: 8px;
          font-weight: 500;
          flex-shrink: 0;
        }

        .mixed-badge {
          background: #a371f722;
          color: #a371f7;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px;
          color: #6e7681;
        }

        .empty-state p {
          margin: 0;
          font-size: 13px;
        }
      `}</style>
    </div>
  )
}
