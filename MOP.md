# Bassline Meta-Object Protocol (MOP)

## Overview

The MOP reifies propagation networks as data:
1. **Structure** - Topology of contacts, wires, and groups
2. **Dynamics** - Execution event stream (using `blendMode: 'last'`)
3. **Values** - Accessed via direct wiring to boundary contacts

## Meta-Group Protocol (MGP)

Groups can expose their children through opt-in MGP contacts:

```typescript
`${groupId}:children:structure`  // Child topology (opt-in, blendMode: 'merge')
`${groupId}:children:dynamics`   // Child events stream (opt-in, blendMode: 'last')
`${groupId}:children:actions`    // Modify children (opt-in, DANGEROUS, blendMode: 'last')
```

**Important**: MGP contacts are NOT auto-created. They require explicit opt-in via properties.

### Dynamics Events

The dynamics stream includes ALL events from children (internal and boundary):

```typescript
type DynamicsEvent = 
  | ['gadget-fired', GroupId, Map<string, any>, Map<string, any>]
  | ['value-propagated', ContactId, ContactId, any]
  | ['convergence', number]
  | ['contradiction', ContactId, any, any]
```

Reading internal events is safe - only writing/wiring changes semantics.

## Encapsulation & Safety

Properties control MGP visibility and safety:

```typescript
{
  // MGP opt-in flags
  'expose-structure': boolean,        // Enable structure contact
  'expose-dynamics': boolean,         // Enable dynamics stream
  'allow-meta-mutation': boolean,     // Enable actions (DANGEROUS!)
  
  // Granular controls
  'expose-internals': boolean,        // Include internals in structure
  'distributed-mode': boolean,        // Block all mutations for safety
  
  // Resource limits
  'max-contacts': number,
  'max-depth': number
}
```

Default: No MGP contacts exist (complete encapsulation).

### Safety Levels

1. **Production/Distributed** - No flags set, sealed groups
2. **Development/Debugging** - `expose-structure`, `expose-dynamics` only
3. **Meta-programming** - `allow-meta-mutation` (single-node only!)

## Stream Semantics

Contacts with `blendMode: 'last'` provide stream semantics:
- Each new value replaces the previous (no merging)
- Every value triggers downstream propagation
- Used for events, actions, and other ephemeral data
- Gadgets fire on each stream value

Contacts with `blendMode: 'merge'` provide constraint semantics:
- Values are merged using type-specific rules
- Only changes propagate (deduplication)
- Used for stable state and configuration

## Values Access

Values are accessed through normal propagation:
- Wire directly to boundary contacts for values
- No special values contact needed
- Internal values remain encapsulated

Example:
```typescript
// Get structure to see available boundaries
structure = readContact(`${groupId}:children:structure`)
boundaries = structure.groups.get(childId).boundaryContactIds

// Wire to boundary for its value
createWire(myContact, boundaryContactId)
```

## Properties Contact

Every group has `${groupId}:properties` contact:
- Read-only from inside (wire direction enforced)
- Writable from parent
- Uses defaultProperties when unwired

### Wire Direction

```typescript
// FROM properties TO internal (allowed, read-only)
{ fromId: `${groupId}:properties`, toId: internalId, bidirectional: false }

// FROM internal TO properties (blocked)
{ fromId: internalId, toId: `${groupId}:properties` }  // Runtime error

// FROM parent TO properties (allowed, read-write)
{ fromId: parentId, toId: `${childId}:properties`, bidirectional: true }
```

## Groups = Networks

- **Root**: Group with `parentId: null`
- **Child**: Group with `parentId: GroupId`
- One runtime manages entire hierarchy

## Actions

```typescript
type Action = 
  | ['setValue', ContactId, any]
  | ['createContact', ContactId, GroupId?, Properties?]
  | ['deleteContact', ContactId]
  | ['createWire', WireId, ContactId, ContactId, Properties?]
  | ['deleteWire', WireId]
  | ['createGroup', GroupId, GroupId?, Properties?]
  | ['deleteGroup', GroupId]
  | ['updateProperties', ContactId | WireId | GroupId, Properties]
```

## Primitives

```typescript
interface PrimitiveGadget {
  type: string
  inputs: string[]
  outputs: string[]
  activation: (inputs: Map<string, any>) => boolean
  execute: (inputs: Map<string, any>) => Map<string, any>
}
```

Core primitives (`add`, `multiply`, `equals`) remain as code.

## Hierarchy

Parents observe immediate children only:

```typescript
Parent Group
  ├── MGP contacts → observe children (if opted-in)
  ├── Child A
  └── Child B
```

### Going Meta

```typescript
function goMeta() {
  const oldRoot = findRootGroup()  // parentId === null
  const newRoot = createGroup({ parentId: null })
  oldRoot.parentId = newRoot.id
  return newRoot.id
}
```

Root is relative - any group with `parentId: null`.

## Parent-Child Control

Parents control children via properties contact:

```typescript
// Parent → Child properties
parent.wire(parentControl, `${childId}:properties`)

// Child reads properties, adapts behavior
childGadget.execute = (inputs, outputs) => {
  const props = inputs.get('properties')
  const caps = props.get('allowed-primitives')
  
  if (!caps.has('needed')) {
    outputs.set('health', 'failing')
    outputs.set('needs', Set(['needed']))
  }
}
```

## Distributed Safety

**WARNING**: `allow-meta-mutation` breaks distributed consistency!

In distributed systems:
- All nodes must run identical structure
- Structural mutations cause divergence
- Use `distributed-mode: true` to prevent mutations
- Only use meta-mutation for single-node debugging

Safe distributed configuration:
```typescript
{
  'distributed-mode': true,       // Blocks all mutations
  'expose-structure': true,       // Safe observation
  'expose-dynamics': true,        // Safe event streaming
  'allow-meta-mutation': false    // Never in distributed!
}
```

## Use Cases

**Monitoring**: Observe structure and dynamics without modification
**Debugging**: Go meta to observe, use actions carefully in dev only
**Learning**: Parent observes teacher's dynamics, applies to student
**Synchronization**: Parent keeps children aligned via properties

## Design Principles

1. **Structure and Dynamics**: Topology and behavior are data
2. **Opt-in for Safety**: MGP contacts require explicit flags
3. **Hierarchy**: Parents observe immediate children only
4. **Properties**: Read-only from inside via wire direction
5. **No External Systems**: Everything is a gadget
6. **Structure IS Semantics**: Topology defines the program

## Implementation

1. Properties contact (✅ Complete)
2. Wire direction enforcement (✅ Complete)
3. MGP contacts with opt-in flags
4. Implement goMeta()
5. Add distributed safety checks

## Summary

The MOP exposes structure and dynamics as opt-in data streams. Values flow through normal wiring to boundary contacts. Parents control children via properties. MGP contacts require explicit opt-in for safety, especially in distributed systems.

## Future Ideas

### Implementing merging semantics from 'last' blend mode
I'm not sure if it makes sense. But if we want to really strip things down as far as possible, it might make sense to implement merge rules themselves using only our stream semantics. Because all of our merge logic can be represented with a gadget that takes two inputs, and outputs a value and a signal that it's contents changed?