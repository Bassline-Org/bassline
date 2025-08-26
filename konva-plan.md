# Implementation Prompt: Konva Rendering Layer for Propagation Network

## Project Context
You're implementing a Konva.js rendering layer for a propagation network system where UI elements are computational gadgets. The key principle: **Konva only renders pixels based on cell values - ALL state and interaction logic stays in the propagation network**.

## Architecture Constraints
1. **NO Konva event handling** - All interactions go through Affordance gadgets
2. **NO state in React components** - All state lives in Cells
3. **Konva shapes are purely derived from Cell values** - they never mutate
4. **The propagation network is the single source of truth**

## Implementation Tasks

### Task 1: Create Core Konva Renderer Infrastructure

**File: `proper-bassline-react/src/konva/KonvaRenderer.tsx`**

Create a renderer that translates VisualGadgets to Konva shapes:

```typescript
// This component subscribes to a VisualGadget's cells and renders the appropriate Konva shape
// Key requirements:
// - Use useCell() hook to subscribe to position, size, visible, opacity, etc.
// - Set listening={false} on ALL Konva components
// - Extract actual values from OrdinalCell's dict structure
// - Support these gadget types: RectGadget, TextGadget, PathGadget, GroupGadget
```

**File: `proper-bassline-react/src/konva/PropagationStage.tsx`**

Create a Stage wrapper that routes raw DOM events to affordances:

```typescript
// This replaces react-konva's event system with affordance routing
// Requirements:
// - Disable all Konva listening
// - Capture raw pointer/keyboard events on the container
// - Convert to InputEvent format
// - Use spatial queries to find relevant affordances
// - Call affordance.handleInput() with events
```

### Task 2: Implement Shape Components

**File: `proper-bassline-react/src/konva/shapes/KonvaRect.tsx`**

```typescript
// Subscribe to RectGadget's cells and render a Konva Rect
// Must handle:
// - backgroundColor, borderRadius, borderWidth, borderColor cells
// - Extract values from OrdinalCell dict structure (value.get('value'))
// - Convert propagation network colors/sizes to Konva properties
// - Always set listening={false}
```

**File: `proper-bassline-react/src/konva/shapes/KonvaText.tsx`**

```typescript
// Subscribe to TextGadget's cells and render a Konva Text
// Must handle:
// - text, fontSize, fontFamily, fontWeight, color, textAlign cells
// - Text wrapping based on size cell
// - Font loading if needed
```

**File: `proper-bassline-react/src/konva/shapes/KonvaPath.tsx`**

```typescript
// Subscribe to PathGadget's cells and render a Konva Path
// Must handle:
// - points array (convert to SVG path data)
// - strokeColor, strokeWidth, strokeDasharray, fillColor
// - smooth vs straight path segments
// - Arrow heads for edges
```

**File: `proper-bassline-react/src/konva/shapes/KonvaGroup.tsx`**

```typescript
// Subscribe to GroupGadget's cells and render a Konva Group
// Must handle:
// - transform, clipPath, overflow cells
// - Recursively render child VisualGadgets
// - Apply group transforms to children
```

### Task 3: Performance Optimizations

**File: `proper-bassline-react/src/konva/OptimizedCanvas.tsx`**

```typescript
// Implement viewport culling and caching
// Requirements:
// - Use network.query() to find only visible gadgets within viewport
// - Implement dirty tracking - only re-render changed gadgets
// - Use Konva's cache() for complex static groups
// - Layer management: background, edges, nodes, overlay
```

### Task 4: Affordance Integration

**File: `proper-bassline-react/src/konva/AffordanceRouter.tsx`**

```typescript
// Route DOM events to affordance gadgets
// Requirements:
// - Convert mouse/touch/keyboard events to InputEvent format
// - Use spatial queries to find affordances at event position
// - Handle drag sequences (down → move → up)
// - Support modifier keys (shift for multi-select, etc.)
// - Call affordance.handleInput() with proper event data
```

### Task 5: Replace Existing NetworkCanvas

**File: `proper-bassline-react/src/konva/KonvaNetworkCanvas.tsx`**

```typescript
// Drop-in replacement for the existing NetworkCanvas
// Must:
// - Accept same props as current NetworkCanvas
// - Query network for all VisualGadgets
// - Render them using KonvaRenderer
// - Handle pan/zoom via transform cells
// - Support infinite canvas via viewport management
```

### Task 6: Integration Examples

**File: `proper-bassline-react/src/konva/examples/EditorExample.tsx`**

```typescript
// Show how to use the Konva renderer with the editor
// Demonstrate:
// - Creating visual gadgets with wired properties
// - Adding affordances for interaction
// - Connecting cells to drive animations
// - Building UI entirely through the propagation network
```

## Code Patterns to Follow

### Pattern 1: Extracting Values from Cells
```typescript
// OrdinalCells store values in a dict structure
const [rawValue] = useCell(gadget.position)
const position = rawValue?.value?.get('value')?.value || rawValue?.value || { x: 0, y: 0 }
```

### Pattern 2: Always Disable Konva Events
```typescript
<Rect
  {...props}
  listening={false}  // ALWAYS false
  draggable={false}  // NEVER true - use DragAffordance
/>
```

### Pattern 3: Affordance Event Routing
```typescript
const handlePointerDown = (e: PointerEvent) => {
  const point = { x: e.offsetX, y: e.offsetY }
  const affordances = network.query('Affordance').within({
    x: point.x - 5,
    y: point.y - 5,
    width: 10,
    height: 10
  }).execute()
  
  affordances.forEach(affordance => {
    affordance.handleInput({
      type: 'tap',
      position: point,
      button: e.button
    })
  })
}
```

### Pattern 4: Performance via Selective Rendering
```typescript
// Only render what's visible
const visibleGadgets = useMemo(() => {
  return network
    .query('VisualGadget[visible=true]')
    .within(viewport)
    .execute()
}, [network, viewport])
```

## Testing Requirements

1. Create a test that verifies Konva shapes update when cells change
2. Verify that clicking on shapes triggers affordances, not Konva events
3. Test that dragging updates position cells through DragAffordance
4. Verify viewport culling improves performance with many gadgets
5. Test that the system works with the existing propagation network examples

## Success Criteria

- [ ] All visual gadgets render correctly through Konva
- [ ] Interactions work through affordances only
- [ ] Performance is good with 1000+ visual gadgets
- [ ] No state lives in React components
- [ ] The implementation can be used as a drop-in replacement for NetworkCanvas
- [ ] Visual properties can be wired to any cells in the network

## Philosophy to Maintain

Remember: Konva is just a pixel pusher. It has no opinion about your data model, no state management, no event handling. It simply reads cell values and draws shapes. This keeps your propagation network pure and your UI truly computational.