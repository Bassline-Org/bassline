# Implementation Prompt: Rete.js as Visualization Layer for Propagation Network

## Project Context
You're implementing Rete.js as a **pure visualization layer** for an existing propagation network system. Rete will ONLY handle the visual node editor - all computation happens through the propagation network. Think of Rete as a "dumb" visual frontend that syncs with the real computational graph.

## Critical Principle
**Rete's execution model is completely ignored**. No Workers, no Rete data flow. Rete is just for:
- Drawing nodes and connections
- Handling drag/drop/select interactions  
- Managing the visual layout
- Triggering propagation network operations

## Implementation Tasks

### Task 1: Setup and Core Integration

**File: `proper-bassline-react/src/rete/ReteNetworkEditor.tsx`**

```typescript
// Main editor component that syncs a propagation Network with Rete visualization
// Requirements:
// - Create a Rete NodeEditor instance
// - Maintain a bidirectional mapping: reteNode.id ↔ gadget.id
// - Listen to Rete events and update propagation network
// - Listen to propagation network changes and update Rete
// - NO use of Rete's worker/engine system
```

Key implementation details:
- Use `editor.toJSON()` to get visual positions only
- Store gadget references in `node.data.gadgetId`
- Sync node positions with VisualNode's position cell
- Handle connection events to wire actual gadgets

### Task 2: Node Components for Each Gadget Type

**File: `proper-bassline-react/src/rete/components/CellNodeComponent.ts`**

```typescript
// Rete component for visualizing Cell gadgets
// Requirements:
// - Show current cell value in the node
// - Single output socket
// - Multiple input sockets (cells can have many sources)
// - Subscribe to cell changes and update node display
// - Different appearance for different cell types (Max, Min, Ordinal, etc.)
```

**File: `proper-bassline-react/src/rete/components/FunctionNodeComponent.ts`**

```typescript
// Rete component for visualizing FunctionGadget
// Requirements:
// - Named input sockets based on function.inputNames
// - Single output socket
// - Show function type and current output value
// - Different colors for different function types
// - NO implementation of worker() - just return
```

**File: `proper-bassline-react/src/rete/components/NetworkNodeComponent.ts`**

```typescript
// Rete component for visualizing nested Networks
// Requirements:
// - Show boundary cells as input/output sockets
// - Double-click to "enter" nested network (switch editor view)
// - Different visual style to indicate it's a container
// - Show count of contained gadgets
```

### Task 3: Socket Types and Connection Rules

**File: `proper-bassline-react/src/rete/sockets.ts`**

```typescript
// Define Rete sockets that match lattice value types
// Requirements:
// - Create sockets for: number, string, boolean, set, dict, any
// - Implement connection compatibility rules
// - Socket colors should indicate type
// - Allow "any" socket to connect to typed sockets
```

### Task 4: Synchronization Layer

**File: `proper-bassline-react/src/rete/PropagationSync.ts`**

```typescript
// Service that keeps Rete and propagation network in sync
// Requirements:
// 
// When Rete events happen:
// - nodecreated → create gadget, add to network
// - noderemoved → remove gadget from network  
// - connectioncreated → wire gadgets with connectFrom()
// - connectionremoved → disconnect gadgets
// - nodetranslated → update gadget's position cell
// 
// When propagation network changes:
// - New gadget added → create Rete node
// - Gadget removed → remove Rete node
// - Cell value changed → update node display
// - Connection added → create Rete connection
```

### Task 5: Controls and Plugins

**File: `proper-bassline-react/src/rete/controls/ValueDisplay.tsx`**

```typescript
// Rete control that shows live cell values
// Requirements:
// - Subscribe to cell with useCell() hook
// - Format value based on type (number, string, set, etc.)
// - Update in real-time as propagation happens
// - Click to edit for OrdinalCell
```

**File: `proper-bassline-react/src/rete/controls/MiniInspector.tsx`**

```typescript
// Rete control that shows gadget properties
// Requirements:
// - List all cells in the gadget
// - Show current values
// - Allow editing OrdinalCell values
// - Show upstream/downstream connections
```

### Task 6: Editor Actions

**File: `proper-bassline-react/src/rete/EditorActions.ts`**

```typescript
// Actions that can be performed on the editor
// Implement these functions:
// 
// createNode(gadgetType, position):
//   - Create gadget based on type
//   - Add to propagation network
//   - Create corresponding Rete node
//   - Position it
// 
// deleteSelected():
//   - Get selected Rete nodes
//   - Remove corresponding gadgets from network
//   - Remove Rete nodes
// 
// autoLayout():
//   - Use dagre or similar to layout
//   - Update both Rete positions and gadget position cells
// 
// serialize():
//   - Save both visual layout and propagation network
// 
// deserialize(data):
//   - Restore network and visual layout
```

### Task 7: Live Propagation Display

**File: `proper-bassline-react/src/rete/PropagationVisualizer.tsx`**

```typescript
// Overlay that shows propagation happening
// Requirements:
// - Flash connections when values propagate
// - Show values flowing along connections
// - Highlight nodes that are computing
// - Display propagation order/sequence
// - Performance counter showing propagations/second
```

### Task 8: Context Menu Integration

**File: `proper-bassline-react/src/rete/ContextMenu.tsx`**

```typescript
// Right-click menu for nodes and connections
// Node menu items:
// - Inspect (show all properties)
// - Delete
// - Duplicate
// - Make Boundary (for cells)
// - Enter (for networks)
// 
// Connection menu items:
// - Delete connection
// - Insert node between
// - Show current value
```

## Code Patterns to Follow

### Pattern 1: Creating a Node from a Gadget
```typescript
async function createNodeForGadget(editor: NodeEditor, gadget: Gadget, position?: {x: number, y: number}) {
  const component = getComponentForGadget(gadget)
  const node = await component.createNode({ gadgetId: gadget.id })
  
  node.position = position || [Math.random() * 400, Math.random() * 300]
  editor.addNode(node)
  
  // Store mapping
  nodeGadgetMap.set(node.id, gadget)
  gadgetNodeMap.set(gadget.id, node)
  
  return node
}
```

### Pattern 2: NO Workers!
```typescript
class CellComponent extends Rete.Component {
  async worker(node, inputs, outputs) {
    // DO NOTHING! The propagation network handles computation
    return
  }
}
```

### Pattern 3: Sync Cell Values to Node Display
```typescript
class ValueControl extends Rete.Control {
  constructor(emitter, key, cell) {
    super(key)
    this.cell = cell
    
    // Subscribe to cell changes
    cell.addDownstream({
      accept: (value) => {
        this.setValue(value)
        emitter.trigger('process') // Update display only
      }
    })
  }
  
  setValue(value) {
    this.vueContext.value = formatLatticeValue(value)
  }
}
```

### Pattern 4: Connection Creation
```typescript
editor.on('connectioncreate', ({ output, input }) => {
  const sourceGadget = nodeGadgetMap.get(output.node.id)
  const targetGadget = nodeGadgetMap.get(input.node.id)
  
  if (targetGadget instanceof Cell) {
    // Cells can have multiple inputs
    targetGadget.connectFrom(sourceGadget, output.key)
  } else if (targetGadget instanceof FunctionGadget) {
    // Functions have named inputs
    targetGadget.connectFrom(input.key, sourceGadget, output.key)
  }
  
  // Trigger propagation
  network.propagate()
})
```

## Testing Checklist

Create a test file that verifies:

1. **Create a MaxCell and MinCell, wire them, verify Rete shows the connection**
2. **Change a cell value, verify node display updates**
3. **Delete a Rete node, verify gadget is removed from network**
4. **Create a cycle, verify it doesn't crash (lattice handles it)**
5. **Save and restore editor state**
6. **Create nested network, double-click to enter**
7. **Drag nodes, verify position cells update**

## Example Usage

```typescript
// User code should be this simple:
const network = new Network('main')
const editor = new ReteNetworkEditor(container, network)

// Create some gadgets
const input = new OrdinalCell('input')
const max = new MaxCell('max')
const output = new OrdinalCell('output')

// Add to network (Rete nodes appear automatically!)
network.add(input, max, output)

// Wire them (Rete connections appear automatically!)
max.connectFrom(input)
output.connectFrom(max)

// Change value (Rete display updates automatically!)
input.userInput(42)
network.propagate()
```

## Success Criteria

- [ ] Rete accurately visualizes the propagation network structure
- [ ] All gadget types have appropriate node representations
- [ ] Connections in Rete correspond 1:1 with propagation wiring
- [ ] Cell values update live in the node display
- [ ] Visual operations (drag, delete, connect) update the propagation network
- [ ] NO use of Rete's execution engine - only visualization
- [ ] Can handle networks with 100+ nodes smoothly
- [ ] Can save/restore both visual layout and network state

## Philosophy

Remember: Rete knows NOTHING about computation. It's just a really good box-and-line drawer. Your propagation network is the brain, Rete is just the eyes and hands. This separation keeps both systems clean and allows you to swap out Rete later if needed.