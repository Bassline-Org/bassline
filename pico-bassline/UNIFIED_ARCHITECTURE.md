# Unified Architecture: Everything is Ports

## The Final Simplification

Groups/gadgets don't have special fields for semantics, properties, or anything else. They just have input and output ports. Everything flows through contacts.

## Core Model (Ultra-Simple)

```typescript
// A Contact is just a directed connection point
class Contact {
  polarity: 'input' | 'output'
  value: any
  connections: Set<Contact>
}

// A Group is just a container with ports
class Group {
  inputs: Record<string, Contact>   // All input ports
  outputs: Record<string, Contact>  // All output ports
  children: Record<string, Group>   // Child groups/gadgets
  
  // That's it. No special fields.
}
```

## Everything Through Ports

### Properties? Just an Input Port

```typescript
// Instead of group.properties = {...}
// We have:
group.inputs.properties = Contact('input')

// Set properties by wiring to the input
configSource.wireTo(group.inputs.properties)
configSource.setValue({ primitive: true, compute: someFn })
```

### Semantics? Just an Input Port

```typescript
// Instead of group.semantics = {...}
// We have:
group.inputs.semantics = Contact('input')

// Pass custom semantics by wiring
parentSemantics.wireTo(group.inputs.semantics)
parentSemantics.setValue({
  'add': (a, b) => a + b,
  'multiply': (a, b) => a * b
})
```

### Structure? Just an Output Port

```typescript
// Instead of group.structure
// We have:
group.outputs.structure = Contact('output')

// Read structure by wiring from the output
structureReader.inputs.data.wireFrom(group.outputs.structure)
```

### Dynamics? Just an Output Port

```typescript
// Instead of group.dynamics
// We have:
group.outputs.dynamics = Contact('output')

// Subscribe to events by wiring
eventLogger.inputs.events.wireFrom(group.outputs.dynamics)
```

## How Meta Works Now

The runtime provides standard gadgets that expose internals:

```typescript
// Runtime creates a group
function createGroup(id: string) {
  const group = new Group(id)
  
  // Add standard meta-gadgets as children
  group.children['$props-reader'] = createPropertiesReader(group)
  group.children['$struct-reader'] = createStructureReader(group)
  group.children['$event-stream'] = createDynamicsStream(group)
  group.children['$action-handler'] = createActionHandler(group)
  
  // Wire their outputs to group's outputs
  group.children['$props-reader'].outputs.value.wireTo(group.outputs.properties)
  group.children['$struct-reader'].outputs.value.wireTo(group.outputs.structure)
  group.children['$event-stream'].outputs.stream.wireTo(group.outputs.dynamics)
  group.inputs.actions.wireTo(group.children['$action-handler'].inputs.action)
  
  return group
}
```

## Semantic Binding Through Ports

When a group needs to resolve a semantic binding:

```typescript
// Primitive gadget that uses semantic bindings
const adder = {
  inputs: {
    a: Contact('input'),
    b: Contact('input'),
    semantics: Contact('input')  // Semantics come in through a port!
  },
  outputs: {
    result: Contact('output')
  },
  
  compute() {
    const semantics = this.inputs.semantics.value || DEFAULT_SEMANTICS
    const addFn = semantics['add'] || ((a, b) => a + b)
    
    const a = this.inputs.a.value
    const b = this.inputs.b.value
    this.outputs.result.setValue(addFn(a, b))
  }
}
```

## Templates ARE Semantic Bindings

Templates aren't a separate concept - they're just semantic bindings that map names to structures:

```typescript
// Semantic bindings include both functions AND structures
const semantics = {
  // Function binding - executes computation
  'add': (a, b) => a + b,
  
  // Structure binding (aka "template") - describes what to build
  'adder': {
    inputs: { a: 'input', b: 'input' },
    outputs: { sum: 'output' },
    compute: (inputs) => inputs.a + inputs.b
  },
  
  // Complex structure binding
  'temperature-converter': {
    inputs: { celsius: 'input', fahrenheit: 'input' },
    outputs: { celsius: 'output', fahrenheit: 'output' },
    children: {
      'c-to-f': { type: 'multiply-add', scale: 9/5, offset: 32 },
      'f-to-c': { type: 'subtract-multiply', offset: 32, scale: 5/9 }
    }
  },
  
  // Recursive structure binding (references other bindings)
  'multiplier': {
    type: 'adder',  // References the 'adder' binding!
    compute: (inputs) => inputs.a * inputs.b  // Override compute
  }
}

// When instantiating, we just look up the name in semantic bindings
function instantiate(type: string, params?: any) {
  const binding = semantics[type]
  
  if (typeof binding === 'function') {
    // It's a function - create a primitive gadget
    return { compute: binding, ...params }
  } else {
    // It's a structure - build it
    return buildStructure(binding, params)
  }
}
```

## Benefits of Everything-as-Ports

### 1. Uniform Interface
- No special fields to remember
- Everything flows through contacts
- Same wiring mechanism for all data

### 2. Maximum Flexibility  
- Can wire properties from anywhere
- Can multiplex/demultiplex any data
- Can transform any data through intermediate gadgets

### 3. Visible Data Flow
- Can see where properties come from
- Can trace semantics through the network
- Can intercept/modify anything

### 4. Composable
- Properties gadget can be wired to properties
- Semantics can flow through transformers
- Everything can be routed, filtered, combined

## Example: Self-Configuring Network

```typescript
// Configuration flows through the network itself
const network = createGroup('self-configuring')

// Config source generates configuration
const configGen = network.children['config-gen'] = {
  outputs: {
    config: Contact('output')
  },
  compute() {
    // Generate config based on... anything
    this.outputs.config.setValue({
      mode: 'optimized',
      semantics: GPU_SEMANTICS
    })
  }
}

// Router distributes config to children
const router = network.children['router'] = {
  inputs: {
    config: Contact('input')
  },
  outputs: {
    child1_config: Contact('output'),
    child2_config: Contact('output')
  },
  compute() {
    const config = this.inputs.config.value
    // Route different configs to different children
    this.outputs.child1_config.setValue(config)
    this.outputs.child2_config.setValue({ ...config, mode: 'debug' })
  }
}

// Wire config flow
configGen.outputs.config.wireTo(router.inputs.config)
router.outputs.child1_config.wireTo(network.children['child1'].inputs.properties)
router.outputs.child2_config.wireTo(network.children['child2'].inputs.properties)

// Configuration flows through the network!
```

## Core Implementation (Tiny!)

```typescript
class Contact {
  constructor(public polarity: 'input' | 'output') {}
  value: any
  connections = new Set<Contact>()
  
  wireTo(other: Contact) {
    if (this.polarity !== 'output' || other.polarity !== 'input') {
      throw new Error('Can only wire output to input')
    }
    this.connections.add(other)
  }
  
  setValue(val: any) {
    if (this.value !== val) {
      this.value = val
      if (this.polarity === 'output') {
        for (const target of this.connections) {
          target.setValue(val)
        }
      }
    }
  }
}

class Group {
  inputs: Record<string, Contact> = {}
  outputs: Record<string, Contact> = {}
  children: Record<string, Group> = {}
  
  compute?(): void  // Optional compute for primitives
  
  addInput(name: string): Contact {
    return this.inputs[name] = new Contact('input')
  }
  
  addOutput(name: string): Contact {
    return this.outputs[name] = new Contact('output')
  }
}

// That's the entire core!
```

## Bidirectional from Directed Primitives

Even though contacts are directed at the primitive level, we can build bidirectional behavior:

### Bidirectional "Wire" Pattern

```typescript
// A bidirectional connection is just two directed connections
function wireBidirectional(a: Group, b: Group, name: string) {
  // Forward direction
  a.outputs[name].wireTo(b.inputs[name])
  // Backward direction  
  b.outputs[name + '_back'].wireTo(a.inputs[name + '_back'])
}

// Or as a gadget that provides bidirectional interface
const BiWire = {
  inputs: {
    left: Contact('input'),
    right: Contact('input')
  },
  outputs: {
    left: Contact('output'),
    right: Contact('output')
  },
  compute() {
    // Forward what comes from left to right output
    this.outputs.right.setValue(this.inputs.left.value)
    // Forward what comes from right to left output
    this.outputs.left.setValue(this.inputs.right.value)
  }
}
```

### Constraint Pattern

```typescript
// Temperature converter with bidirectional constraint
const TempConverter = {
  inputs: {
    celsius: Contact('input'),
    fahrenheit: Contact('input')
  },
  outputs: {
    celsius: Contact('output'),
    fahrenheit: Contact('output')
  },
  compute() {
    // If celsius changed, compute fahrenheit
    if (this.inputs.celsius.changed) {
      const c = this.inputs.celsius.value
      this.outputs.fahrenheit.setValue(c * 9/5 + 32)
    }
    // If fahrenheit changed, compute celsius
    if (this.inputs.fahrenheit.changed) {
      const f = this.inputs.fahrenheit.value
      this.outputs.celsius.setValue((f - 32) * 5/9)
    }
  }
}

// Usage feels bidirectional even though wires are directed
tempConverter.inputs.celsius.setValue(100)
console.log(tempConverter.outputs.fahrenheit.value) // 212

tempConverter.inputs.fahrenheit.setValue(32)
console.log(tempConverter.outputs.celsius.value) // 0
```

### The Key Insight

At the **physical level** (wires), everything is directed:
- Clear data flow direction
- No ambiguity about what connects to what
- Simple propagation rules

At the **logical level** (gadgets), we can have any behavior:
- Bidirectional constraints
- Mutual recursion
- Feedback loops
- Any propagation pattern

This is like how:
- Logic gates are directed, but we can build bidirectional buses
- TCP is bidirectional, but built on directed IP packets
- Function calls go one way, but we can build coroutines

### Example: Shared State Pattern

```typescript
// Multiple gadgets sharing state bidirectionally
const SharedState = {
  inputs: {
    client1_write: Contact('input'),
    client2_write: Contact('input'),
    client3_write: Contact('input')
  },
  outputs: {
    client1_read: Contact('output'),
    client2_read: Contact('output'),
    client3_read: Contact('output')
  },
  state: undefined,
  compute() {
    // Accept writes from any client
    const newValue = 
      this.inputs.client1_write.value ??
      this.inputs.client2_write.value ??
      this.inputs.client3_write.value
    
    if (newValue !== undefined && newValue !== this.state) {
      this.state = newValue
      // Broadcast to all clients
      this.outputs.client1_read.setValue(this.state)
      this.outputs.client2_read.setValue(this.state)
      this.outputs.client3_read.setValue(this.state)
    }
  }
}

// Each client has bidirectional access through paired directed connections
```

## Conclusion

By making everything flow through ports:
1. **No special cases** - semantics, properties, structure all just ports
2. **Visible data flow** - can see and wire everything
3. **Maximum flexibility** - anything can come from anywhere
4. **Tiny core** - just Contact and Group, nothing else
5. **Uniform model** - learn one thing (ports), use everywhere
6. **Directed primitive, any behavior logical** - Simple directed wires compose into complex bidirectional patterns

This is the ultimate simplification - everything is just data flowing through directed ports, but those directed primitives can build any higher-level behavior including bidirectional constraints.