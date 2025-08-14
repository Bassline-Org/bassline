# The Bassline Model

A comprehensive guide to Bassline's propagation network architecture, data model, and execution semantics.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Data Model](#data-model)
3. [Mergeable Types System](#mergeable-types-system)
4. [Reified Architecture](#reified-architecture)
5. [Execution Model](#execution-model)
6. [Capabilities System](#capabilities-system)
7. [Practical Examples](#practical-examples)

## Core Concepts

### Propagation Networks vs Dataflow

Traditional dataflow systems have directed acyclic graphs where data flows in one direction:
```
Input → Process → Output
```

Bassline's propagation networks support **bidirectional constraints** where information flows both ways:
```
Value A ←→ Constraint ←→ Value B
```

### Convergence and Stability

- **No cycle detection needed** - cycles are features, not bugs
- System converges through **change detection** - only propagates when values actually change
- **Stability** = when the scheduler's work queue is empty
- `maxIterations` is just a safety valve, not cycle protection

### Bidirectional Constraints

Example: Temperature conversion
```typescript
// Celsius and Fahrenheit contacts are bidirectionally wired
// Changing either updates the other
celsius.content = 20  // Fahrenheit automatically becomes 68
fahrenheit.content = 32  // Celsius automatically becomes 0
```

## Data Model

### Contacts

The fundamental unit of information:

```typescript
interface Contact {
  id: ContactId
  groupId: GroupId        // Contacts know their group!
  content?: unknown       // The actual value
  blendMode: BlendMode    // 'accept-last' or 'merge'
  isBoundary?: boolean    // Is this an input/output?
  boundaryDirection?: 'input' | 'output'
  name?: string          // For boundary contacts
}
```

**Key Properties:**
- Contacts are **owned by groups** (groupId)
- Boundary contacts define group interfaces
- Content can be any value, including mergeable types

### Wires

Connections between contacts:

```typescript
interface Wire {
  id: WireId
  groupId: GroupId
  fromId: ContactId    // Always contact to contact!
  toId: ContactId
  type: 'bidirectional' | 'directed'
}
```

**Important:** Wires connect contacts, not groups. Groups are connected through their boundary contacts.

### Groups

Hierarchical containers:

```typescript
interface Group {
  id: GroupId
  name: string
  parentId?: GroupId
  contactIds: ContactId[]
  wireIds: WireId[]
  subgroupIds: GroupId[]
  boundaryContactIds: ContactId[]
  primitive?: PrimitiveGadget  // If present, group is a gadget
}
```

**Group Types:**
1. **Regular Groups** - Just organization
2. **Primitive Gadgets** - Have computation (add, multiply, etc.)
3. **Composite Groups** - Contain subgroups

### Gadgets

Groups with computational behavior:

```typescript
interface PrimitiveGadget {
  id: string
  name: string
  inputs: string[]   // Names of input boundary contacts
  outputs: string[]  // Names of output boundary contacts
  activation: (inputs: Map<string, unknown>) => boolean
  body: (inputs: Map<string, unknown>) => Promise<Map<string, unknown>>
  isPure?: boolean
}
```

**Key Points:**
- Primitives are **black boxes** - code, not data
- Referenced by ID, not serialized
- Execute when activation conditions met

## Mergeable Types System

### Growing vs Shrinking Collections

Bassline includes a sophisticated type system for constraint propagation:

#### Growing Types (Union/Accumulation)

```typescript
// GrowSet - accumulates values
const tags1 = grow.set(['react', 'typescript'])
const tags2 = grow.set(['nodejs'])
// Merged: GrowSet(['react', 'typescript', 'nodejs'])

// GrowArray - concatenates
const log1 = grow.array(['event1', 'event2'])
const log2 = grow.array(['event3'])
// Merged: GrowArray(['event1', 'event2', 'event3'])

// GrowMap - recursively merges
const config1 = grow.map([['port', 3000]])
const config2 = grow.map([['host', 'localhost']])
// Merged: GrowMap([['port', 3000], ['host', 'localhost']])
```

#### Shrinking Types (Intersection/Constraint)

```typescript
// ShrinkSet - intersects values
const allowed1 = shrink.set(['read', 'write', 'delete'])
const allowed2 = shrink.set(['read', 'write'])
// Merged: ShrinkSet(['read', 'write'])

// ShrinkArray - finds common elements
const options1 = shrink.array([1, 2, 3, 4])
const options2 = shrink.array([2, 3, 4, 5])
// Merged: ShrinkArray([2, 3, 4])
```

### Blend Modes

How contacts handle incoming values:

1. **'accept-last'** - Simple replacement
   ```typescript
   contact.content = 'old'
   propagate('new')
   // Result: 'new'
   ```

2. **'merge'** - Uses mergeable type semantics
   ```typescript
   contact.content = grow.set(['a', 'b'])
   propagate(grow.set(['c']))
   // Result: GrowSet(['a', 'b', 'c'])
   ```

### Contradictions

When incompatible values merge:

```typescript
// Different scalar values
merge('hello', 'world')  // → Contradiction

// Empty intersection
merge(shrink.set(['a']), shrink.set(['b']))  // → Contradiction
```

## Reified Architecture

### Everything is Data

The network structure itself is data that can be observed and modified:

```typescript
interface Bassline {
  // Structure
  contacts: Map<ContactId, ReifiedContact>
  wires: Map<WireId, ReifiedWire>
  groups: Map<GroupId, ReifiedGroup>
  gadgets: Map<string, ReifiedGadget>
  
  // Behavior
  scheduler?: SchedulerType | ReifiedScheduler
  blendModes?: Map<string, BlendFunction>
  
  // Meta
  capabilities: Set<Capability>
  version: string
}
```

### Actions as Data

All mutations are data structures:

```typescript
type ReifiedAction = 
  | ['addContact', ReifiedContact]
  | ['removeContact', ContactId]
  | ['updateContact', ContactId, any]
  | ['addWire', ReifiedWire]
  | ['removeWire', WireId]
  | ['setScheduler', SchedulerType]
```

### Meta-Propagation

Networks can observe and modify themselves:

```typescript
// Bassline Gadget exposes network structure
const basslineGadget = {
  outputs: ['bassline'],      // Current network as data
  inputs: ['merge'],          // Actions to apply
  
  // The network observes itself!
}

// Performance monitoring through propagation
const perfMonitor = {
  inputs: ['observedBassline'],
  outputs: ['queueDepth', 'propagationRate', 'convergenceTime']
  
  // Metrics flow as normal propagation values!
}
```

## Execution Model

### Schedulers

Control how propagation happens:

```typescript
interface ReifiedScheduler {
  type: 'immediate' | 'batch' | 'custom'
  pendingTasks: Array<PropagationTask>
  processTask: (task, bassline, values) => void
}
```

**Scheduler Types:**
- **Immediate** - Process tasks as they arrive
- **Batch** - Group tasks for efficiency
- **Custom** - User-defined scheduling

### Propagation Flow

1. **Value Changes** → Create propagation tasks
2. **Tasks Queued** → Added to scheduler's pending tasks
3. **Task Processing** → Apply blend modes, update values
4. **Gadget Activation** → Check if gadgets should execute
5. **Gadget Execution** → Compute outputs, queue more tasks
6. **Stability** → Queue empty, network converged

### Change Detection

Only propagates when values actually change:
```typescript
if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
  // Queue propagation tasks
}
```

*Note: JSON.stringify is a temporary solution - proper structural equality coming*

## Capabilities System

### What Capabilities Control

```typescript
type Capability = 
  | 'bassline.observe'           // Read network structure
  | 'bassline.modify'            // Modify network via actions
  | 'bassline.spawn'             // Create sub-basslines
  | 'bassline.capabilities'      // Modify own capabilities (dangerous!)
```

### Capability Flow

- Capabilities are defined at the bassline level
- Groups inherit parent capabilities
- Gadgets check capabilities before operations

### Example: Read-Only View

```typescript
const readOnlyBassline = {
  capabilities: new Set(['bassline.observe']),
  // Can read structure but not modify
}

const editableBassline = {
  capabilities: new Set(['bassline.observe', 'bassline.modify']),
  // Can read and modify structure
}
```

## Practical Examples

### Simple Calculator Network

```typescript
// Create an add gadget
const addGroup = {
  id: 'adder',
  primitive: {
    id: 'add',
    inputs: ['a', 'b'],
    outputs: ['sum'],
    activation: (inputs) => inputs.has('a') && inputs.has('b'),
    body: async (inputs) => {
      const sum = inputs.get('a') + inputs.get('b')
      return new Map([['sum', sum]])
    }
  }
}

// Set inputs
a.content = 5
b.content = 3
// sum automatically becomes 8
```

### Constraint Solver

```typescript
// Temperature constraints from multiple sensors
const sensor1 = shrink.array([20, 21, 22, 23, 24])  // Possible values
const sensor2 = shrink.array([22, 23, 24, 25, 26])  // Another sensor

// Merged constraint
const actualTemp = merge(sensor1, sensor2)
// Result: [22, 23, 24] - intersection of possibilities
```

### Performance Monitor as Meta-Propagator

```typescript
// Monitor observes the Bassline Gadget's output
const monitor = {
  inputs: ['bassline'],  // Watches network structure
  body: async (inputs) => {
    const bassline = inputs.get('bassline')
    const queueDepth = bassline.scheduler.pendingTasks.length
    const contactCount = bassline.contacts.size
    
    return new Map([
      ['queueDepth', queueDepth],
      ['contactCount', contactCount],
      ['isStable', queueDepth === 0]
    ])
  }
}

// Metrics propagate like any other values!
```

### Self-Modifying Network

```typescript
// Network that adds contacts to itself
const selfModifier = {
  inputs: ['bassline', 'trigger'],
  outputs: ['actions'],
  body: async (inputs) => {
    if (inputs.get('trigger')) {
      const newContact = {
        id: `dynamic-${Date.now()}`,
        groupId: 'main',
        content: 'I was created dynamically!',
        blendMode: 'accept-last'
      }
      
      return new Map([
        ['actions', {
          actions: [['addContact', newContact]],
          timestamp: Date.now()
        }]
      ])
    }
  }
}

// Connect to Bassline Gadget's merge input
// Network modifies itself when triggered!
```

## Key Takeaways

1. **Cycles are Good** - The system converges naturally
2. **Everything Flows** - Even performance metrics and network structure
3. **Merge Semantics Matter** - Growing vs shrinking types enable constraint propagation
4. **Meta is Normal** - Networks observing/modifying themselves is the expected pattern
5. **Primitives are Code, Structure is Data** - Clear separation of concerns

This model enables building sophisticated constraint systems, self-modifying networks, and meta-level reasoning - all through the uniform mechanism of propagation.