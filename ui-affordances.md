# UI Affordances System - Implementation Guide

## Overview
This document describes the implementation of the Lattice UI system where the UI is not built *on top of* the propagation network but *is* the propagation network itself. Every visual element, interaction, and piece of chrome is a gadget with properties as cells that propagate values.

## Core Architecture

### Fundamental Principle
```
UI = Computation
```
- Every visual element is a gadget
- Every property is a cell
- Every interaction is an affordance gadget
- Every view is a query over the network

### Metamodel Hierarchy

```
GadgetBase (interface)
├── Cell (stateful value holder)
│   ├── OrdinalCell (last-write-wins with ordering)
│   ├── MaxCell (maximum value wins)
│   ├── MinCell (minimum value wins)
│   └── UnionCell (set union)
│
├── Network (gadget container)
│   ├── VisualGadget (has visual properties)
│   │   ├── RectGadget
│   │   ├── TextGadget
│   │   ├── PathGadget (for edges/connections)
│   │   └── GroupGadget
│   │
│   ├── ViewGadget (queries and projects)
│   │   ├── ListView
│   │   ├── GraphView
│   │   ├── TreeView
│   │   └── InspectorView
│   │
│   └── CanvasGadget (infinite zoomable space)
│
├── Function (computation)
│   └── (existing function gadgets)
│
└── Affordance (interaction translator)
    ├── TapAffordance (click/tap → pulse)
    ├── DragAffordance (drag → delta)
    ├── DropAffordance (drop → connection)
    ├── TypeAffordance (keyboard → text)
    ├── HoverAffordance (proximity → boolean)
    └── PinchAffordance (pinch → scale)
```

## Key Concepts

### 1. Networks as First-Class Values
Networks can be stored in cells and passed through the propagation system:

```typescript
// Networks can be values
const selectedNetwork = new OrdinalCell<NetworkValue>()
const networkViewer = new ViewGadget(selectedNetwork)

// Networks can be queried even when stored as values
const results = selectedNetwork.value.query("Cell[value > 5]")
```

### 2. Query System
Only Networks are queryable (they're containers). Cells and Functions are findable but not queryable:

```typescript
network.query("Cell#myCell")           // ✓ Find a cell
network.query("Function.active")       // ✓ Find active functions  
network.query("Network > Cell")        // ✓ Find cells in networks

cell.query("*")                        // ✗ Cells aren't queryable
function.query("inputs")               // ✗ Functions aren't queryable
```

### 3. Visual Properties as Cells
Visual properties are just cells that can be wired to other cells:

```typescript
class VisualGadget extends Network {
  position: Cell<{x: number, y: number}>    // Can be wired
  size: Cell<{width: number, height: number}>
  visible: Cell<boolean>                    // Can be computed
  opacity: Cell<number>                     // Can animate
  style: Cell<StyleMap>                     // Can be reactive
}
```

### 4. Affordances as Gadgets
Interactions are gadgets that translate user input into cell updates:

```typescript
// Button = Visual + State + Interaction
const button = new Network(
  visual: new RectGadget(),
  label: new TextGadget(),
  pressed: new OrdinalCell(false),
  tap: new TapAffordance(),
  
  // Wire tap to pressed state
  connect(tap.output, pressed)
)
```

### 5. Views as Queries
Views query the network and project results into visuals:

```typescript
class ListView extends ViewGadget {
  source: Cell<Network>      // What to query
  filter: Cell<Query>        // What to show
  
  render() {
    const items = this.source.value.query(this.filter.value)
    return items.map(item => this.createItemVisual(item))
  }
}
```

### 6. No Fixed Chrome
UI chrome (toolbars, menus, etc.) are just default networks that users can modify:

```typescript
// Toolbar is just a network - users can change it!
const toolbar = new Network(
  layout: new FlowLayout(),
  tools: [
    new SelectTool(),
    new WireTool(),
    new InspectorTool()
  ]
)

// Users can add their own tools
toolbar.add(new CustomTool())
```

## Implementation Phases

### Phase 1: Core Metamodel ✓ Current
- [ ] Define GadgetBase interface
- [ ] Implement NetworkValue for networks as values  
- [ ] Create Query system for finding gadgets
- [ ] Update Network to be queryable

### Phase 2: Visual Gadgets
- [ ] Create VisualGadget base with visual cells
- [ ] Implement basic visual gadgets (Rect, Text, Path)
- [ ] Add layout gadgets (Stack, Grid, Flow)
- [ ] Create render bridge to React

### Phase 3: Affordance System
- [ ] Define Affordance base class
- [ ] Implement core affordances (Tap, Drag, Drop, Type, Hover)
- [ ] Create gesture composition system
- [ ] Wire affordances to visual gadgets

### Phase 4: View System
- [ ] Create ViewGadget base
- [ ] Implement query-based views
- [ ] Add projection/transformation system
- [ ] Create specialized views (List, Graph, Tree, Inspector)

### Phase 5: Canvas Integration
- [ ] Convert Canvas to CanvasGadget
- [ ] Implement LOD system as gadget property
- [ ] Update node/edge rendering to use VisualGadgets
- [ ] Remove React-based node system

### Phase 6: Chrome as Networks
- [ ] Convert toolbar to default Network
- [ ] Convert menus to reactive Networks
- [ ] Make inspector self-inspectable
- [ ] Enable user customization of all chrome

## Key Implementation Files

```
proper-bassline/
├── src/
│   ├── gadget-base.ts      # Core gadget interface
│   ├── network-value.ts    # Networks as values
│   ├── query.ts            # Query system
│   ├── visual-gadget.ts    # Visual properties
│   ├── affordance.ts       # Interaction system
│   ├── view.ts             # View gadgets
│   ├── canvas-gadget.ts    # Infinite canvas
│   │
│   ├── visuals/           # Visual gadget types
│   │   ├── rect.ts
│   │   ├── text.ts
│   │   ├── path.ts
│   │   └── group.ts
│   │
│   ├── affordances/       # Interaction gadgets
│   │   ├── tap.ts
│   │   ├── drag.ts
│   │   ├── drop.ts
│   │   ├── type.ts
│   │   └── hover.ts
│   │
│   ├── views/            # View gadgets
│   │   ├── list.ts
│   │   ├── graph.ts
│   │   ├── tree.ts
│   │   └── inspector.ts
│   │
│   └── defaults/         # Default chrome networks
│       ├── toolbar.ts
│       ├── menu.ts
│       └── inspector.ts

proper-bassline-react/
├── src/
│   ├── GadgetRenderer.tsx  # Render gadgets via React
│   └── hooks.tsx           # Already has useCell, etc.

apps/web/app/routes/
└── programmable-editor.tsx # Update to use new system
```

## Design Decisions

### Why Only Networks are Queryable
- Networks are natural containers
- Cells and Functions are atomic values
- Keeps the mental model simple
- Can find any gadget, just can't query INTO non-networks

### Why Direct Exposure (No Mirrors)
- Aligns with "everything is live" philosophy
- Simpler - one API not two
- Enables immediate manipulation
- Can add protection via lattice operations if needed

### Why Affordances as Gadgets
- Interactions become composable
- Can wire interactions together
- Can enable/disable via cells
- Interactions can be inspected/debugged

### Why Views as Queries
- Views automatically update when data changes
- Views can be composed (query of queries)
- Views can be reactive to user actions
- Enables semantic zoom (different queries at different scales)

## Usage Examples

### Creating a Button
```typescript
const button = new Network('myButton')
  .add(new RectGadget())
  .add(new TextGadget('Click me'))
  .add(new OrdinalCell(false, 'state'))
  .add(new TapAffordance('tap'))
  .connect('tap', 'state')
```

### Creating a Slider
```typescript
const slider = new Network('slider')
  .add(new OrdinalCell(50, 'value'))
  .add(new DragAffordance('drag'))
  .add(new ClampFunction(0, 100, 'clamp'))
  .add(new RectGadget('track'))
  .add(new RectGadget('thumb'))
  .connect('drag', 'clamp.input')
  .connect('clamp.output', 'value')
  .connect('value', 'thumb.position.x')
```

### Creating a View
```typescript
const listView = new ListView()
  .setSource(myNetwork)
  .setQuery("Cell[type='todo']")
  .setProjection(todo => new TextGadget(todo.value))
```

### Querying Networks
```typescript
// Find all visible cells with values > 10
network.query("Cell[visible=true][value>10]")

// Find all tap affordances
network.query("TapAffordance")

// Find all gadgets within 100px of origin
network.query("*").near({x: 0, y: 0}, 100)

// Find upstream dependencies
network.query("#myGadget").upstream()
```

## Success Criteria

- [ ] Networks can be passed as values through cells
- [ ] Visual properties can be wired to computations
- [ ] Interactions are composable gadgets
- [ ] Views update automatically via queries
- [ ] No fixed chrome - everything is modifiable
- [ ] The inspector can inspect itself
- [ ] UI can modify UI through the graph

## Philosophy

This system represents a fundamental shift in how we think about user interfaces:

- **Traditional**: UI is a separate layer that manipulates data
- **Lattice UI**: UI *is* data in the propagation network

The result is a system where:
- Building the UI and using the UI are the same activity
- Users can modify any part of the interface
- The interface can modify itself
- There's no boundary between "application" and "interface"

The interface becomes a living, breathing part of the computational graph.