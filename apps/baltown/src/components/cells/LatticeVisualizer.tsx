import { Show, Switch, Match, createMemo } from 'solid-js'
import { useLiveResource } from '@bassline/solid'
import CounterControl from './CounterControl'
import GaugeDisplay from './GaugeDisplay'
import TagChips from './TagChips'
import EditableField from './EditableField'
import ToggleSwitch from './ToggleSwitch'
import PropertyGrid from './PropertyGrid'

interface LatticeVisualizerProps {
  uri: string
  label?: string
  compact?: boolean
  showControls?: boolean
}

/**
 * LatticeVisualizer - Smart dispatcher for lattice-specific cell controls
 *
 * Automatically detects cell lattice type and renders appropriate UI.
 */
export default function LatticeVisualizer(props: LatticeVisualizerProps) {
  // Fetch cell metadata and value
  const { data: cellData, loading, error, isLive } = useLiveResource(() => props.uri)

  // Extract lattice type from cell data
  const latticeType = createMemo(() => {
    const data = cellData()
    if (!data) return null

    // Try different locations for lattice info
    if (data.lattice) return data.lattice
    if (data.body?.lattice) return data.body.lattice
    if (data.headers?.lattice) return data.headers.lattice

    // Default to lww if we have a value but no lattice info
    return 'lww'
  })

  // Extract current value
  const value = createMemo(() => {
    const data = cellData()
    if (!data) return undefined

    // Handle different value structures
    // Prioritize explicit value properties
    if (data.value !== undefined) return data.value
    if (data.body?.value !== undefined) return data.body.value

    // Don't fall back to body if it contains lattice metadata
    // (that would insert an object into the DOM)
    if (data.body !== undefined && typeof data.body !== 'object') {
      return data.body
    }

    // For object bodies, only return if they don't look like cell metadata
    if (data.body && typeof data.body === 'object' && !('lattice' in data.body)) {
      return data.body
    }

    return undefined
  })

  // Extract timestamp for LWW
  const timestamp = createMemo(() => {
    const data = cellData()
    if (!data) return undefined

    const val = data.value ?? data.body?.value ?? data.body
    if (val && typeof val === 'object' && 'timestamp' in val) {
      return val.timestamp
    }
    return undefined
  })

  // Unwrap LWW value
  const unwrappedValue = createMemo(() => {
    const val = value()
    if (val && typeof val === 'object' && 'value' in val) {
      return val.value
    }
    return val
  })

  return (
    <div class="lattice-visualizer">
      <Show when={loading()}>
        <div class="lattice-loading">Loading...</div>
      </Show>

      <Show when={error()}>
        <div class="lattice-error">
          Error: {error()?.message || 'Failed to load cell'}
        </div>
      </Show>

      <Show when={!loading() && !error() && cellData()}>
        <Show when={isLive()}>
          <div class="lattice-live-badge">LIVE</div>
        </Show>

        <Switch fallback={
          <EditableField
            uri={props.uri}
            value={value()}
            label={props.label}
            timestamp={timestamp()}
          />
        }>
          <Match when={latticeType() === 'counter'}>
            <CounterControl
              uri={props.uri}
              value={unwrappedValue() ?? 0}
              label={props.label}
              compact={props.compact}
            />
          </Match>

          <Match when={latticeType() === 'maxNumber'}>
            <GaugeDisplay
              uri={props.uri}
              value={unwrappedValue() ?? 0}
              label={props.label}
              latticeType="maxNumber"
              showInput={props.showControls}
            />
          </Match>

          <Match when={latticeType() === 'minNumber'}>
            <GaugeDisplay
              uri={props.uri}
              value={unwrappedValue() ?? 0}
              label={props.label}
              latticeType="minNumber"
              showInput={props.showControls}
            />
          </Match>

          <Match when={latticeType() === 'setUnion'}>
            <TagChips
              uri={props.uri}
              value={unwrappedValue() ?? []}
              label={props.label}
              allowAdd={props.showControls}
            />
          </Match>

          <Match when={latticeType() === 'boolean'}>
            <ToggleSwitch
              uri={props.uri}
              value={unwrappedValue() ?? false}
              label={props.label}
            />
          </Match>

          <Match when={latticeType() === 'object' && typeof unwrappedValue() === 'object' && !Array.isArray(unwrappedValue())}>
            <PropertyGrid
              uri={props.uri}
              value={unwrappedValue() ?? {}}
              label={props.label}
              editable={props.showControls}
            />
          </Match>

          <Match when={latticeType() === 'lww'}>
            <EditableField
              uri={props.uri}
              value={value()}
              label={props.label}
              timestamp={timestamp()}
            />
          </Match>
        </Switch>
      </Show>

      <style>{`
        .lattice-visualizer {
          position: relative;
        }

        .lattice-loading {
          padding: 20px;
          text-align: center;
          color: #8b949e;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
        }

        .lattice-error {
          padding: 20px;
          color: #f85149;
          background: #f8514922;
          border: 1px solid #f85149;
          border-radius: 8px;
        }

        .lattice-live-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          font-size: 10px;
          padding: 2px 6px;
          background: #238636;
          color: white;
          border-radius: 10px;
          font-weight: 600;
          animation: pulse 2s infinite;
          z-index: 10;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}

// Export individual components for direct use
export { CounterControl, GaugeDisplay, TagChips, EditableField, ToggleSwitch, PropertyGrid }
