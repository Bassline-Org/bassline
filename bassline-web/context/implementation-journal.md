# Bassline Implementation Journal

## Overview
This document captures the implementation of a propagation network system in React, based on a Smalltalk implementation. The goal was to create a visual programming environment supporting bidirectional constraint propagation.

## Architecture Decisions That Worked

### 1. Clean Separation of Concerns
**Decision**: Separate core propagation logic from UI completely
- `propagation-core/` - Pure TypeScript, no React dependencies
- `propagation-react/` - React adapter layer  
- UI components use the adapter, never touch core directly

**Why it worked**: 
- Core logic is testable without UI
- Could swap React Flow for another library easily
- Propagation logic stays simple and focused

### 2. Contact-Driven Propagation
**Decision**: Contacts handle their own propagation, not ContactGroup
```typescript
// Contact asks its group for connections, then propagates
class Contact {
  propagate() {
    const connections = this.group.getOutgoingConnections(this.id)
    for (const {wire, targetId} of connections) {
      this.group.deliverContent(targetId, this.content, this.id)
    }
  }
}
```

**Why it worked**:
- Mirrors real propagator networks (cells are active)
- Decentralized - no central propagation engine needed
- Contacts stay independent

### 3. Simple Wire Model
**Decision**: Just two wire types - bidirectional (default) and directed
- No complex wire behaviors
- Wires are just data (id, from, to, type)

**Why it worked**:
- Transformations happen through network topology, not wire types
- Keeps the mental model simple

## Key Implementation Details

### UUID Generation
```typescript
const generateId = (): string => crypto.randomUUID()
```
- Every entity gets a proper UUID
- No counters or timestamps
- Works across distributed systems

### Blend Modes
Only two modes implemented:
1. **accept-last**: Default, just overwrites
2. **merge**: Semi-lattice merge with contradiction detection

```typescript
interface Mergeable<T> {
  merge(other: T): T | Contradiction
}
```

### React Flow Integration
```typescript
// Map core models to React Flow format
const newNodes: Node[] = contacts.map(contact => ({
  id: contact.id,
  position: contact.position,
  type: contact.isBoundary ? 'boundary' : 'contact',
  data: { /* contact data */ }
}))
```

## What Didn't Work Initially

### 1. Wrong React Flow Package
**Problem**: Started with `reactflow` but should have used `@xyflow/react`
**Fix**: Migrated all imports and adjusted for API differences

### 2. Type Issues with TypeScript
**Problem**: `verbatimModuleSyntax` required explicit type imports
**Fix**: Changed all type imports to use `import type { ... }`

### 3. Missing Deletion Support
**Problem**: No way to remove nodes/edges
**Solution**: Added `removeContact()` and `removeWire()` methods that:
- Remove the entity
- Clean up connected wires automatically
- Update React Flow state

### 4. React Flow Provider Context
**Problem**: Handle components used outside provider context
**Fix**: Ensure proper component hierarchy with ReactFlowProvider

## Current System Capabilities

### Working Features
- ✅ Visual node editor with React Flow
- ✅ Bidirectional propagation between contacts
- ✅ Blend modes (accept-last, merge)
- ✅ Custom nodes (Contact, Boundary)
- ✅ Node/edge deletion with cleanup
- ✅ Double-click to edit content
- ✅ Proper TypeScript types throughout

### Example Mergeable Types
```typescript
// Interval - narrows to intersection
new Interval(0, 10).merge(new Interval(5, 15)) // → Interval(5, 10)

// SetValue - accumulates values  
new SetValue([1, 2]).merge(new SetValue([2, 3])) // → SetValue([1, 2, 3])

// Temperature - monotonic increase
new Temperature(20).merge(new Temperature(25)) // → Temperature(25)
```

## Next Steps (Not Yet Implemented)

1. **Hierarchical Navigation**
   - Navigate into ContactGroups
   - Breadcrumb navigation
   - URL-based routing for groups

2. **Boundary Contacts**
   - Connect parent/child groups
   - Create abstraction boundaries

3. **Visual Propagation Feedback**
   - Animate edges during propagation
   - Highlight changing values

4. **Persistence**
   - Save/load networks
   - Undo/redo support

## Key Files Reference

### Core System
- `app/propagation-core/models/Contact.ts` - Active cell with propagation
- `app/propagation-core/models/Wire.ts` - Simple connection data
- `app/propagation-core/models/ContactGroup.ts` - Container and router
- `app/propagation-core/types/mergeable.ts` - Example mergeable types

### React Integration  
- `app/propagation-react/hooks/usePropagationNetwork.ts` - Main React hook
- `app/components/nodes/ContactNode.tsx` - Editable node component
- `app/routes/editor.tsx` - Main editor page

## Lessons Learned

1. **Start with the simplest thing** - Two wire types, two blend modes
2. **Keep core logic pure** - No UI concerns in models
3. **Let cells be active** - Contacts handle their own propagation
4. **UUIDs everywhere** - Proper IDs from the start
5. **Test the architecture early** - Clean separation pays off

This architecture successfully implements the core propagation network concepts while maintaining flexibility for future enhancements.