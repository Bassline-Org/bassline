# Bassline Quick Reference

## Project Structure
```
app/
├── propagation-core/      # Headless propagation engine
│   ├── models/           # Contact, Wire, ContactGroup
│   └── types/            # TypeScript types & mergeable examples
├── propagation-react/    # React adapter layer  
│   └── hooks/           # usePropagationNetwork hook
├── components/          # UI components
│   └── nodes/          # ContactNode, BoundaryNode
└── routes/             # Pages (editor.tsx)
```

## Core Concepts

### Contact
- Has content (any type)
- Has blend mode ('accept-last' or 'merge')
- Knows its parent group
- Handles own propagation
- Can be boundary contact (special visibility)

### Wire
- Simple data: id, fromId, toId, type
- Types: 'bidirectional' (default) or 'directed'
- No behavior - just topology

### ContactGroup (Gadget)
- Container for contacts and wires
- Routes content between contacts
- Can have subgroups (hierarchical)
- Handles deletion cleanup
- Boundary contacts act as interface

### Boundary Contacts
- Regular contacts with `isBoundary = true`
- Can be 'input' or 'output' direction
- Visible from parent group for connections
- Enable gadget encapsulation

## Key Patterns

### Creating Network
```typescript
const network = new PropagationNetwork()
const c1 = network.addContact({x: 100, y: 100})
const c2 = network.addContact({x: 200, y: 100})
const wire = network.connect(c1.id, c2.id)
```

### Creating Gadgets
```typescript
// Create a gadget (subgroup)
const gadget = network.createGroup('My Gadget')

// Switch to gadget context
network.currentGroup = gadget

// Add boundary contacts (interface)
const input = network.addBoundaryContact({x: 50, y: 100}, 'input', 'in')
const output = network.addBoundaryContact({x: 350, y: 100}, 'output', 'out')

// Add internal logic
const internal = network.addContact({x: 200, y: 100})
network.connect(input.id, internal.id)
network.connect(internal.id, output.id)

// Switch back to parent
network.currentGroup = network.rootGroup
```

### Propagation Flow
1. User edits contact content
2. Contact notifies neighbors via group
3. Group delivers content to connected contacts
4. Receiving contacts apply blend mode
5. Process repeats if content changes

### React Integration
```typescript
const {
  nodes,           // React Flow nodes
  edges,           // React Flow edges
  onNodesChange,   // Handle drag, delete
  onEdgesChange,   // Handle edge delete
  onConnect,       // Handle new connections
  addContact,      // Add new contact
  updateContent    // Update contact content
} = usePropagationNetwork()
```

## Important Notes

- **Bidirectional by default** - Wires propagate both ways unless directed
- **Automatic cleanup** - Deleting contact removes its wires
- **Type-safe** - Full TypeScript types throughout
- **UUID everywhere** - Use crypto.randomUUID() for all IDs

## Common Tasks

### Add mergeable content
```typescript
// In contact node edit
const interval = new Interval(0, 100)
contact.setContent(interval)
```

### Check for contradictions
```typescript
if (result instanceof Contradiction) {
  console.warn(result.reason)
}
```

### Navigate to editor
```
http://localhost:5173/editor
```

## Navigation
- **Double-click gadget** - Navigate inside
- **Breadcrumbs** - Click to navigate to any parent level
- **Current context** - All operations affect current group

## Refactoring Operations
- **Extract to Gadget** - Select contacts, click button to create gadget
- Automatically creates boundary contacts for external connections
- Preserves all wire connections through proper rewiring

## Keyboard Shortcuts (Left-Hand Friendly)
- **Q** - Toggle gadget palette
- **W** - Toggle instructions
- **E** - Toggle minimap
- **A** - Add contact
- **S** - Add gadget
- **D** - Toggle grid
- **Delete/Backspace** - Remove selected items

## Mouse Actions
- **Double-click contact** - Edit content
- **Double-click gadget** - Navigate inside
- **Drag node** - Move or auto-connect when close
- **Drag from handle** - Create connection
- **Drop edge on canvas** - Quick add menu
- **Click + Drag** - Multi-select for refactoring

## Gadget Palette
- **Extract to Gadget** - Automatically adds to palette
- **Drag from palette** - Creates new instance on canvas
- **Categories** - Organize gadgets (Math, Logic, Data, Utility)
- **Search** - Find gadgets by name or description
- **Usage tracking** - See most used and recent gadgets

## Smart Connection Features
- **Proximity Connect** - Drag nodes close (within 50px of handles) to auto-connect
- **Edge Drop Menu** - Drop edge on empty canvas for quick add options
- **Visual Feedback** - Green edge preview with opacity based on distance

## View Options (Tools Menu - Bottom Center)
- **Instructions** - Help panel with shortcuts
- **Mini Map** - Overview navigation
- **Grid** - Background grid pattern
- **Flow** - (Future) Propagation animations
- **Labels** - (Future) Node label visibility
- **Debug** - (Future) Debug information
- **Hints** - Toast notifications for shortcuts

## Auto-Propagation
- Connections immediately propagate existing content
- Bidirectional wires flow both ways if content exists
- No manual triggering needed

## Template System
```typescript
// Save gadget as template
const template = group.toTemplate()

// Instantiate template at position
const instance = ContactGroup.fromTemplate(template, parentGroup)
```