# Architecture Overview

## Why Streams?

Our previous Bassline implementation required a central kernel to coordinate everything - managing state, scheduling updates, and providing APIs. This created complexity. Micro-bassline simplifies everything by using streams as the foundation.

## Core Concepts

### Streams as Foundation

```typescript
// Everything starts with a stream
const s = stream<T>()

// Streams compose naturally
s.pipe(target)
 .filter(predicate)
 .transform(fn)
 .subscribe(handler)
```

Streams provide:
- Natural async support (promises just work)
- Composable transformations
- Push-based updates (no polling)
- Automatic cleanup via subscription management

### Contacts: Information Carriers

Contacts wrap streams with propagation semantics:

```typescript
const c = contact(id, blendMode, groupId)
c.setValue(value)     // Write to stream
c.getValue()          // Read current value
c.wireTo(target)      // Connect streams
```

Key features:
- Value deduplication prevents infinite loops
- Blend modes (merge/last) for conflict resolution
- Bidirectional or directed connections
- Properties for metadata

### Groups: Hierarchical Organization

Groups provide structure and boundaries:

```typescript
const g = group(id, parentId)
g.createContact(name, blendMode, isBoundary)
g.getBoundaryContacts()  // Computed, not stored
```

Groups enable:
- Natural hierarchy (groups contain groups)
- Boundary contacts for interfaces
- Capabilities and sandboxing
- Scoped namespacing
- Natural creation of reusable components

### Runtime: The Orchestrator

The runtime is just a container, not a kernel:

```typescript
const rt = runtime(initialState, primitives)
rt.createGroup(id)
rt.setValue(groupId, contactName, value)
```

No central scheduler - propagation happens through streams.

## Why This Works

### No Impedance Mismatch

In kernel architectures, you have different layers:
- Application layer (high-level API)
- Driver layer (protocol adapters)  
- Kernel layer (coordination)
- Network layer (actual data)

With streams, it's all the same layer - data flowing through streams.

### Natural Distribution

Since everything is a stream:
- Serialize stream events → network transport
- Deserialize events → local streams
- No special distribution protocol needed

### Inherent Laziness

- Structure computed only when read
- Events generated only when subscribed
- No work done for inactive paths

### Composability

Networks can contain networks:
- Parent observes children via MGP
- Children independent of parents
- True fractal architecture

## Performance Characteristics

- **Memory**: O(contacts + wires) - no caching except where needed
- **Propagation**: O(active paths) - inactive paths cost nothing
- **Structure computation**: O(descendants) - cached and lazy
- **Serialization**: O(network size) - but can be incremental

## Comparison with Our Previous Architecture

| Aspect | Old Bassline (Kernel) | Micro-Bassline (Streams) |
|--------|----------------------|--------------------------|
| Central coordination | Required kernel | No coordination needed |
| State management | Kernel owned everything | Each contact owns its state |
| Updates | Kernel scheduled them | Streams push automatically |
| Distribution | Complex protocol layer | Just send stream events |
| Testing | Had to mock the kernel | Simple pure functions |
| Debugging | Kernel was opaque | Can observe any stream |

## The Key Insight

By making structure, events, and mutations all flow through streams, the network can fully describe and modify itself. No external coordinator needed.