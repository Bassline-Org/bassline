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

### Wire
- Simple data: id, fromId, toId, type
- Types: 'bidirectional' (default) or 'directed'
- No behavior - just topology

### ContactGroup
- Container for contacts and wires
- Routes content between contacts
- Can have subgroups (hierarchical)
- Handles deletion cleanup

## Key Patterns

### Creating Network
```typescript
const network = new PropagationNetwork()
const c1 = network.addContact({x: 100, y: 100})
const c2 = network.addContact({x: 200, y: 100})
const wire = network.connect(c1.id, c2.id)
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

## Keyboard Shortcuts
- **Delete/Backspace** - Remove selected nodes/edges
- **Double-click** - Edit node content
- **Drag** - Connect nodes (from handle to handle)