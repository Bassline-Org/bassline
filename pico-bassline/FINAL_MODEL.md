# Final Unified Model

## Core Concepts (Just Four!)

### 1. Contacts: Directed Ports
```typescript
class Contact {
  polarity: 'input' | 'output'
  value: any
  connections: Set<Contact>
}
```

### 2. Groups: Containers with Ports
```typescript
class Group {
  inputs: Record<string, Contact | Bundle>
  outputs: Record<string, Contact | Bundle>
  internal: Record<string, Contact | Bundle>  // Internal workspace
  children: Record<string, Group>
  // No compute function! Computation happens through children
}
```

### 3. Bundles: Named Collections of Ports
```typescript
type Bundle = Record<string, Contact | Bundle>  // Recursive!

// Bundles group related ports together
const bundle: Bundle = {
  x: Contact('input'),
  y: Contact('input'),
  z: Contact('input'),
  metadata: {  // Nested bundle!
    timestamp: Contact('input'),
    source: Contact('input')
  }
}
```

### 4. Semantic Bindings: Names → Behaviors/Structures
```typescript
type SemanticBinding = 
  | Function                    // Primitive computation
  | StructureDescription        // What to build (aka "template")
  
type Semantics = Record<string, SemanticBinding>
```

## That's It. Everything Else Emerges.

### Why Internal Contacts Matter

Internal contacts aren't just for convenience - they give semantic meaning to intermediate computations:

```typescript
// Without internal contacts - what is happening?
const Mystery = {
  inputs: { a: Contact('input'), b: Contact('input'), c: Contact('input') },
  outputs: { result: Contact('output') },
  compute() {
    const temp1 = this.inputs.a.value * this.inputs.b.value
    const temp2 = temp1 + this.inputs.c.value
    const temp3 = Math.sqrt(temp2)
    this.outputs.result.setValue(temp3)
  }
}

// With internal contacts - computation has semantic structure!
const QuadraticSolver = {
  inputs: { a: Contact('input'), b: Contact('input'), c: Contact('input') },
  outputs: { result: Contact('output') },
  internal: {
    product: Contact('internal'),      // a * b
    discriminant: Contact('internal'), // product + c
    root: Contact('internal')          // sqrt(discriminant)
  },
  compute() {
    this.internal.product.setValue(this.inputs.a.value * this.inputs.b.value)
    this.internal.discriminant.setValue(this.internal.product.value + this.inputs.c.value)
    this.internal.root.setValue(Math.sqrt(this.internal.discriminant.value))
    this.outputs.result.setValue(this.internal.root.value)
  }
}

// Now we can:
// - Observe intermediate values
// - Wire from internal contacts
// - Understand the computation structure
// - Debug step by step
```

## How Everything Works

### "Properties" → Just the `properties` input port
```typescript
group.inputs.properties.setValue({ mode: 'fast' })
```

### "Meta-contacts" → Just child gadgets reading parent state
```typescript
group.children['$structure-reader'].outputs.structure
```

### "Templates" → Just semantic bindings that describe structures
```typescript
semantics['adder'] = {
  inputs: { a: 'input', b: 'input' },
  outputs: { sum: 'output' },
  compute: semantics['add']  // Reference another binding!
}
```

### "Types" → Just shapes (which ports exist)
```typescript
// Compatible if shapes match
canConnect(a, b) {
  return a.outputs.data && b.inputs.data  // Shape check
}
```

### "Primitives" → Just dyn gadgets with runtime-bound behavior
```typescript
// A "dyn gadget" gets its meaning from semantic bindings
const DynGadget = {
  inputs: {
    semantics: Contact('input'),  // Which behavior to use
    type: Contact('input'),        // Name to look up
    ...dataInputs                  // Regular data inputs
  },
  outputs: { ...dataOutputs },
  children: {
    // The actual implementation comes from semantics!
    body: undefined  // Populated dynamically
  }
}

// When type = "add" and semantics contains add binding:
dynGadget.children.body = semantics["add"]  // Could be function or structure

// Primitives are just dyn gadgets with runtime-provided semantics
const primitive = createDynGadget("add", RUNTIME_SEMANTICS)
```

### "Wiring modes" → Just how many directed connections
```typescript
// "Bidirectional" = two directed connections
a.outputs.data.wireTo(b.inputs.data)      // Forward
b.outputs.feedback.wireTo(a.inputs.feedback)  // Backward
```

### "Access control" → Just what ports are exposed
```typescript
// Don't want external write? Don't expose input port!
const readOnly = {
  outputs: { value: Contact('output') }  // No inputs!
}
```

### "Complex data" → Just bundles of related ports
```typescript
// A 3D vector as a bundle
const vector3 = {
  inputs: {
    vec: {  // Bundle of three related inputs
      x: Contact('input'),
      y: Contact('input'),
      z: Contact('input')
    }
  },
  outputs: {
    vec: {  // Bundle of three related outputs
      x: Contact('output'),
      y: Contact('output'),
      z: Contact('output')
    }
  }
}

// A matrix as nested bundles
const matrix = {
  inputs: {
    mat: {
      row0: { x: Contact('input'), y: Contact('input'), z: Contact('input') },
      row1: { x: Contact('input'), y: Contact('input'), z: Contact('input') },
      row2: { x: Contact('input'), y: Contact('input'), z: Contact('input') }
    }
  }
}
```

### "Interfaces" → Just bundle shapes
```typescript
// RGB color interface as a bundle shape
type RGBBundle = {
  r: Contact<'input' | 'output'>
  g: Contact<'input' | 'output'>
  b: Contact<'input' | 'output'>
}

// Compatible if bundle shapes match
function canConnectBundles(a: Bundle, b: Bundle): boolean {
  // Check if all ports in bundle a have corresponding ports in bundle b
  for (const key in a) {
    if (!(key in b)) return false
    if (isContact(a[key]) && isContact(b[key])) {
      if (!canConnect(a[key], b[key])) return false
    } else if (isBundle(a[key]) && isBundle(b[key])) {
      if (!canConnectBundles(a[key], b[key])) return false
    } else {
      return false  // Type mismatch
    }
  }
  return true
}
```

## Everything is Uniform

### Dyn Gadgets: The Universal Building Block

```typescript
// Every "primitive" is actually a dyn gadget
class DynGadget extends Group {
  constructor(type: string) {
    super()
    this.inputs.type = new Contact('input')
    this.inputs.semantics = new Contact('input')
    
    // Subscribe to changes
    this.inputs.type.onChange = () => this.rebuild()
    this.inputs.semantics.onChange = () => this.rebuild()
  }
  
  rebuild() {
    const type = this.inputs.type.value
    const semantics = this.inputs.semantics.value || RUNTIME_SEMANTICS
    const binding = semantics[type]
    
    if (!binding) return
    
    if (typeof binding === 'function') {
      // Runtime executes the function for us
      this.children.body = RuntimePrimitive(binding)
    } else {
      // Build structure from binding
      this.children.body = buildFromBinding(binding, semantics)
    }
    
    // Wire body's outputs to our outputs
    wireAll(this.children.body.outputs, this.outputs)
  }
}

// Now EVERYTHING is built from dyn gadgets
function create(type: string, semantics: Semantics): Group {
  const gadget = new DynGadget(type)
  gadget.inputs.type.setValue(type)
  gadget.inputs.semantics.setValue(semantics)
  return gadget
}
```

### Higher-Order Gadgets

```typescript
// A gadget that creates other gadgets!
const GadgetFactory = new DynGadget('factory')

// It outputs structure that becomes another gadget's body
GadgetFactory.outputs.structure.wireTo(someGadget.inputs.structure)

// Now someGadget's behavior is defined by GadgetFactory's output!
```

## Examples Showing Unification

### Example 1: Everything Through Semantics

```typescript
const semantics = {
  // Primitives
  'add': (a, b) => a + b,
  'multiply': (a, b) => a * b,
  'gate': (value, open) => open ? value : undefined,
  
  // Structures (what we used to call templates)
  'adder': {
    inputs: { a: 'input', b: 'input' },
    outputs: { sum: 'output' },
    compute: function() {
      const add = this.inputs.semantics.value['add'] || ((a,b) => a+b)
      this.outputs.sum.setValue(add(this.inputs.a.value, this.inputs.b.value))
    }
  },
  
  // Meta-gadgets
  'properties-reader': {
    outputs: { properties: 'output' },
    compute: function() {
      this.outputs.properties.setValue(this.parent?.inputs.properties.value)
    }
  },
  
  // Complex compositions
  'feedback-loop': {
    inputs: { input: 'input' },
    outputs: { output: 'output' },
    children: {
      'forward': { type: 'adder' },
      'back': { type: 'multiplier' }
    },
    wiring: [
      ['input', 'forward.a'],
      ['forward.sum', 'output'],
      ['forward.sum', 'back.a'],
      ['back.product', 'forward.b']
    ]
  }
}
```

### Example 2: Self-Describing System

```typescript
// The system can describe itself using its own semantics
semantics['group'] = {
  inputs: { semantics: 'input', properties: 'input' },
  outputs: {},
  children: {},
  compute: function() {
    // A group that builds itself from semantics!
    const sem = this.inputs.semantics.value
    const props = this.inputs.properties.value
    
    if (props.type && sem[props.type]) {
      // Rebuild myself from semantic binding
      const binding = sem[props.type]
      this.rebuildFrom(binding)
    }
  }
}

// The system can now instantiate groups using itself
const metaGroup = create('group', semantics)
metaGroup.inputs.semantics.setValue(semantics)
metaGroup.inputs.properties.setValue({ type: 'adder' })
// metaGroup rebuilds itself as an adder!
```

### Example 3: Bundles for Structured Data

```typescript
// Complex data structures as bundles
semantics['rgb-processor'] = {
  inputs: {
    color: {  // Bundle for RGB
      r: 'input',
      g: 'input', 
      b: 'input'
    },
    control: {  // Bundle for control signals
      brightness: 'input',
      contrast: 'input',
      saturation: 'input'
    }
  },
  outputs: {
    color: {  // Output bundle matches input shape
      r: 'output',
      g: 'output',
      b: 'output'
    }
  },
  compute: function() {
    // Process entire bundle at once
    const color = this.inputs.color
    const ctrl = this.inputs.control
    
    this.outputs.color.r.setValue(
      color.r.value * ctrl.brightness.value
    )
    // ... etc
  }
}

// Wiring bundles - can wire entire bundle at once!
function wireBundles(sourceBundle: Bundle, targetBundle: Bundle) {
  for (const key in sourceBundle) {
    if (isContact(sourceBundle[key]) && isContact(targetBundle[key])) {
      sourceBundle[key].wireTo(targetBundle[key])
    } else if (isBundle(sourceBundle[key]) && isBundle(targetBundle[key])) {
      wireBundles(sourceBundle[key], targetBundle[key])  // Recursive!
    }
  }
}

// Now can wire complex structures easily
wireBundles(colorSource.outputs.color, processor.inputs.color)
```

### Example 4: No Special Cases Anywhere

```typescript
// Want to change how properties work? Just change the semantic binding!
semantics['properties-reader'] = {
  outputs: { properties: 'output' },
  compute: function() {
    // Custom properties logic - maybe merge from multiple sources
    const local = this.parent?.inputs.properties.value
    const global = this.parent?.inputs.globalProperties.value
    this.outputs.properties.setValue({ ...global, ...local })
  }
}

// Want to disable meta? Just don't include those bindings!
const restrictedSemantics = {
  ...semantics,
  'properties-reader': undefined,  // No properties access
  'structure-reader': undefined,    // No structure access
  'dynamics-stream': undefined      // No dynamics access
}

// Want custom wiring behavior? It's just a semantic binding!
semantics['auto-wire'] = {
  inputs: { source: 'input', target: 'input' },
  compute: function() {
    // Custom wiring logic
    const source = this.inputs.source.value
    const target = this.inputs.target.value
    
    // Smart wiring based on shapes
    for (const outName in source.outputs) {
      if (target.inputs[outName]) {
        source.outputs[outName].wireTo(target.inputs[outName])
      }
    }
  }
}
```

## The Power of Unification

By unifying everything into just **Contacts**, **Groups**, **Semantic Bindings**, and **Dyn Gadgets**:

1. **No special cases** - Even "primitives" are just dyn gadgets with runtime semantics
2. **Complete flexibility** - Any gadget can redefine any other gadget's behavior
3. **Self-describing** - Gadgets can output structures that become other gadgets
4. **Tiny core** - Maybe 100 lines for Groups/Contacts, runtime provides dyn gadget behavior
5. **Higher-order programming** - Gadgets that create gadgets that create gadgets...

This isn't just simpler - it's more powerful. When everything is uniform:
- No distinction between "primitive" and "composite" 
- Gadgets can dynamically change their implementation
- The system can modify itself at any level
- True meta-circular evaluation becomes possible

## The Final Insight

**There are no primitives, only dyn gadgets. Every computation is a gadget whose body comes from semantic bindings. Higher-order gadgets output structures that become other gadgets' bodies.**

The irreducible core:
- **Contacts** flow data directionally
- **Groups** organize contacts and children
- **Bundles** group related contacts
- **Dyn Gadgets** get their implementation from semantic bindings
- **Everything else** emerges from these four concepts

This is the ultimate unification of propagation networks.