# Baltown Custom UI/Interactions Plan

## Executive Summary

This plan transforms baltown from a JSON-centric developer tool into a user-friendly resource composition platform. Based on research of Val.town, Retool, Node-RED, Observable, Notion, and Airtable, we've identified key patterns to eliminate raw JSON display and create type-aware, interactive UIs.

---

## Core Problem

Currently, most interactions in baltown show raw JSON:

- Propagator definitions: JSON with inputs/output/handler
- Cell definitions: JSON with lattice/initial
- Recipe instances: JSON parameter input
- Live values: JSON.stringify for objects

This creates friction for users who think in terms of **data flow** and **visual composition**, not configuration objects.

---

## Design Principles

1. **Type-Aware Rendering** - Different UI for different resource types
2. **Progressive Disclosure** - Simple by default, powerful when needed
3. **Visual Composition** - See data flow, not JSON
4. **Reactive Feedback** - Real-time updates show system dynamics
5. **Multi-View System** - Same data, different presentations

---

## Implementation Phases

### Phase 1: Lattice-Aware Cell Controls (High Impact, Medium Effort)

Replace generic JSON display with lattice-specific widgets:

| Lattice     | Widget           | Features                                |
| ----------- | ---------------- | --------------------------------------- |
| `counter`   | Counter buttons  | +1, +5, +10 buttons, sparkline history  |
| `maxNumber` | Gauge/slider     | Visual range, threshold markers         |
| `minNumber` | Inverted gauge   | Floor tracking                          |
| `setUnion`  | Tag chips        | Add/remove tags, animated entry         |
| `lww`       | Editable field   | Timestamp display, edit history         |
| `boolean`   | Toggle switch    | Locked when true, celebration animation |
| `object`    | Key-value editor | Property grid, diff view                |

**Components to Create:**

```
src/components/cells/
├── CounterControl.tsx      # +/- buttons, sparkline
├── GaugeDisplay.tsx        # For max/min numbers
├── TagChips.tsx            # For setUnion
├── EditableField.tsx       # For LWW
├── ToggleSwitch.tsx        # For boolean
├── PropertyGrid.tsx        # For object
└── LatticeVisualizer.tsx   # Dispatcher component
```

**Key Features:**

- Smooth animations on value change (fade-in, slide-up, pulse)
- History sparklines showing last 20 values
- Hover tooltips with metadata (last change, lattice type)

---

### Phase 2: Handler Config UIs (High Impact, Medium Effort)

Replace JSON textarea with type-aware config editors:

| Handler Category                  | Config Type            | UI Pattern                  |
| --------------------------------- | ---------------------- | --------------------------- |
| Numeric (`multiply`, `add`)       | `{ value: number }`    | Slider + number input       |
| Comparison (`gt`, `lt`, `eq`)     | `{ value: any }`       | Type-aware comparison input |
| Key selectors (`groupBy`, `pick`) | `{ key: string }`      | Autocomplete dropdown       |
| Nested handlers (`filter`, `map`) | `{ handler, config }`  | Recursive handler picker    |
| Conditional (`ifElse`, `cond`)    | branches               | Flowchart diagram           |
| Composition (`pipe`, `fork`)      | handlers array         | Drag-and-drop sequence      |
| Template (`format`)               | `{ template: string }` | Template editor with hints  |
| Regex (`replace`, `match`)        | `{ pattern, flags }`   | Regex builder with test     |

**Components to Create:**

```
src/components/handlers/
├── NumericConfigEditor.tsx     # Slider/spinner for numbers
├── KeySelector.tsx             # Autocomplete for keys
├── NestedHandlerEditor.tsx     # Recursive handler picker
├── ConditionalEditor.tsx       # Branch visualization
├── CompositionEditor.tsx       # Drag-drop handler sequence
├── TemplateEditor.tsx          # Format string with hints
├── RegexEditor.tsx             # Pattern builder with test
└── ConfigDispatcher.tsx        # Routes to appropriate editor
```

**Metadata Enhancement:**

```typescript
const HANDLER_METADATA = {
  multiply: {
    description: 'Multiply input by value',
    config: { value: 'number' },
    uiType: 'numeric',
    uiOptions: { min: -1000, max: 1000, step: 0.1 },
  },
  groupBy: {
    description: 'Group array by key',
    config: { key: 'string' },
    uiType: 'keySelector',
    uiOptions: { mode: 'single' },
  },
  // ... for all 110 handlers
}
```

---

### Phase 3: Recipe Instance Dashboards (High Impact, High Effort)

Transform recipe instances from JSON to interactive dashboards:

**Dashboard Layout:**

```
┌─────────────────────────────────────────────────────┐
│ Recipe Instance: my-counter                         │
│ Status: Active | Created 2 hours ago                │
├──────────────┬──────────────────────────────────────┤
│ Input Panel  │     Data Flow Visualization          │
│              │                                       │
│ [count]      │  [count] ──sum──> [total]            │
│  +1 +5 +10   │    ↓                                  │
│              │  [doubled]                            │
│ [threshold]  │                                       │
│  slider      │                                       │
├──────────────┼──────────────────────────────────────┤
│ Outputs      │ Propagator Status                    │
│              │                                       │
│ [total]: 42  │ sum-handler    ✓ healthy             │
│ [doubled]: 84│ doubler        ✓ healthy             │
└──────────────┴──────────────────────────────────────┘
```

**Components to Create:**

```
src/components/dashboard/
├── InstanceDashboard.tsx      # Main dashboard container
├── InputPanel.tsx             # Lattice-aware input controls
├── FlowDiagram.tsx            # Data flow visualization
├── PropagatorStatus.tsx       # Health/fire status
├── ValueTimeline.tsx          # History with sparklines
├── CellCard.tsx               # Individual cell display
└── MetricsSummary.tsx         # Instance statistics
```

**Features:**

- Live WebSocket updates to all cells
- Propagator execution animations
- Input widgets matched to cell lattice types
- Export instance state as JSON/CSV

---

### Phase 4: Propagator Flow Visualization (High Impact, High Effort)

Visual node-graph editor for propagator networks:

**Technology Choice:** Rete.js with Solid.js plugin (or custom SVG)

**Visual Representation:**

```
[Cell: a] ──┐
            ├──> [Prop: sum] ──> [Cell: result]
[Cell: b] ──┘
```

**Node Types:**

- **Cell nodes**: Rounded rectangle, color by lattice, show live value
- **Propagator nodes**: Diamond/pill shape, show handler name
- **Edges**: Animated flow direction, highlight on fire

**Components to Create:**

```
src/components/graph/
├── PropagatorGraph.tsx        # Main canvas component
├── CellNode.tsx               # Cell display node
├── PropagatorNode.tsx         # Handler node
├── ConnectionEdge.tsx         # Animated edge
├── MiniMap.tsx                # Navigation overview
├── GraphToolbar.tsx           # Add/delete/layout controls
└── InspectorPanel.tsx         # Node detail editing
```

**Interactions:**

- Pan/zoom with mouse
- Click node to edit
- Drag to create connections
- Auto-layout (hierarchical/Dagre)
- Real-time value updates on nodes

---

### Phase 5: Multi-View System (Medium Impact, Medium Effort)

Like Notion, offer multiple views of the same val:

**Routes:**

```
/v/:owner/:name              # Default view (pretty-printed)
/v/:owner/:name/source       # Raw JSON source
/v/:owner/:name/graph        # Flow diagram (propagators/recipes)
/v/:owner/:name/instances    # Instance list (recipes)
/v/:owner/:name/usage        # Backlinks (what uses this)
```

**View Tabs Component:**

```tsx
<ViewTabs>
  <ViewTab name="Overview" icon="📋" />
  <ViewTab name="Source" icon="{ }" />
  <ViewTab name="Graph" icon="🔗" />
  <ViewTab name="Usage" icon="↩️" />
</ViewTabs>
```

---

### Phase 6: Template Gallery (Medium Impact, Low Effort)

Pre-built templates for common patterns:

**Propagator Templates:**

- Math Reducer (sum, average, product)
- Data Filter (keep values > X)
- Format Transform (template strings)
- Conditional Logic (if-then-else)

**Recipe Templates:**

- Monitoring Dashboard
- Data Pipeline (fetch → transform → store)
- State Machine
- Configuration Registry

**Cell Templates:**

- Click Counter
- Status Toggle
- Tag Collection
- Config Object

**UI:**

```
Create Val → Select Type → Choose Template (optional)
                              ↓
                         [Template Gallery]
                         - Popular templates
                         - By category
                         - Search
```

---

## Component Architecture

### Type Registry Pattern

```typescript
// src/lib/renderers.ts
const typeRenderers = {
  'bl:///types/cell': CellRenderer,
  'bl:///types/propagator': PropagatorRenderer,
  'bl:///types/recipe': RecipeRenderer,
  'bl:///types/handler': HandlerRenderer,
  default: JSONRenderer,
}

export function getRenderer(typeUri: string) {
  return typeRenderers[typeUri] || typeRenderers['default']
}
```

### Reactive Value Hook

```typescript
// Enhanced useLiveResource with history
export function useLiveResourceWithHistory(uri: string, historySize = 20) {
  const { data, loading, error, isLive } = useLiveResource(uri)
  const [history, setHistory] = createSignal<any[]>([])

  createEffect(() => {
    const value = data()
    if (value !== undefined) {
      setHistory((prev) => [...prev.slice(-historySize + 1), value])
    }
  })

  return { data, loading, error, isLive, history }
}
```

### Animation System

```typescript
// src/lib/animations.ts
export const valueChangeAnimation = {
  fadeIn: 'animate-fade-in 300ms ease-out',
  slideUp: 'animate-slide-up 200ms ease-out',
  pulse: 'animate-pulse 500ms ease-in-out',
  highlight: 'animate-highlight 1s ease-out',
}

export function animateValueChange(element: HTMLElement, type: keyof typeof valueChangeAnimation) {
  element.style.animation = valueChangeAnimation[type]
  element.addEventListener(
    'animationend',
    () => {
      element.style.animation = ''
    },
    { once: true }
  )
}
```

---

## File Structure

```
apps/baltown/src/
├── components/
│   ├── cells/                    # Phase 1: Lattice-aware controls
│   │   ├── CounterControl.tsx
│   │   ├── GaugeDisplay.tsx
│   │   ├── TagChips.tsx
│   │   ├── EditableField.tsx
│   │   ├── ToggleSwitch.tsx
│   │   ├── PropertyGrid.tsx
│   │   └── LatticeVisualizer.tsx
│   │
│   ├── handlers/                 # Phase 2: Config editors
│   │   ├── NumericConfigEditor.tsx
│   │   ├── KeySelector.tsx
│   │   ├── NestedHandlerEditor.tsx
│   │   ├── ConditionalEditor.tsx
│   │   ├── CompositionEditor.tsx
│   │   ├── TemplateEditor.tsx
│   │   ├── RegexEditor.tsx
│   │   └── ConfigDispatcher.tsx
│   │
│   ├── dashboard/                # Phase 3: Instance dashboards
│   │   ├── InstanceDashboard.tsx
│   │   ├── InputPanel.tsx
│   │   ├── FlowDiagram.tsx
│   │   ├── PropagatorStatus.tsx
│   │   ├── ValueTimeline.tsx
│   │   └── MetricsSummary.tsx
│   │
│   ├── graph/                    # Phase 4: Flow visualization
│   │   ├── PropagatorGraph.tsx
│   │   ├── CellNode.tsx
│   │   ├── PropagatorNode.tsx
│   │   ├── ConnectionEdge.tsx
│   │   └── GraphToolbar.tsx
│   │
│   └── views/                    # Phase 5: Multi-view system
│       ├── ViewTabs.tsx
│       ├── SourceView.tsx
│       ├── GraphView.tsx
│       └── UsageView.tsx
│
├── lib/
│   ├── renderers.ts              # Type → component registry
│   ├── animations.ts             # Value change animations
│   ├── handlerMetadata.ts        # Handler UI metadata
│   └── hooks.ts                  # Enhanced reactive hooks
│
└── pages/
    ├── templates/                # Phase 6: Template gallery
    │   ├── TemplateGallery.tsx
    │   └── TemplateCard.tsx
    └── InstanceView.tsx          # Recipe instance dashboard
```

---

## Priority Matrix

| Phase                  | Impact | Effort | Priority |
| ---------------------- | ------ | ------ | -------- |
| 1. Lattice-aware cells | High   | Medium | **P0**   |
| 2. Handler config UIs  | High   | Medium | **P0**   |
| 3. Instance dashboards | High   | High   | **P1**   |
| 4. Flow visualization  | High   | High   | **P1**   |
| 5. Multi-view system   | Medium | Medium | **P2**   |
| 6. Template gallery    | Medium | Low    | **P2**   |

---

## Success Metrics

1. **JSON Reduction**: < 20% of views show raw JSON (currently ~80%)
2. **Time to Create**: 50% reduction in time to create a propagator
3. **Error Reduction**: 75% fewer JSON syntax errors in val creation
4. **Discoverability**: Users can find handlers without documentation
5. **Real-time Feedback**: All value changes visible within 100ms

---

## Research Sources

- Agent 1: Val types and structures analysis
- Agent 2: Lattice-specific visualization patterns
- Agent 3: Handler config UI patterns (110 handlers)
- Agent 4: Recipe instance dashboard design
- Agent 5: Propagator flow visualization (Rete.js, D3, Cytoscape)
- Agent 6: Platform comparison (Val.town, Retool, Node-RED, Observable, Notion, Airtable)

---

## Next Steps

1. **Immediate**: Start Phase 1 with `LatticeVisualizer.tsx` dispatcher
2. **This week**: Build `CounterControl` and `GaugeDisplay` components
3. **Next sprint**: Complete Phase 1-2, begin Phase 3 dashboard layout
4. **Future**: Evaluate Rete.js for Phase 4 graph visualization
