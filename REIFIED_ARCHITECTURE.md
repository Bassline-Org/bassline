# Bassline Reified Architecture

## Vision
Replace the entire kernel/driver/worker architecture with **reified gadgets** that expose network structure and behavior as pure data flowing through contacts. Everything becomes uniform: propagation networks managing propagation networks.

## The Bassline Concept

**A "bassline" is the reified data representation of a network's structure and behavior.** It's called a bassline because it's the fundamental "track" that everything else builds upon - the base layer of reality for a propagation network.

```typescript
// The Bassline IS the reified network
type Bassline = {
  // Structure
  contacts: Map<ContactId, ReifiedContact>
  wires: Map<WireId, ReifiedWire>
  groups: Map<GroupId, ReifiedGroup>
  gadgets: Map<GadgetId, ReifiedGadget>
  
  // Behavior
  scheduler?: ReifiedScheduler
  blendModes?: Map<string, BlendFunction>
  propagationRules?: ReifiedRules
  
  // Meta
  capabilities: Set<Capability>
  version: string
}
```

Every group HAS a bassline - it's the data that defines what that group IS.

## Core Concepts

### 1. Everything is Data (The Bassline)
```typescript
// Network structure as data
type ReifiedContact = {
  id: ContactId
  groupId: GroupId  // Contacts know their group!
  content: any
  blendMode: string
  isBoundary?: boolean
  boundaryRole?: 'input' | 'output'
}

type ReifiedWire = {
  id: WireId
  fromId: ContactId  // Always contact to contact!
  toId: ContactId
  type: 'bidirectional' | 'directed'
}

type ReifiedGroup = {
  id: GroupId
  parentId?: GroupId
  name: string
  capabilities: Set<string>
}

type ReifiedNetwork = {
  contacts: Map<ContactId, ReifiedContact>
  wires: Map<WireId, ReifiedWire>
  groups: Map<GroupId, ReifiedGroup>
  gadgets: Map<GadgetId, ReifiedGadget>
}
```

### 2. Actions as Data
```typescript
// All mutations as data structures
type ReifiedAction = 
  | ['addContact', ReifiedContact]
  | ['removeContact', ContactId]
  | ['updateContact', ContactId, any]
  | ['addWire', ReifiedWire]
  | ['removeWire', WireId]
  | ['addGroup', ReifiedGroup]
  | ['setScheduler', SchedulerFn]

type ActionSet = {
  actions: ReifiedAction[]
  timestamp?: number
  source?: string
}
```

## The Three Fundamental Gadgets

### 1. Bassline Gadget (formerly "ThisNetwork")
```typescript
class BasslineGadget {
  // Exposes the current group's bassline for introspection and modification
  // SCOPED TO ITS GROUP - not global!
  boundaries = {
    // The bassline itself (output)
    bassline: Contact<Bassline>,
    
    // Actions (input) - merge to modify the bassline
    merge: Contact<ActionSet>,
    
    // Action stream (output) - for observation
    appliedActions: Contact<ActionSet>,
    
    // Meta information
    groupId: Contact<GroupId>,
    parent: Contact<GroupId | null>,
    capabilities: Contact<Set<string>>
  }
}
```

**Why "Bassline Gadget"**: This gadget exposes the group's bassline - its fundamental data representation. When you wire to this gadget, you're literally accessing the "base track" of the network.

**Key Properties:**
- Lives in every group
- Describes ONLY that group's network
- State changes through action merging
- Pure transformation: `newState = applyActions(oldState, actions)`

### 2. Dynamic Bassline Gadget (Network Instantiation)
```typescript
class DynamicBasslineGadget {
  boundaries = {
    // Input: Bassline to instantiate
    basslineDescription: Contact<Bassline>,
    inputs: Contact<Map<string, any>>,
    
    // Output: Running bassline
    runningBassline: Contact<Bassline>,
    outputs: Contact<Map<string, any>>,
    completed: Contact<boolean>,
    
    // Control
    run: Contact<boolean>,
    step: Contact<boolean>
  }
}
```

**Enables:**
- Recursion (basslines can reference themselves)
- Iteration (spawn basslines for each item)
- Dynamic computation
- "Basslines playing basslines"

### 3. Action Builder Gadgets
Various gadgets that construct ReifiedActions as data:
- ContactBuilder
- WireBuilder
- GroupBuilder
- ActionComposer

## Capability System

### Groups Have Capabilities (Part of Their Bassline)
```typescript
interface Group {
  id: GroupId
  bassline: Bassline  // Includes capabilities!
}

// Capabilities are part of the bassline
type Bassline = {
  // ... structure ...
  capabilities: Set<Capability>  // What this bassline can do
}
```

### Capability Hierarchy
```typescript
// Read-only
'bassline.observe'               // Can read the bassline
'bassline.observe.actions'       // Can see action stream

// Modification  
'bassline.modify'                // Can modify the bassline via actions
'bassline.modify.scheduler'      // Can change scheduler

// Creation
'bassline.spawn'                 // Can create sub-basslines
'bassline.compose'               // Can compose basslines

// Advanced
'bassline.reflection.full'       // Full bassline introspection
'bassline.intercession'          // Can modify actions in flight
'bassline.reify'                 // Can reify new concepts

// Dangerous
'bassline.capabilities'          // Can modify own capabilities
'bassline.meta'                  // Can modify the bassline gadget itself
```

### Capability-Based Boundaries
```typescript
// Read-only group
if (!capabilities.has('bassline.dynamicTopology')) {
  // No merge boundary - can't modify
  thisNetwork.boundaries = {
    state: Contact<ReifiedNetwork>  // Output only
    // No merge input!
  }
}
```

## How Everything Works Through Actions

### Storage
```typescript
// Storage is just a gadget watching actions
StorageGadget:
  in: thisNetwork.appliedActions → Save to disk
  out: savedActions → thisNetwork.merge (replay)
```

### History/Undo
```typescript
// History computes inverse actions
HistoryGadget:
  in: thisNetwork.appliedActions → Track history
  out: inverseActions → thisNetwork.merge (undo)
```

### Collaboration
```typescript
// Collaboration merges action streams
CollaborationGadget:
  in: [localActions, remoteActions] → Merge
  out: mergedActions → thisNetwork.merge
```

### The Flow
```
User Input → Build Action → ActionSet → ThisNetwork.merge
                                            ↓
                                       Apply Actions
                                            ↓
                                       State Update
                                            ↓
                                  ThisNetwork.appliedActions
                                            ↓
                ┌───────────────────────────┼───────────────────┐
                ↓                           ↓                   ↓
          Storage Gadget            History Gadget      Collab Gadget
```

## Recursion Through Self-Reference

```typescript
// Factorial as self-referential bassline
const factorialBassline: Bassline = {
  contacts: new Map([
    ['n', { id: 'n', content: undefined }],
    ['result', { id: 'result', content: undefined }]
  ]),
  gadgets: new Map([
    ['base', { /* check if n = 0 */ }],
    ['recurse', {
      type: 'dynamicBassline',
      inputs: {
        basslineDescription: factorialBassline,  // SELF-REFERENCE!
        inputs: { n: 'n-1' }
      }
    }],
    ['multiply', { /* n * recurse.output */ }]
  ])
}

// The bassline "plays itself" recursively!
```

## What Gets Deleted

### Completely Remove:
- Kernel class and all kernel code
- All driver interfaces and implementations
- Worker thread and worker-related code
- BrowserWorkerBridge
- ExternalInput types
- Message passing infrastructure
- UIAdapter
- Most of KernelClient

### Keep (Modified):
- Core propagation algorithm
- Contact/Wire/Group types (with groupId added)
- Scheduler concept (but as a replaceable contact value)
- React Flow UI (simplified)

## Implementation Phases

### Phase 1: Data Model Fixes (Week 1)
- Add groupId to Contact interface
- Fix boundary contact ownership
- Ensure wires only connect contacts

### Phase 2: Define Bassline Types (Week 1-2)
- Bassline as the complete reified network type
- ReifiedContact, ReifiedWire, ReifiedGroup as pure data
- ReifiedAction and ActionSet types
- Everything is part of the bassline

### Phase 3: Bassline Gadget (Week 2)
- Implement scoped to group (exposes that group's bassline)
- Bassline as output contact
- Merge as input for actions
- AppliedActions as output stream

### Phase 4: Dynamic Bassline Gadget (Week 3)
- Bassline instantiation from bassline descriptions
- Enable recursion and iteration
- Bassline spawning capabilities
- "Basslines playing basslines"

### Phase 5: Delete Kernel (Week 4)
- Remove all kernel/driver/worker code
- Everything through gadgets
- UI connects directly to gadgets

### Phase 6: Action Ecosystem (Week 5)
- Storage gadget
- History gadget
- Collaboration gadget
- Action transformers

### Phase 7: Advanced Features (Week 6)
- Custom merge policies
- Conflict resolution
- Advanced iteration patterns
- Performance optimization

## Success Metrics

1. **Code Reduction**: ~50% less code
2. **Conceptual Simplicity**: 3 core gadgets vs. 7+ layers
3. **Everything is Propagation**: Storage, history, collab all use same mechanism
4. **True Reflection**: Network can fully inspect and modify itself
5. **User Programmable**: Everything exposed as gadgets and contacts

## Key Insights

1. **Bassline is the Core Concept**: Every group has a bassline - its reified data representation
2. **Bassline Gadget is Scoped**: Each group's Bassline Gadget exposes just that group's bassline
3. **Actions Modify Basslines**: All changes are actions merging into basslines
4. **Pure Data**: Basslines are plain data constructible from within the network
5. **No Magic**: Users can build basslines just like the system does
6. **Uniform Mechanism**: Everything is just propagation through basslines

## The Musical Metaphor

The name "Bassline" is perfect because:
- It's the **fundamental track** everything else builds on
- Basslines can **play other basslines** (recursion)
- Actions are like **mixing tracks** into the bassline
- Groups **compose** their basslines from sub-basslines
- The system is **orchestrating** basslines

## The Result

A system where:
- Every group IS its bassline (reified data)
- Basslines flow through contacts
- Actions merge into basslines
- Storage records bassline changes
- History tracks bassline evolution
- Collaboration merges basslines
- Recursion is basslines playing basslines
- Everything is bassline propagation

This creates a truly reflective, self-modifying, beautifully uniform system where the metaphor matches the mechanism perfectly.