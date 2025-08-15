# Pico-Bassline

A minimalist propagation network runtime with meta-programming capabilities, implemented in ~500 lines of TypeScript core.

## Table of Contents
- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Access Control](#access-control)
- [Meta-Propagation](#meta-propagation)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Architecture](#architecture)

## Overview

Pico-Bassline is a propagation network where information flows through connected contacts, with changes automatically propagating through the network. The system supports:

- **Bidirectional constraint propagation** with cycle handling
- **Meta-programming** through self-aware, self-modifying networks
- **Hierarchical composition** with groups containing groups
- **Smart wiring** with automatic direction detection
- **Memory-safe** design using WeakRef/WeakSet

## Core Concepts

### Contacts
The fundamental unit that holds and propagates values:

```typescript
const contact = group.createContact('temperature', 20)
contact.setValue(25)  // Propagates to all connected contacts
```

Each contact maintains:
- **Current value**: The latest value
- **Old value**: Previous value (one step history)
- **Connections**: Direct references to other contacts via WeakSet

### Groups
Containers that organize contacts and sub-groups. **Groups and Gadgets are the same thing** - there's no distinction:

```typescript
const circuit = new Group('my-circuit')
const input = circuit.createContact('input')
const output = circuit.createContact('output')
```

Groups can be:
- **Regular groups**: Transparent containers you can modify
- **Primitive groups**: Black boxes with compute functions

### Wiring
Contacts connect directly to each other without intermediate Wire objects:

```typescript
// Smart wiring - automatically detects valid directions
sourceContact.wireTo(targetContact)  

// Explicit modes
source.wireTo(target, WireMode.FORWARD_ONLY)   // One direction
source.wireTo(target, WireMode.BIDIRECTIONAL)  // Both directions
source.wireTo(target, WireMode.CONSTRAINT)     // Constraint propagation
```

Invalid connections throw `InvalidWiringError` rather than silently failing.

## Access Control

### Boundary Contacts
Boundary contacts are the interfaces between groups and their parents:

```typescript
const boundary = group.createContact('port', undefined, {
  boundary: true,
  internal: 'read',   // Internal contacts can only read
  external: 'write'   // Parent can only write
})
```

### Access Rules

**Within the same group:**
- Non-boundary contacts: Always fully accessible
- Boundary contacts: Respect `internal` permissions

**Parent ↔ Child:**
- Parent → Child boundary: Check `external` permissions
- Child boundary → Parent: Check `external` permissions (reverse)

### Common Patterns

```typescript
// Input port: External writes, internal reads
{
  boundary: true,
  internal: 'read',
  external: 'write'
}

// Output port: Internal writes, external reads
{
  boundary: true,
  internal: 'write',
  external: 'read'
}

// Bidirectional port
{
  boundary: true,
  internal: 'both',
  external: 'both'
}
```

## Meta-Propagation

The most powerful feature of Pico-Bassline is that **groups are self-aware and can modify themselves**. This is controlled entirely through the `meta-properties` contact.

### The Properties Contact Controls Everything

**`meta-properties` is the master control** - its value determines:
- Whether the group is primitive or transparent
- Which other meta-contacts exist
- The group's compute function (for primitives)
- Any custom user-defined properties

```typescript
// A group starts with just meta-properties
const group = new Group('example', { primitive: false })

// Setting properties.primitive = true removes other meta-contacts
group.properties.setValue({ primitive: true, compute: someFn })
// Now meta-structure, meta-dynamics, and meta-actions disappear

// Setting primitive = false brings them back
group.properties.setValue({ primitive: false })
// Now meta-structure, meta-dynamics, and meta-actions are created
```

### Meta-Contacts (Controlled by Properties)

#### `meta-properties` (Always Exists)
The master control contact that determines everything else:
```typescript
{
  primitive: boolean,     // Controls whether other meta-contacts exist
  compute?: Function,     // For primitive groups
  gatherMode?: string,    // Custom properties
  threshold?: number,     // User-defined properties
  // ... any other user properties
}
```

#### `meta-structure` (Only if not primitive)
Automatically tracks what's inside the group and how it's wired:
```typescript
{
  contacts: [
    { id: 'input', sources: [], targets: ['processor'] },
    { id: 'processor', sources: ['input'], targets: ['output'] },
    { id: 'output', sources: ['processor'], targets: [] },
    { id: 'meta-properties', sources: [], targets: [] },
    // ... other contacts
  ],
  groups: ['subgroup1', 'subgroup2', ...]
}
```

#### `meta-dynamics` (Only if not primitive)
Live stream of propagation events happening in this group and subgroups:
```typescript
[
  { type: 'propagate', from: 'input', to: 'processor', value: 42, timestamp: 1234567890 },
  { type: 'propagate', from: 'processor', to: 'output', value: 84, timestamp: 1234567891 }
]
```
**Note**: Cannot be read from within the same group (would cause infinite loop)

#### `meta-actions` (Only if not primitive)
Can be written to trigger behaviors:
```typescript
// Trigger an action from inside or from parent
actionContact.wireTo(group.actions)
actionContact.setValue({ type: 'reset', params: {...} })
```

### Meta-Programming Examples

#### Dynamic Sum with Variable Inputs
A sum gadget that handles any number of inputs:

```typescript
const dynamicSum = new Group('sum', {
  primitive: true,
  compute: (inputs, props) => {
    // Sum all non-meta inputs
    let sum = 0
    for (const key in inputs) {
      if (!key.startsWith('meta-') && key !== 'output') {
        sum += inputs[key] || 0
      }
    }
    return sum
  }
})

// Add any number of inputs - the compute function handles them all
dynamicSum.createContact('a', 10)
dynamicSum.createContact('b', 20)
dynamicSum.createContact('c', 15)
dynamicSum.createContact('output')
dynamicSum.execute() // output = 45
```

#### Properties-Driven Behavior Change
A group that switches between behaviors based on properties:

```typescript
const switchable = new Group('switchable')

// Mode selector changes the group's properties
const modeSelector = switchable.createContact('mode', 'add')

// Controller watches mode and updates properties
const controller = switchable.createGroup('controller', {
  primitive: true,
  compute: (inputs) => {
    const mode = inputs.mode || 'add'
    
    // Return different properties based on mode
    return {
      primitive: true,
      compute: mode === 'add' 
        ? (ins) => (ins.a || 0) + (ins.b || 0)
        : (ins) => (ins.a || 0) * (ins.b || 0)
    }
  }
})

// Wire mode to controller, controller output to parent's properties
controller.createContact('mode')
controller.createContact('output')
modeSelector.wireTo(controller.contacts.get('mode'))
controller.contacts.get('output').wireTo(switchable.properties)

// Now the group's behavior changes when mode changes
switchable.createContact('a', 5)
switchable.createContact('b', 3)
switchable.createContact('output')

modeSelector.setValue('add')
switchable.execute() // output = 8

modeSelector.setValue('multiply')
switchable.execute() // output = 15
```

#### Dynamic Wiring Based on Structure
A group that analyzes its own wiring topology:

```typescript
const analyzer = new Group('analyzer')

// Monitor structure changes and analyze connectivity
const monitor = analyzer.createGroup('monitor', {
  primitive: true,
  compute: (inputs) => {
    const structure = inputs.structure
    
    // Find all contacts and their connections
    const unconnected = structure.contacts.filter(c => 
      c.sources.length === 0 && c.targets.length === 0
    )
    
    const hubs = structure.contacts.filter(c => 
      c.targets.length > 3  // Contacts with many outputs
    )
    
    return {
      unconnected: unconnected.map(c => c.id),
      hubs: hubs.map(c => c.id),
      totalWires: structure.contacts.reduce((sum, c) => 
        sum + c.targets.length, 0
      )
    }
  }
})

// Wire structure to monitor
analyzer.structure.wireTo(monitor.createContact('structure'))
monitor.createContact('output')
```

### Meta-Propagation Patterns

#### 1. Properties Cascade
Properties flow down the hierarchy:
```typescript
// Parent controls child behavior
parent.createContact('config').wireTo(child.properties)
```

#### 2. Structure Observation
Watch structural changes:
```typescript
// React to new contacts being added
observer.structure.wireTo(analyzer.createContact('structure'))
```

#### 3. Dynamic Behavior
Change behavior at runtime:
```typescript
// Switch between different compute functions
modeSelector.wireTo(group.properties)
modeSelector.setValue({ 
  primitive: true, 
  compute: currentMode === 'sum' ? sumFn : multiplyFn 
})
```

#### 4. Recursive Meta
Groups can modify their own properties through feedback:
```typescript
// Self-modifying feedback loop
group.createContact('modifier').wireTo(group.properties)
```

## API Reference

### Contact

```typescript
class Contact {
  // Properties
  value: Value              // Current value
  old: Value               // Previous value
  access: ContactAccess    // Access permissions
  
  // Methods
  setValue(value: Value, from?: Contact): void
  wireTo(target: Contact, mode?: WireMode): void
  unwireFrom(target: Contact): void
  
  // Accessors
  get current(): Value           // Current value
  get pair(): [Value, Value]     // [current, old]
}
```

### Group

```typescript
class Group {
  // Properties
  contacts: Map<string, Contact>  // All contacts including meta
  groups: Map<string, Group>      // Sub-groups
  
  // Meta-contact accessors
  get properties(): Contact | undefined
  get structure(): Contact | undefined
  get dynamics(): Contact | undefined
  get actions(): Contact | undefined
  
  // Methods
  createContact(id: string, value?: Value, access?: ContactAccess): Contact
  createGroup(id: string, props?: Properties): Group
  execute(): void  // For primitive groups
}
```

### Types

```typescript
type AccessLevel = 'both' | 'read' | 'write' | 'none'

interface ContactAccess {
  boundary: boolean
  internal: AccessLevel  // Same-group access
  external: AccessLevel  // Parent access
}

enum WireMode {
  AUTO,          // Smart detection
  FORWARD_ONLY,  // Single direction
  BIDIRECTIONAL, // Both directions
  CONSTRAINT     // Constraint propagation
}
```

## Examples

### Basic Adder
```typescript
const adder = new Group('adder', primitives.add())
adder.createContact('a', 5)
adder.createContact('b', 10)
adder.createContact('output')
adder.execute()  // output = 15
```

### Feedback Loop
```typescript
const accumulator = loop('accumulator', primitives.maxMerge())
// Automatically maintains maximum value through feedback
```

### Temperature Converter
```typescript
const converter = new Group('temp-converter')

const celsius = converter.createContact('celsius', 0, {
  boundary: true,
  internal: 'both',
  external: 'both'
})

const fahrenheit = converter.createContact('fahrenheit', 32, {
  boundary: true,
  internal: 'both',
  external: 'both'
})

// Bidirectional constraint
celsius.wireTo(fahrenheit, WireMode.CONSTRAINT)
```

## Architecture

### Memory Management
- Uses `WeakRef<Group>` for parent references
- Uses `Set<WeakRef<Contact>>` for connections
- Automatic garbage collection of unreferenced contacts
- No memory leaks in cycles

### Propagation Algorithm
1. Contact value changes
2. Check if actually different (no propagation if same)
3. Update old value
4. Propagate to all targets
5. Each target checks access permissions
6. Cycle detection prevents infinite loops

### File Structure
```
src/
├── types.ts       # Type definitions (82 lines)
├── core.ts        # Contact & Group classes (410 lines)
├── combinators.ts # Patterns: loop, sequence, parallel (235 lines)
├── primitives.ts  # Basic operations (179 lines)
├── examples.ts    # Usage examples (301 lines)
└── index.ts       # Exports (38 lines)
```

## Installation

```bash
npm install
npm run build
npm test
```

## Philosophy

Pico-Bassline demonstrates that powerful propagation networks with meta-programming don't require complex machinery. By making groups self-aware through meta-contacts, we enable:

- **Self-modifying networks** that adapt their behavior
- **Dynamic topologies** that rewire themselves
- **Introspection** without special APIs
- **Uniform abstraction** where everything is just contacts and groups

The entire system is built on one rule: **"Propagate when values change"** - everything else emerges from this combined with meta-contacts.