# Graph Handlers Plan for Bassline Workbench

Handler nodes as first-class citizens in the graph canvas, allowing users to visually compose handler pipelines and connect them to cells through edge-drawing.

## 1. Handler Node Visual Design

### Shape and Color

Handler nodes should be visually distinct from both cells and propagators:

| Node Type   | Shape           | Background  | Border               | Text Color  |
| ----------- | --------------- | ----------- | -------------------- | ----------- |
| Cell        | round-rectangle | #21262d     | #30363d              | #c9d1d9     |
| Propagator  | diamond         | #161b22     | #58a6ff (blue)       | #58a6ff     |
| **Handler** | **hexagon**     | **#161b22** | **#f0883e (orange)** | **#f0883e** |

The hexagon shape is ideal because:

- Distinct from cells (rectangles) and propagators (diamonds)
- Evokes "processing" or "transformation" conceptually
- Has enough surface area for labels and inline editing
- Cytoscape.js supports hexagon as a built-in shape

### Handler Node States

- **Incomplete** (orange border, dashed): No connections yet
- **Partial** (orange border, solid): Has inputs OR output, but not both
- **Ready** (green border, solid): Has both inputs and output - can be promoted
- **Editing** (yellow glow): Currently being configured inline

### Node Size

- Width: 140px (slightly wider than cells to accommodate inline UI)
- Height: 80px (taller to show handler name + config summary)

---

## 2. Creating Handler Nodes

### Method 1: Double-click on Canvas (Primary)

Double-clicking on empty canvas space opens a quick handler creation:

1. A handler node appears at cursor position
2. Node starts in "editing" mode with HandlerPicker dropdown open
3. User selects handler from categorized list
4. Node displays handler name, ready for configuration

### Method 2: Toolbar Button (Alternative)

The existing GraphToolbar already has "Cell" and "Propagator" buttons. Add a "Handler" button:

- Click opens AddHandlerModal (similar to AddCellModal)
- Created handler appears at center of canvas

### Method 3: Drag from Palette (Future Enhancement)

A handler palette panel (collapsed by default) lists all 110 handlers organized by category. Users can drag handlers directly onto the canvas.

**Recommendation**: Start with Method 1 (double-click) and Method 2 (toolbar) for MVP.

---

## 3. Inline Handler Configuration

When a handler node is selected or double-clicked, inline editing appears. This differs from the sidebar approach:

### Inline Editing Implementation

Use a positioned HTML overlay (not Cytoscape.js native) that:

1. Gets the node's rendered position via `node.renderedPosition()`
2. Renders a floating panel attached to the node
3. Contains the ConfigDispatcher component for the handler's UI type
4. Auto-dismisses when clicking elsewhere

### UI Components to Reuse

- **HandlerPicker** - For changing the handler type
- **ConfigDispatcher** - Routes to appropriate config editor:
  - NumericConfigEditor for arithmetic handlers
  - KeySelector for object/array handlers
  - TemplateEditor for format/split handlers
  - NestedHandlerEditor for map/filter (recursive)

### Inline Editor Layout

```
+------------------------------------------+
| [sum v]  (dropdown to change handler)    |
|------------------------------------------|
| Config:                                  |
| [ConfigDispatcher component here]        |
|------------------------------------------|
| [Done]                                   |
+------------------------------------------+
```

For handlers without config (like `sum`, `identity`), show:

```
+------------------------------------------+
| [sum v]                                  |
|------------------------------------------|
| [check] No configuration needed          |
+------------------------------------------+
```

---

## 4. Connecting Handlers to Cells (Edge Drawing)

### Installing cytoscape-edgehandles

```bash
npm install cytoscape-edgehandles
```

### Edge Drawing Behavior

1. **Starting an edge**: Click and drag from a cell node (or handler output port)
2. **Valid targets**:
   - Cell -> Handler input (creates input connection)
   - Handler output -> Cell (creates output connection)
3. **Invalid targets**: Cell -> Cell, Handler -> Handler (show red indicator)

### Connection Ports

Add visual "ports" to handler nodes:

- **Input port(s)** on left side (small circles)
- **Output port** on right side (single circle)

For handlers accepting multiple inputs (like `sum`), show multiple input ports that can be expanded.

### Edge Validation Rules

```typescript
canConnect(source: NodeData, target: NodeData): boolean {
  // Cell -> Handler input: allowed
  if (source.type === 'cell' && target.type === 'handler') return true
  // Handler -> Cell output: allowed
  if (source.type === 'handler' && target.type === 'cell') return true
  // Handler -> Handler: allowed (for composition)
  if (source.type === 'handler' && target.type === 'handler') return true
  return false
}
```

---

## 5. Promotion Flow: Handler to Propagator

### When Does Promotion Happen?

A handler becomes promotable when it has:

1. At least one input cell connected
2. Exactly one output cell connected

### Promotion Options

**Option A: Automatic (Recommended)**
When connections complete, handler automatically becomes a propagator:

1. System creates propagator resource via `bl.put('bl:///r/propagators/...')`
2. Node visual changes from hexagon to diamond
3. Node type in data changes from 'handler' to 'propagator'
4. Original handler node is removed, replaced by propagator

**Option B: Manual Confirmation**
When connections complete:

1. Handler node shows "Ready" state (green border)
2. User clicks "Promote" button on node or in inspector
3. Promotion dialog asks for propagator name
4. Propagator is created

**Recommendation**: Use Option B initially for clarity, with a keyboard shortcut (Enter) for quick promotion.

### Promotion Data Flow

```typescript
async function promoteHandler(handlerNode: HandlerNodeData): Promise<void> {
  const name = await promptForName() // or auto-generate

  await bl.put(
    `bl:///r/propagators/${name}`,
    {},
    {
      inputs: handlerNode.inputConnections.map((c) => c.cellUri),
      output: handlerNode.outputConnection.cellUri,
      handler: handlerNode.handlerName,
      handlerConfig: handlerNode.config,
    }
  )

  // Remove handler node, graph will refresh to show new propagator
  refresh()
}
```

---

## 6. Data Structure Changes

### New Node Type in Graph Data

```typescript
interface HandlerNodeData {
  id: string
  type: 'handler'
  uri: string // e.g., 'handler:sum-001' (temporary until promoted)
  label: string // handler name
  handler: string // handler name
  config: Record<string, any> // handler config
  inputConnections: string[] // URIs of connected input cells
  outputConnection: string | null // URI of connected output cell
}
```

### Selection Store Extension

Update `SelectionType` to include handler properly (already exists):

```typescript
export type SelectionType = 'cell' | 'propagator' | 'handler' | 'recipe' | 'none'
```

### Graph State

Add handlers array to CytoscapeGraph props:

```typescript
interface CytoscapeGraphProps {
  cells: Array<CellData>
  propagators: Array<PropagatorData>
  handlers: Array<HandlerNodeData> // NEW
  // ... existing props
}
```

---

## 7. Step-by-Step Implementation Plan

### Phase 1: Handler Node Basics

**Files to Create:**

1. `apps/baltown/src/components/graph/HandlerNode.tsx` - Handler node inline editor component

**Files to Modify:**

1. `apps/baltown/src/components/graph/CytoscapeGraph.tsx`
   - Add handler node styling (hexagon, orange)
   - Add handlers prop and render handler nodes
   - Handle handler node selection
   - Add double-click to create handler

2. `apps/baltown/src/components/graph/GraphToolbar.tsx`
   - Add "Handler" button
   - Create AddHandlerModal component

3. `apps/baltown/src/pages/Workbench.tsx`
   - Add handlers state (local, not persisted yet)
   - Pass handlers to CytoscapeGraph

### Phase 2: Inline Editing

**Files to Create:**

1. `apps/baltown/src/components/graph/InlineHandlerEditor.tsx` - Positioned popup for editing handler config

**Files to Modify:**

1. `apps/baltown/src/components/graph/CytoscapeGraph.tsx`
   - Track editing handler state
   - Calculate popup position from node position
   - Show InlineHandlerEditor when editing

2. `apps/baltown/src/components/graph/InspectorPanel.tsx`
   - Add handler-specific fields (handler type, config)

### Phase 3: Edge Drawing

**Files to Modify:**

1. `apps/baltown/src/components/graph/CytoscapeGraph.tsx`
   - Install and configure cytoscape-edgehandles
   - Implement edge validation
   - Handle edge creation events
   - Update handler node connections

**New Cytoscape Styles:**

- Input/output port styling
- Edge preview during drawing
- Valid/invalid target highlighting

### Phase 4: Promotion Flow

**Files to Create:**

1. `apps/baltown/src/components/graph/PromoteHandlerModal.tsx` - Confirmation dialog for promotion

**Files to Modify:**

1. `apps/baltown/src/components/graph/CytoscapeGraph.tsx`
   - Detect when handler is fully connected
   - Show "ready to promote" state
   - Handle promotion action

2. `apps/baltown/src/components/graph/InspectorPanel.tsx`
   - Add "Promote to Propagator" button for handlers

### Phase 5: Polish and Integration

**Tasks:**

- Keyboard shortcuts (Enter to promote, Escape to cancel editing)
- Undo/redo support for handler creation and connection
- Animation for promotion (hexagon morphs to diamond)
- Persist incomplete handlers to local storage
- Integration tests

---

## 8. Technical Considerations

### Cytoscape.js Extensions Needed

```javascript
import cytoscape from 'cytoscape'
import dagre from 'cytoscape-dagre' // already installed
import edgehandles from 'cytoscape-edgehandles' // NEW

cytoscape.use(dagre)
cytoscape.use(edgehandles)
```

### Edgehandles Configuration

```javascript
cy.edgehandles({
  snap: true,
  snapThreshold: 30,
  noEdgeEventsInDraw: true,
  edgeParams: (sourceNode, targetNode) => ({
    data: {
      source: sourceNode.id(),
      target: targetNode.id(),
      edgeType: determineEdgeType(sourceNode, targetNode),
    },
  }),
  canConnect: (sourceNode, targetNode) => {
    // Validation logic
  },
  complete: (sourceNode, targetNode, edge) => {
    // Handle new connection
  },
})
```

### Handler Node Lifecycle

1. Created (no connections)
2. Partially connected (inputs only or output only)
3. Fully connected (both inputs and output)
4. Promoted (converted to propagator, handler node removed)

### Temporary URI Scheme

Handler nodes before promotion use temporary URIs:

```
handler:sum-{timestamp}
handler:multiply-{timestamp}
```

After promotion, they become:

```
bl:///r/propagators/{name}
```

---

## 9. UX Principles

1. **Progressive Disclosure**: Start simple (drop a handler), reveal complexity as needed (connect cells)
2. **Direct Manipulation**: Draw connections visually rather than selecting from lists
3. **Immediate Feedback**: Visual state changes as connections are made
4. **Reversibility**: Easy to disconnect/delete and try again
5. **Consistency**: Handler editing UI matches sidebar (reuses same components)

---

## 10. Alternative Approaches Considered

### Rejected: Handlers as Edges

Making handlers be edges between cells was considered but rejected because:

- Limits handler composition (can't chain handlers)
- No natural place for config UI
- Doesn't match mental model of "handler as a thing"

### Rejected: Sidebar-Only Handlers

Keeping handlers sidebar-only was rejected because:

- Disconnects handler creation from graph visualization
- Requires mental mapping between sidebar selection and graph layout
- Less discoverable workflow

### Deferred: Handler Composition in Graph

Allowing handlers to connect to other handlers (for visual composition) is architecturally possible but deferred to reduce scope:

- Would need to distinguish "composition edges" from "data flow edges"
- HiccupComposer already handles composition well
- Can be added later as enhancement

---

## Critical Files for Implementation

- `apps/baltown/src/components/graph/CytoscapeGraph.tsx` - Core graph component
- `apps/baltown/src/components/handlers/ConfigDispatcher.tsx` - Reuse for inline config
- `apps/baltown/src/stores/selection.ts` - Already supports handler type
- `apps/baltown/src/lib/handlerMetadata.ts` - Handler metadata for config UI
- `apps/baltown/src/components/plugboard/PlugboardGraph.tsx` - Reference pattern
