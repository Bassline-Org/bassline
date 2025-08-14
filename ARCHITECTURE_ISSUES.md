# Bassline Architecture Issues & Solutions

## Core Problems Identified

### 1. Data Model Issues

#### Contacts Don't Know Their Groups
**Problem**: Contacts don't have a `groupId` field, requiring O(n) searches through all groups to find a contact's parent.

```typescript
// Current (BAD):
function findGroupForContact(contactId: string): string | undefined {
  for (const [groupId, groupState] of state.groups) {
    if (groupState.contacts.has(contactId)) {
      return groupId
    }
  }
}

// Should be:
interface Contact {
  id: ContactId
  groupId: GroupId  // Contact knows its group!
  content: any
  // ...
}
```

#### Boundary Contacts Are Confused
**Problem**: Boundary contacts are treated inconsistently - sometimes as part of parent, sometimes as part of child.

**Correct Model**:
- Boundary contacts are the **interface** of a group
- They are **owned** by the group they expose (not the parent)
- They are the **only** way to connect across group boundaries
- Internal contacts are private to the group

```typescript
// Correct ownership model:
ParentGroup
├── ContactA (groupId: "parent")
├── MathGadget (id: "gadget1")
│   ├── InputX (groupId: "gadget1", isBoundary: true)  // Owned by gadget!
│   ├── InputY (groupId: "gadget1", isBoundary: true)
│   └── Output (groupId: "gadget1", isBoundary: true)
└── Wires
    └── Wire1 (from: ContactA, to: MathGadget.InputX)  // Contact to contact!
```

### 2. UI Integration Problems

#### Wires Don't Connect Contacts to Contacts
**Problem**: UI treats gadgets as atomic nodes and remaps wires to point to gadget nodes instead of boundary contacts.

```typescript
// Current (WRONG):
const edge = {
  source: gadgetNodeId,  // Wrong! Should be contact
  target: otherNodeId,
  sourceHandle: boundaryContactId  // Hack!
}

// Should be:
const edge = {
  source: boundaryContactId,  // Direct contact-to-contact
  target: otherContactId
}
```

**Solution**: 
- Always wire contact-to-contact
- Show boundary contacts as real nodes (possibly grouped visually)
- No wire remapping needed

### 3. Event System Issues

#### Primitive Subscription Mechanism
**Problem**: Current subscription is just a Set of callbacks with no filtering.

```typescript
// Current:
const subscribers = new Set<(changes: Change[]) => void>()
// Everyone gets everything!

// Should leverage JavaScript:
class PropagationEventEmitter extends EventTarget {
  emit(change: Change) {
    // Specific events
    this.dispatchEvent(new CustomEvent(`contact:${change.contactId}`, { detail: change }))
    this.dispatchEvent(new CustomEvent(`group:${change.groupId}`, { detail: change }))
  }
}
```

### 4. Too Many Abstraction Layers

**Current Flow**:
```
UI Component 
  → React Router action/fetcher
    → KernelClient
      → BrowserWorkerBridge
        → Worker postMessage
          → Kernel
            → Scheduler
              → PropagationNetwork
```

Each layer transforms data differently, making debugging extremely difficult.

## Proposed Solutions

### Phase 1: Fix Core Data Model
1. Add `groupId` to Contact interface
2. Clarify boundary contact ownership
3. Ensure consistent data flow

### Phase 2: Fix UI Wiring
1. Show boundary contacts as real contacts
2. Remove wire remapping
3. Simplify React Flow integration

### Phase 3: Improve Event System
1. Build JavaScript-specific event layer
2. Keep propagation core platform-agnostic
3. Add scoped subscriptions and filtering

### Phase 4: Simplify Architecture
1. Reduce abstraction layers
2. Consider moving propagation to main thread
3. Make Worker optional for heavy computation only

## Key Principles

1. **Contacts Always Know Their Group** - No searching needed
2. **Wires Only Connect Contacts** - No special cases for gadgets
3. **Boundaries Are Group Interfaces** - Owned by the group they expose
4. **Platform-Agnostic Core, Platform-Specific Integration** - Use JavaScript's strengths in JS implementation
5. **Fewer Layers, Clearer Data Flow** - Each layer should have a clear purpose

## Architecture Decision Record

### Why These Problems Exist
- Started with simple model, complexity grew organically
- Tried to make gadgets "look nice" in UI at expense of model clarity
- Over-abstracted for platform independence, lost JavaScript advantages
- Worker boundary added complexity without clear benefits at current scale

### Why Fix Now
- Current bugs (parentId, wire deletion) stem from these issues
- Adding features (collaboration, persistence) will compound problems
- Clean architecture enables future growth
- Technical debt is manageable now, won't be later