import { createMemo, Show } from 'solid-js'
import { CytoscapeGraph } from '../graph'

interface GraphViewProps {
  data: any
  valType: 'propagator' | 'recipe' | 'handler' | 'cell'
}

/**
 * GraphView - Flow diagram visualization
 */
export default function GraphView(props: GraphViewProps) {
  // For recipes, build a map of resource IDs to URIs for resolving ${ref.X} templates
  const refMap = createMemo(() => {
    const data = props.data
    if (!data || props.valType !== 'recipe' || !data.resources) return {}

    const map: Record<string, string> = {}
    data.resources.forEach((r: any) => {
      if (r.id) {
        map[r.id] = r.uri
      }
    })
    return map
  })

  // Resolve ${ref.X} references to actual URIs
  function resolveRef(value: string): string {
    if (!value) return value
    const match = value.match(/^\$\{ref\.(\w+)\}$/)
    if (match) {
      const id = match[1]
      return refMap()[id] || value
    }
    return value
  }

  // Extract cells and propagators from the data
  const cells = createMemo(() => {
    const data = props.data
    if (!data) return []

    // For recipes, extract from resources
    if (props.valType === 'recipe' && data.resources) {
      return data.resources
        .filter((r: any) => r.body?.lattice)
        .map((r: any) => ({
          uri: r.uri,
          lattice: r.body?.lattice,
          value: undefined
        }))
    }

    // For propagators, extract input/output cells
    if (props.valType === 'propagator') {
      const inputs = data.inputs || []
      const output = data.output
      const all = [...inputs, output].filter(Boolean)

      return all.map((uri: string) => ({
        uri,
        lattice: 'lww',
        value: undefined
      }))
    }

    // For cells, just show the cell itself
    if (props.valType === 'cell') {
      return [{
        uri: data.uri || 'bl:///cells/current',
        lattice: data.lattice || 'lww',
        value: data.value
      }]
    }

    return []
  })

  const propagators = createMemo(() => {
    const data = props.data
    if (!data) return []

    // For recipes, extract propagators from resources
    if (props.valType === 'recipe' && data.resources) {
      return data.resources
        .filter((r: any) => r.body?.inputs && r.body?.output)
        .map((r: any) => ({
          uri: r.uri,
          // Resolve ${ref.X} references to actual URIs
          inputs: (r.body.inputs || []).map((input: string) => resolveRef(input)),
          output: resolveRef(r.body.output),
          handler: r.body.handler
        }))
    }

    // For propagators, use the propagator itself
    if (props.valType === 'propagator') {
      return [{
        uri: 'bl:///propagators/current',
        inputs: data.inputs || [],
        output: data.output,
        handler: data.handler
      }]
    }

    return []
  })

  // Check if we have something to show
  const hasGraph = createMemo(() => cells().length > 0 || propagators().length > 0)

  return (
    <div class="graph-view">
      <Show when={hasGraph()} fallback={
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <circle cx="5" cy="12" r="3"/>
            <circle cx="19" cy="12" r="3"/>
            <circle cx="12" cy="5" r="3"/>
            <circle cx="12" cy="19" r="3"/>
            <path d="M8 12h8M12 8v8"/>
          </svg>
          <h3>No graph to display</h3>
          <p>This val type doesn't have a flow diagram.</p>
        </div>
      }>
        <CytoscapeGraph
          cells={cells()}
          propagators={propagators()}
        />
      </Show>

      <style>{`
        .graph-view {
          min-height: 500px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 60px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          color: #6e7681;
          text-align: center;
        }

        .empty-state h3 {
          margin: 0;
          font-size: 16px;
          color: #8b949e;
        }

        .empty-state p {
          margin: 0;
          font-size: 13px;
        }
      `}</style>
    </div>
  )
}
