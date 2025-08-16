# Do We Need Internal Contacts?

## The Question

If everything is just input/output ports and bundles, do we need "internal" contacts that aren't exposed? Or is everything just wiring between children's ports?

## Case FOR Eliminating Internal Contacts

### Everything is Just Wiring Between Ports

```typescript
// No internal contacts - just children wired together
const Adder = {
  inputs: { a: Contact('input'), b: Contact('input') },
  outputs: { sum: Contact('output') },
  children: {
    // Internal state is just a child gadget
    accumulator: {
      inputs: { value: Contact('input') },
      outputs: { value: Contact('output') }
    }
  },
  wiring: [
    // Wire inputs to accumulator
    ['inputs.a', 'children.accumulator.inputs.value'],
    // Wire accumulator to output
    ['children.accumulator.outputs.value', 'outputs.sum']
  ]
}
```

### Benefits
1. **Simpler model** - Just inputs, outputs, children
2. **Everything visible** - All state is in some child's ports
3. **Uniform** - No distinction between "internal" and "external"

## Case AGAINST (Keep Internal Contacts)

### Some Things Need Private State

```typescript
// Sometimes you need workspace that isn't exposed
const ComplexProcessor = {
  inputs: { data: Contact('input') },
  outputs: { result: Contact('output') },
  
  // Internal contacts for computation workspace
  internal: {
    temp1: Contact('internal'),
    temp2: Contact('internal'),
    cache: Contact('internal')
  },
  
  compute() {
    // Use internal contacts for multi-step computation
    this.internal.temp1.setValue(complexStep1(this.inputs.data.value))
    this.internal.temp2.setValue(complexStep2(this.internal.temp1.value))
    this.internal.cache.setValue(this.internal.temp2.value)
    this.outputs.result.setValue(finalStep(this.internal.cache.value))
  }
}
```

### Benefits
1. **Encapsulation** - Some state shouldn't be exposed
2. **Performance** - Don't need child gadgets for temporary values
3. **Clarity** - Distinguish interface from implementation

## The Middle Way: Dynamic Bundling

What if we had gadgets that can dynamically create/manage connections?

```typescript
// A multiplexer that dynamically bundles connections
const DynamicMux = {
  inputs: {
    control: Contact('input'),  // Selects which bundle
    bundle_a: { x: Contact('input'), y: Contact('input') },
    bundle_b: { x: Contact('input'), y: Contact('input') }
  },
  outputs: {
    selected: { x: Contact('output'), y: Contact('output') }
  },
  
  compute() {
    const control = this.inputs.control.value
    const source = control === 'a' ? this.inputs.bundle_a : this.inputs.bundle_b
    
    // Dynamically route the selected bundle
    this.outputs.selected.x.setValue(source.x.value)
    this.outputs.selected.y.setValue(source.y.value)
  }
}
```

Or even more dynamic - gadgets that create ports on demand:

```typescript
// A splitter that creates outputs dynamically
const DynamicSplitter = {
  inputs: {
    data: Contact('input'),
    count: Contact('input')  // How many outputs to create
  },
  outputs: {}, // Starts empty!
  
  compute() {
    const count = this.inputs.count.value
    
    // Dynamically create output ports
    for (let i = 0; i < count; i++) {
      if (!this.outputs[`out_${i}`]) {
        this.outputs[`out_${i}`] = new Contact('output')
      }
      this.outputs[`out_${i}`].setValue(this.inputs.data.value)
    }
  }
}
```

## Analysis

### If We Remove Internal Contacts

**Pros:**
- Simpler conceptual model
- Forces everything to be explicit
- Every piece of state has an address (child.port)

**Cons:**
- Need child gadgets for every temporary value
- More verbose for simple computations
- Potential performance overhead

### If We Keep Internal Contacts

**Pros:**
- Natural place for temporary/workspace values
- Better encapsulation
- More efficient for primitives

**Cons:**
- Another concept to learn
- Distinction between internal/external
- Where do internal contacts live in the model?

## My Thinking

I lean toward **removing internal contacts** if we have:

1. **Stateful child gadgets** that can hold values:
```typescript
const StateHolder = {
  inputs: { set: Contact('input') },
  outputs: { get: Contact('output') },
  state: undefined,
  compute() {
    if (this.inputs.set.changed) {
      this.state = this.inputs.set.value
    }
    this.outputs.get.setValue(this.state)
  }
}
```

2. **Dynamic port creation** for flexible wiring:
```typescript
// Gadgets can add/remove ports based on configuration
gadget.addPort('temp_1', 'input')
gadget.removePort('temp_1')
```

3. **Efficient primitives** that don't need intermediate storage:
```typescript
// For simple operations, just compute directly
const Add = {
  inputs: { a: Contact('input'), b: Contact('input') },
  outputs: { sum: Contact('output') },
  compute() {
    // No internal contacts needed
    this.outputs.sum.setValue(this.inputs.a.value + this.inputs.b.value)
  }
}
```

## The Real Question

Maybe the real question is: **Are internal contacts just an optimization?**

- Conceptually: Everything could be a child with ports
- Practically: We might want internal contacts for performance/convenience
- Implementation: Could start without them, add if needed

What do you think? Should we try building without internal contacts first and see if we need them?