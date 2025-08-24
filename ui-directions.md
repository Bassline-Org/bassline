# Lattice UI Specification

## Core Principle
The UI is not built *on top of* the computational graph - it *is* the computational graph. Every visual element, interaction, and piece of chrome is a gadget in the network, with properties as cells that propagate values according to lattice operations.

---

## 1. Foundation: Everything is a Gadget

### Visual Components as Networks
```typescript
class VisualGadget extends Network {
  // Visual properties are cells
  position: Cell<Vec2>
  size: Cell<Vec2> 
  visible: Cell<boolean>
  opacity: Cell<number>
  zIndex: Cell<number>
  
  // Visual state propagates through the graph
  // Changing position.value updates everything connected to position
}
```

**Key Insight**: A button isn't a special UI object - it's a Network containing:
- An OrdinalCell for its state
- A TapAffordance for interaction
- Visual cells for appearance
- All wired together

### Properties as Cells
Every property that would traditionally be a "prop" or "attribute" is instead a Cell in the graph:

```typescript
// Traditional UI
<Button color="blue" onClick={handler} />

// Lattice UI
const button = new Network(
  color: new Cell("blue"),      // Can be wired to other color cells
  state: new OrdinalCell(false), // Can be connected to multiple writers
  tap: new TapAffordance(state)  // Interaction is a gadget
)
```

This means:
- Properties can be **wired** to other properties
- Multiple sources can influence a property (via lattice operations)
- Properties are **live** - changes propagate immediately
- Properties can be **queried** like any other cell

---

## 2. Affordances: Interaction as Gadgets

### Base Affordance Types
Affordances are gadgets that translate user input into graph mutations:

```typescript
abstract class Affordance extends Cell {
  target: Cell              // What cell to affect
  bounds: Cell<Shape>       // Where interaction is active
  enabled: Cell<boolean>    // Can be wired to conditions
  feedback: Cell<Feedback>  // Visual/haptic response
}
```

### Primitive Affordances
The minimal set of interaction gadgets:

1. **TapAffordance**: Touch → boolean pulse
2. **DragAffordance**: Drag → numeric delta  
3. **DropAffordance**: Drop → connection creation
4. **TypeAffordance**: Keyboard → text input
5. **HoverAffordance**: Proximity → boolean state

### Composed Affordances
Complex interactions built from primitives:

```typescript
// Slider = Drag + Constraints + Visual
const slider = new Network(
  value: new OrdinalCell(50),
  drag: new DragAffordance(value),
  clamp: new ClampFunction(0, 100),
  track: new RectVisual(),
  thumb: new CircleVisual(),
  
  // Wire them together
  connect(drag.output, clamp.input),
  connect(clamp.output, value),
  connect(value, thumb.position.x)
)
```

---

## 3. Views: Queries as Visual Generators

### View Gadgets
Views are gadgets that query the graph and generate visuals:

```typescript
class View extends Network {
  query: Cell<Query>           // What to show
  layout: Cell<LayoutRule>     // How to arrange it
  filters: Cell<Filter[]>      // What to hide/show
  projection: Cell<Transform>  // How to transform data to visual
  
  // The view updates when any of these cells change
  render(): VisualGadget {
    const data = this.query.value.execute()
    const arranged = this.layout.value.apply(data)
    const filtered = this.filters.value.apply(arranged)
    return this.projection.value.apply(filtered)
  }
}
```

### Zoom-Dependent Views
Views can change based on zoom level:

```typescript
class ZoomView extends View {
  zoomLevel: Cell<number>  // Connected to camera
  
  detailLevels: {
    overview: Cell<View>,   // < 0.5x zoom
    normal: Cell<View>,     // 0.5x - 2x zoom  
    detail: Cell<View>      // > 2x zoom
  }
  
  // Different queries/layouts/projections at each level
}
```

---

## 4. Chrome as Graph

### Viewport Network
The persistent UI that follows the user:

```typescript
class Viewport extends Network {
  // Chrome is just pinned gadgets
  pinned: Set<Gadget>
  
  // Special properties
  followCamera: Cell<boolean> = true
  alwaysOnTop: Cell<boolean> = true
  
  // Can be wired to show/hide based on context
  visible: Cell<boolean>
  
  // Users build their own chrome by dropping gadgets here
  dropZone: new DropAffordance(
    accepts: (g) => g instanceof Portal || Tool || View
  )
}
```

### Menus as Gadgets
Menus aren't special - they're networks that show other gadgets:

```typescript
class Menu extends Network {
  items: Cell<Set<Gadget>>    // What to show (can be wired to queries!)
  trigger: Cell<boolean>       // When to show (wired to sensors!)
  position: Cell<Vec2>         // Where to show
  layout: Cell<LayoutRule>     // How to arrange items
  
  // Menus can be reactive - items change based on context
  constructor(itemQuery: Query) {
    this.items = new QueryCell(itemQuery)
    this.trigger = new HoverSensor()
    connect(this.trigger, this.visible)
  }
}
```

---

## 5. Portals: Navigation as Connection

### Portal Gadgets
Portals are bidirectional connections between distant parts of the graph:

```typescript
class Portal extends Network {
  source: Cell<Gadget>      // What you're looking at
  destination: Cell<Gadget> // Where it leads
  
  // Portals can be conditional
  active: Cell<boolean>
  
  // Visual can vary - doorway, link, window
  visual: Cell<VisualGadget>
  
  // Activating a portal updates the camera
  activate() {
    camera.position = this.destination.position
  }
}
```

---

## 6. Composition Patterns

### Building Complex UI
Since everything is a gadget, complex UI is just network composition:

```typescript
// Email client is just a network
const emailClient = new Network(
  // Data
  messages: new UnionCell(),
  selected: new OrdinalCell(),
  
  // Views
  inbox: new ListView(messages),
  reader: new DetailView(selected),
  
  // Interactions
  messageClick: new TapAffordance(selected),
  
  // Layout
  layout: new SplitLayout(inbox, reader),
  
  // Wire interactions to data
  connect(messageClick.output, selected),
  connect(selected, reader.input)
)

// Can be dropped into viewport, saved to library, shared, etc.
```

### Self-Modifying UI
Since UI is the graph, UI can modify UI:

```typescript
// Inspector that can inspect itself
const inspector = new Network(
  selection: new SelectionSensor(),
  properties: new PropertyQuery(selection),
  
  // Can inspect and modify its own properties!
  // Select the inspector to inspect the inspector
)
```

---

## 7. Key Principles

### Everything is Live
- Changes propagate immediately
- No compile step, no "apply" button
- UI updates as the graph changes

### Everything is Composable
- Any gadget can contain any other gadget
- UI can be built from other UI
- No special cases or restrictions

### Everything is Inspectable
- All properties are cells you can examine
- All connections are visible and traceable
- UI internals are accessible, not hidden

### Everything is Programmable
- Users can wire UI to data
- UI can be generated from queries
- Chrome can be customized per-user

### No Modes
- The same tools that build the app build the UI
- No distinction between "design time" and "run time"
- No separate "UI editor" - it's all the same graph

---

## 8. Implementation Notes

### Rendering Strategy
Visual gadgets produce React components, but they're still gadgets:

```typescript
function renderGadget(gadget: VisualGadget): ReactNode {
  // Subscribe to all visual property cells
  const position = useCell(gadget.position)
  const size = useCell(gadget.size)
  const visible = useCell(gadget.visible)
  
  if (!visible) return null
  
  return (
    <div style={{
      position: 'absolute',
      left: position.x,
      top: position.y,
      width: size.x,
      height: size.y
    }}>
      {gadget.children.map(child => renderGadget(child))}
    </div>
  )
}
```

### Performance Considerations
- Viewport culling: Only render visible gadgets
- Level-of-detail: Simpler visuals when zoomed out
- Lazy evaluation: Views only query when visible
- Incremental updates: Lattice operations minimize recomputation

### Storage Format
UI is saved as part of the graph:

```typescript
{
  gadgets: [
    {
      id: "button-1",
      type: "Network",
      cells: {
        "position": { x: 100, y: 200 },
        "color": "blue",
        "state": false
      },
      connections: [
        { from: "tap", to: "state" }
      ]
    }
  ]
}
```

---

## Summary

This system eliminates the boundary between UI and application. Instead of building UI to manipulate a separate data model, the UI **is** data in the model. Every button, every menu, every view is a gadget participating in the same propagation network as your application logic.

The result: 
- **Unified system** - One set of tools for everything
- **User programmable** - UI can be wired, modified, extended
- **Truly reactive** - UI properties are cells that propagate
- **Composable** - Build UI from UI from UI
- **Inspectable** - See how everything works, modify anything

The interface becomes a living part of the computational graph, not a separate layer on top.