# Semantic Bindings in Pico-Bassline: A Design Document

## Executive Summary

This document proposes extending Pico-Bassline with **semantic bindings** - a system where groups can redefine the behavior of primitives for their children. This enables the same propagation network to execute under different semantic interpretations (JavaScript, SQL, GPU, etc.) by changing its context, achieving true stage polymorphism as described in Nada Amin's "Collapsing Towers of Interpreters."

## The Problem

Currently, primitive gadgets have fixed implementations:
```typescript
const adder = new Group('adder', {
  primitive: true,
  compute: (inputs) => inputs.a + inputs.b  // Always JavaScript addition
})
```

This limits our ability to:
1. Compile networks to different targets
2. Optimize based on execution context
3. Support domain-specific semantics
4. Achieve true meta-circular evaluation

## The Solution: Hierarchical Semantic Bindings

### Core Concepts

1. **Primitives as Names**: Primitives reference operations by name, not implementation
2. **Semantic Bindings**: Groups provide mappings from names to implementations
3. **Hierarchical Resolution**: Children inherit parent semantics, can override
4. **Late Binding**: Implementation resolved at execution time
5. **Stage Polymorphism**: Same operation can execute or lift based on context

### Design

```typescript
// Semantic bindings can be functions OR gadget templates
type SemanticBinding = 
  | ((inputs: any, props?: any) => any)  // Function (for true primitives)
  | StructureData                         // Gadget template (for late-bound gadgets)

interface Properties {
  primitive?: boolean  // True = host-implemented, False = has structure
  type?: string       // Name of operation (for late binding)
  bound?: boolean     // True = structure from parent, False = own structure
  semantics?: { [name: string]: SemanticBinding }  // Semantic bindings
  lift?: boolean      // Stage control
}
```

## How It Works

### 1. Defining Primitives by Name

Instead of providing implementations, primitives just declare their type:

```typescript
const adder = new Group('adder', {
  primitive: true,
  type: 'add'  // Just a name, no implementation!
})
```

### 2. Groups Provide Semantic Bindings

Parent groups define how primitives behave:

```typescript
const jsContext = new Group('javascript-context', {
  semantics: {
    'add': (inputs) => inputs.a + inputs.b,
    'multiply': (inputs) => inputs.a * inputs.b,
    'concat': (inputs) => inputs.a + inputs.b  // String concat
  }
})

const sqlContext = new Group('sql-context', {
  semantics: {
    'add': (inputs) => `(${inputs.a} + ${inputs.b})`,
    'multiply': (inputs) => `(${inputs.a} * ${inputs.b})`,
    'concat': (inputs) => `CONCAT(${inputs.a}, ${inputs.b})`
  }
})
```

### 3. Hierarchical Resolution

Semantics cascade down the group hierarchy:

```
root (JS semantics)
├── groupA (inherits JS)
│   └── primitive (uses JS add)
└── groupB (SQL semantics) 
    └── primitive (uses SQL add)
```

### 4. Late Binding at Execution

```typescript
class Group {
  execute() {
    if (this.primitive && this.type) {
      const binding = this.resolveBinding(this.type)
      if (binding) {
        const inputs = this.gatherInputs()
        const output = binding(inputs, this.properties?.value)
        this.contacts.get('output')?.setValue(output)
      }
    }
  }
  
  resolveBinding(type: string): Function | undefined {
    // Check own semantics
    const ownSemantics = this.properties?.value?.semantics
    if (ownSemantics?.[type]) {
      return ownSemantics[type]
    }
    
    // Check parent semantics
    if (this.parent) {
      return this.parent.resolveBinding(type)
    }
    
    // Fall back to host semantics
    return HOST_SEMANTICS[type]
  }
}
```

## Primitives vs Late-Bound Gadgets

A key distinction in the system:

### True Primitives (Host-Implemented)
These are black boxes implemented in the host language with no visible internal structure:

```typescript
const adder = new Group('adder', {
  primitive: true,
  compute: (inputs) => inputs.a + inputs.b  // JavaScript implementation
})
```

### Late-Bound Gadgets (Template-Based)
These have internal structure, but it comes from the parent's semantic bindings:

```typescript
const adder = new Group('adder', {
  primitive: false,  // NOT a primitive
  type: 'add',       // References a template
  bound: true        // Structure from parent
})
```

### Gadget Templates as Semantic Bindings

Semantic bindings can provide gadget structures, not just functions:

```typescript
const semantics = {
  // Function binding (for true primitives)
  'host-add': (inputs) => inputs.a + inputs.b,
  
  // Template binding (for late-bound gadgets)
  'add': {
    contacts: [
      { id: 'a', sources: [], targets: ['compute'] },
      { id: 'b', sources: [], targets: ['compute'] },
      { id: 'compute', sources: ['a', 'b'], targets: ['output'] },
      { id: 'output', sources: ['compute'], targets: [] }
    ],
    groups: [],
    properties: { primitive: true, type: 'host-add' }
  }
}
```

### Dynamic Materialization

Late-bound gadgets materialize their structure from parent bindings:

```typescript
class Group {
  materialize() {
    if (this.bound && this.type) {
      const template = this.parent?.resolveBinding(this.type)
      if (template && typeof template !== 'function') {
        this.applyTemplate(template)
      }
    }
  }
  
  applyTemplate(template: StructureData) {
    // Create contacts from template
    for (const contact of template.contacts) {
      this.createContact(contact.id)
    }
    
    // Wire according to template
    for (const contact of template.contacts) {
      const source = this.contacts.get(contact.id)
      for (const targetId of contact.targets) {
        const target = this.contacts.get(targetId)
        source?.wireTo(target)
      }
    }
  }
}
```

### The Power: Adaptive Implementation

Structure can change when parent's bindings change:

```typescript
// Parent provides one implementation
parent.properties.setValue({
  semantics: {
    'compute': simpleTemplate
  }
})
child.materialize()  // Gets simple structure

// Parent switches to optimized implementation
parent.properties.setValue({
  semantics: {
    'compute': vectorizedTemplate
  }
})
child.materialize()  // Structure updates to vectorized version!
```

This enables gadgets that adapt their implementation based on context, performance, or any other criteria.

## Stage Polymorphism with Semantic Bindings

### Lifting Under Different Semantics

When `lift: true`, semantic bindings determine the lifted representation:

```typescript
const liftedSQL = new Group('sql-compiler', {
  lift: true,
  semantics: {
    'add': (inputs) => ({ 
      type: 'sql_expr',
      op: '+',
      args: [inputs.a, inputs.b]
    }),
    'multiply': (inputs) => ({
      type: 'sql_expr', 
      op: '*',
      args: [inputs.a, inputs.b]
    })
  }
})

// Child primitives now produce SQL AST nodes instead of executing
const child = liftedSQL.createGroup('computation', {
  primitive: true,
  type: 'add'
})
child.execute()  // Returns SQL expression, not computed value!
```

### Mixed-Stage Execution

Different parts of the network can be at different stages:

```typescript
const app = new Group('application')

// Interpreted region (stage 0)
const dynamic = app.createGroup('dynamic', {
  lift: false,
  semantics: JS_SEMANTICS
})

// Compiled region (stage 1)
const compiled = app.createGroup('compiled', {
  lift: true,
  semantics: COMPILER_SEMANTICS
})

// They can interact! Compiled produces expressions that flow to dynamic
```

## Use Cases

### 1. Multi-Target Compilation

```typescript
function compileNetwork(network: Group, target: 'js' | 'sql' | 'gpu') {
  const compiler = new Group('compiler', {
    lift: true,
    semantics: SEMANTIC_MAPS[target]
  })
  
  compiler.adoptGroup(network)
  network.execute()
  return network.lifted.value  // Target-specific AST
}
```

### 2. JIT Optimization

```typescript
// Monitor hot paths
const monitor = new Group('jit-monitor', {
  semantics: {
    'add': createProfiledBinding('add', (a, b) => a + b)
  }
})

// When hot, switch to optimized semantics
function createProfiledBinding(name: string, impl: Function) {
  let callCount = 0
  return (inputs) => {
    callCount++
    if (callCount > THRESHOLD) {
      // Switch to compiled version
      this.parent.properties.setValue({
        lift: true,
        semantics: OPTIMIZED_SEMANTICS
      })
    }
    return impl(inputs)
  }
}
```

### 3. Domain-Specific Languages

```typescript
// React component semantics
const reactSemantics = {
  'element': (inputs) => React.createElement(inputs.type, inputs.props),
  'render': (inputs) => ReactDOM.render(inputs.element, inputs.container),
  'state': (inputs) => useState(inputs.initial)
}

// Database semantics
const dbSemantics = {
  'select': (inputs) => `SELECT ${inputs.fields} FROM ${inputs.table}`,
  'insert': (inputs) => `INSERT INTO ${inputs.table} VALUES (${inputs.values})`,
  'join': (inputs) => `${inputs.left} JOIN ${inputs.right} ON ${inputs.condition}`
}
```

### 4. Semantic Migration

Networks can migrate between semantic contexts at runtime:

```typescript
// Start on CPU
network.parent = cpuContext  // Uses CPU semantics

// Detect parallel workload
if (isParallelizable(network)) {
  // Migrate to GPU
  network.parent = gpuContext  // Now uses GPU semantics!
}
```

## Implementation Benefits

### 1. True Meta-Circular Evaluation
The propagation network can interpret itself with different semantics:
```typescript
const metaInterpreter = new Group('meta', {
  semantics: PROPAGATION_SEMANTICS  // Semantics for propagation itself!
})
```

### 2. Zero-Cost Abstractions
Through lifting and semantic specialization, abstractions compile away:
```typescript
// High-level abstraction
const query = db.select('users').where('age', '>', 18)

// Compiles to efficient SQL with no overhead
"SELECT * FROM users WHERE age > 18"
```

### 3. Retargetable Networks
Same network runs everywhere:
- Browser: JavaScript semantics
- Server: Native semantics
- Database: SQL semantics
- GPU: Shader semantics

### 4. Live Code Evolution
Networks can evolve their semantics based on runtime behavior:
```typescript
// Semantics that adapt based on data
const adaptive = {
  'add': (inputs) => {
    if (typeof inputs.a === 'string') {
      return inputs.a + inputs.b  // String concat
    } else {
      return inputs.a + inputs.b  // Numeric add
    }
  }
}
```

## The Killer Feature: Self-Optimizing Networks

Combining semantic bindings with the `meta-dynamics` stream enables networks that optimize themselves:

```typescript
// Monitor watches execution patterns
const optimizer = new Group('optimizer', {
  primitive: true,
  compute: (inputs) => {
    const events = inputs.dynamics  // Stream of propagation events
    const patterns = analyzePatterns(events)
    
    // Hot path detected - switch to compiled semantics
    if (patterns.hot && patterns.type === 'arithmetic') {
      return {
        lift: true,  // Switch to compilation
        semantics: VECTORIZED_SEMANTICS  // Use SIMD operations
      }
    }
    
    // Cold path - stay interpreted for flexibility
    return { lift: false, semantics: JS_SEMANTICS }
  }
})

// Wire to sibling's properties
hotGroup.dynamics.wireTo(optimizer.createContact('dynamics'))
optimizer.createContact('output').wireTo(hotGroup.properties)

// Network literally optimizes itself while running!
```

## Comparison with Amin's Model

This achieves the key properties from "Collapsing Towers of Interpreters":

1. **Stage Polymorphism**: Operations behave differently at different stages
2. **Semantic Redefinition**: Meta-level can redefine object-level operations
3. **Tower Collapse**: Through lifting, multiple interpretation levels collapse
4. **User-Defined Semantics**: Not limited to host language semantics

The key difference is that our model is based on propagation rather than traditional evaluation, which gives us:
- **Live Updates**: Semantic changes propagate immediately
- **Partial Evaluation**: Some parts can be lifted while others execute
- **Observable Computation**: All evaluation is visible through meta-contacts

## Implementation Plan

### Phase 1: Core Types and Interfaces
- Add `SemanticBinding` type
- Add `type` field for primitive operations
- Add `semantics` field to Properties
- Keep existing `lift` field for stage control

### Phase 2: Modify Group Class
- Implement `resolveBinding()` for hierarchical lookup
- Update `execute()` to use late binding
- Support semantic inheritance from parents

### Phase 3: Host Semantics
- Define default JavaScript implementations
- Provide common operations (arithmetic, logic, string, array)
- Create semantic binding helpers

### Phase 4: Lifting Integration
- Modify lifting to use semantic bindings
- Support mixed-stage execution
- Handle semantic context in lifted expressions

### Phase 5: Examples and Tests
- Multi-target compilation examples
- JIT optimization demonstration
- Comprehensive test coverage

## Open Questions

1. **Semantic Composition**: How do multiple semantic bindings compose?
   - Override? Merge? Layer?

2. **Type Safety**: How do we ensure semantic compatibility?
   - Runtime checks? Static analysis? Schema validation?

3. **Performance**: What's the overhead of late binding?
   - Can we cache resolutions? Inline hot paths?

4. **Debugging**: How do we debug across semantic boundaries?
   - Semantic stack traces? Cross-compilation source maps?

5. **Semantic Versioning**: How do we handle semantic evolution?
   - Can old networks run with new semantics?

## Conclusion

Semantic bindings transform Pico-Bassline from a propagation network into a **universal computation fabric** that can:
- Execute under any semantics
- Compile to any target
- Optimize itself through semantic specialization
- Support true stage polymorphic programming

This isn't just an incremental feature - it's a fundamental capability that could make propagation networks the most flexible computation model available. By combining:

1. **Uniform Propagation**: Everything flows through the same mechanism
2. **Semantic Bindings**: Operations defined by context
3. **Stage Polymorphism**: Same code, different stages
4. **Meta-Observation**: Networks observe themselves

We get a system that can:
- **Run anywhere**: From browsers to GPUs to quantum computers
- **Optimize itself**: JIT compilation based on usage patterns
- **Define new languages**: DSLs are just semantic bindings
- **Bootstrap itself**: The network can compile itself

The moat isn't just performance or features - it's that propagation networks with semantic bindings can become **anything**.

## Base Semantics VM Layer

To bootstrap the system, we need a minimal set of host-implemented primitives that everything else builds on. This is our "VM instruction set" for propagation networks.

### Core Primitive Categories

#### 1. Value Manipulation
```typescript
const VALUE_OPS = {
  'identity': (inputs) => inputs.value,
  'constant': (inputs, props) => props.value,
  'select': (inputs) => inputs.condition ? inputs.true : inputs.false,
}
```

#### 2. Arithmetic (Polymorphic)
```typescript
const ARITHMETIC_OPS = {
  'add': (inputs) => {
    const a = inputs.a, b = inputs.b
    if (typeof a === 'number') return a + b
    if (typeof a === 'string') return a + b
    if (Array.isArray(a)) return [...a, ...b]
    return undefined
  },
  'multiply': (inputs) => inputs.a * inputs.b,
  'subtract': (inputs) => inputs.a - inputs.b,
  'divide': (inputs) => inputs.a / inputs.b,
  'modulo': (inputs) => inputs.a % inputs.b,
  'negate': (inputs) => -inputs.value,
}
```

#### 3. Comparison
```typescript
const COMPARISON_OPS = {
  'equal': (inputs) => inputs.a === inputs.b,
  'not-equal': (inputs) => inputs.a !== inputs.b,
  'less-than': (inputs) => inputs.a < inputs.b,
  'greater-than': (inputs) => inputs.a > inputs.b,
  'less-equal': (inputs) => inputs.a <= inputs.b,
  'greater-equal': (inputs) => inputs.a >= inputs.b,
}
```

#### 4. Logic
```typescript
const LOGIC_OPS = {
  'and': (inputs) => inputs.a && inputs.b,
  'or': (inputs) => inputs.a || inputs.b,
  'not': (inputs) => !inputs.value,
  'xor': (inputs) => !!(inputs.a ^ inputs.b),
}
```

#### 5. Data Structure Operations
```typescript
const STRUCTURE_OPS = {
  // Object operations
  'get-field': (inputs) => inputs.object?.[inputs.field],
  'set-field': (inputs) => ({ ...inputs.object, [inputs.field]: inputs.value }),
  'has-field': (inputs) => inputs.field in (inputs.object || {}),
  'keys': (inputs) => Object.keys(inputs.object || {}),
  
  // Array operations  
  'length': (inputs) => inputs.array?.length || 0,
  'index': (inputs) => inputs.array?.[inputs.index],
  'push': (inputs) => [...(inputs.array || []), inputs.value],
  'pop': (inputs) => inputs.array?.slice(0, -1) || [],
  'slice': (inputs) => inputs.array?.slice(inputs.start, inputs.end) || [],
  'concat': (inputs) => [...(inputs.a || []), ...(inputs.b || [])],
}
```

#### 6. Type Operations
```typescript
const TYPE_OPS = {
  'typeof': (inputs) => typeof inputs.value,
  'is-number': (inputs) => typeof inputs.value === 'number',
  'is-string': (inputs) => typeof inputs.value === 'string',
  'is-boolean': (inputs) => typeof inputs.value === 'boolean',
  'is-array': (inputs) => Array.isArray(inputs.value),
  'is-object': (inputs) => typeof inputs.value === 'object' && !Array.isArray(inputs.value),
  'to-string': (inputs) => String(inputs.value),
  'to-number': (inputs) => Number(inputs.value),
  'parse-json': (inputs) => JSON.parse(inputs.value),
  'stringify-json': (inputs) => JSON.stringify(inputs.value),
}
```

#### 7. Control Flow (Special)
```typescript
const CONTROL_OPS = {
  // These might need special handling for propagation
  'gate': (inputs) => inputs.condition ? inputs.value : undefined,
  'switch': (inputs) => inputs.cases?.[inputs.selector],
  'merge': (inputs) => inputs.a ?? inputs.b,  // First non-undefined
}
```

#### 8. Meta Operations
```typescript
const META_OPS = {
  // Operations on gadget structures themselves
  'lift': (inputs, props) => {
    // Convert value to expression
    return { type: 'literal', value: inputs.value }
  },
  'apply': (inputs) => {
    // Execute lifted expression
    if (inputs.expr?.type === 'literal') return inputs.expr.value
    // ... handle other expression types
  },
  'quote': (inputs) => {
    // Prevent evaluation - return as-is
    return { quoted: true, value: inputs.value }
  },
  'unquote': (inputs) => {
    // Force evaluation of quoted value
    return inputs.value?.quoted ? inputs.value.value : inputs.value
  },
}
```

### Combining Base Semantics

```typescript
const HOST_SEMANTICS = {
  ...VALUE_OPS,
  ...ARITHMETIC_OPS,
  ...COMPARISON_OPS,
  ...LOGIC_OPS,
  ...STRUCTURE_OPS,
  ...TYPE_OPS,
  ...CONTROL_OPS,
  ...META_OPS,
}
```

### Bootstrap Strategy

1. **Phase 1**: Implement only HOST_SEMANTICS in TypeScript
2. **Phase 2**: Build higher-level operations as gadget templates using base ops
3. **Phase 3**: Define domain-specific semantics on top of base layer
4. **Phase 4**: Self-host by implementing base ops as gadget templates

### The Minimal Set

If we want the absolute minimum to bootstrap everything else:

```typescript
const MINIMAL_VM = {
  // Data
  'identity': (inputs) => inputs.value,
  'select': (inputs) => inputs.condition ? inputs.true : inputs.false,
  
  // Logic  
  'equal': (inputs) => inputs.a === inputs.b,
  'not': (inputs) => !inputs.value,
  
  // Structure
  'get-field': (inputs) => inputs.object?.[inputs.field],
  'set-field': (inputs) => ({ ...inputs.object, [inputs.field]: inputs.value }),
  
  // Meta
  'lift': (inputs) => ({ type: 'expr', value: inputs.value }),
  'apply': (inputs) => inputs.expr?.value,
}
```

Everything else can be built from these primitives through composition and lifting!

### Design Principles

1. **Polymorphic**: Operations work on multiple types when sensible
2. **Pure**: No side effects, only transformations
3. **Composable**: Complex operations built from simple ones
4. **Liftable**: All operations can be lifted to expression level
5. **Minimal**: Smallest set that can express everything

This base semantic layer provides the foundation for:
- Building higher-level operations
- Implementing different semantic contexts
- Bootstrapping the system itself
- Cross-compilation to different targets