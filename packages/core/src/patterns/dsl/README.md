# DSL Tower

This directory contains Domain-Specific Languages built as gadgets. Each DSL speaks its own vocabulary and compiles to lower-level operations.

## Architecture

```
CSP DSL (constraint satisfaction)
    ↓ compiles to
Network DSL (gadget management)
    ↓ compiles to
Infrastructure (wiring + spawning)
    ↓ operates on
Primitives (cells, registries)
```

## Layers

### Infrastructure (`infrastructure/`)

Low-level gadgets that implement mechanical operations:

- **Wiring** - Connects gadgets via taps
  - Command: `{ wire: { from, to, via }}`
  - Effect: `{ wired: { id }}`

- **Spawning** - Creates gadget instances from factories
  - Command: `{ spawn: { id, factory }}`
  - Effect: `{ spawned: { id }}`

### Network DSL (`network/`)

Mid-level language for managing gadgets:

- **Define** - Register factory by type name
  - Command: `{ define: { name, factory }}`
  - Effect: `{ defined: name }`

- **Spawn** - Create instance by type name
  - Command: `{ spawn: { id, type }}`
  - Effect: `{ spawned: { id }}`
  - Compilation: Looks up factory, forwards to spawning gadget

- **Wire** - Connect instances by ID
  - Command: `{ wire: { from, to, via }}`
  - Effect: `{ wired: { from, to }}`
  - Compilation: Looks up instances, forwards to wiring gadget

### CSP DSL (`csp/`)

High-level language for constraint satisfaction problems:

- **Variable** - Define variable type with domain factory
  - Command: `{ variable: { name, domain }}`
  - Effect: `{ variableDefined: { name }}`
  - Compilation: Forwards to network `define`

- **Create** - Instantiate variable
  - Command: `{ create: { id, type, domain? }}`
  - Effect: `{ created: { id }}`
  - Compilation: Forwards to network `spawn`

- **Relate** - Declare constraint between variables
  - Command: `{ relate: { vars, constraint }}`
  - Effect: `{ related: { vars }}`
  - Compilation: Creates propagator gadget, spawns it, wires all variables bidirectionally

## Key Patterns

### 1. Compilation Through Forwarding

Higher-level commands forward to lower-level gadgets rather than implementing logic:

```typescript
export function spawnHandler(g, actions) {
  if ('spawn' in actions) {
    const { id, factory } = actions.spawn;

    // FORWARD to spawning gadget
    g.current().spawning.receive({ spawn: { id, factory }});

    return { spawned: { id }};
  }
  return {};
}
```

### 2. Step/Handler Composition

Each term uses the same pattern:

```typescript
// Step: Validate and prepare
export const step = (state, input) => {
  if ('command' in input) {
    // Validate, lookup dependencies
    return { action: prepared };
  }
  return { error: {...} };
};

// Handler: Execute by forwarding
export function handler(g, actions) {
  if ('action' in actions) {
    // Forward to lower level
    g.current().lowerLevel.receive(...);
    return { effect: {...} };
  }
  return {};
}

// Proto: Compose with spread
export const proto = () =>
  protoGadget(step).handler((g, a) => ({
    ...handler1(g, a),
    ...handler2(g, a),
    ...handler3(g, a)
  }));
```

### 3. Language Documentation

Each gadget has a README documenting:
- **Vocabulary** - Commands (input) and Events (effects)
- **Semantics** - What happens when you send a command
- **Compilation** - How high-level terms map to low-level operations
- **Examples** - Concrete usage showing the language in action

## Examples

### Map Coloring (Full Tower)

```typescript
const csp = createCSPGadget();

// CSP vocabulary
csp.receive({
  variable: {
    name: 'color',
    domain: () => withTaps(quick(intersectionProto(),
      new Set(['Red', 'Green', 'Blue'])))
  }
});

csp.receive({ create: { id: 'wa', type: 'color' }});
csp.receive({ create: { id: 'nt', type: 'color' }});

csp.receive({
  relate: {
    vars: ['wa', 'nt'],
    constraint: (d1, d2) => [
      d2.size === 1 ? new Set([...d1].filter(x => !d2.has(x))) : d1,
      d1.size === 1 ? new Set([...d2].filter(x => !d1.has(x))) : d2
    ]
  }
});

// Compiles through all layers automatically
```

See [`csp/map-coloring.ts`](./csp/map-coloring.ts) for full demo.

## Design Principles

1. **Small gadgets** - Each layer is focused and minimal
2. **Pure data stores** - Infrastructure just stores (registries for everything)
3. **Compilation not interpretation** - Forward commands, don't implement
4. **Language-first** - Each gadget is a vocabulary provider
5. **Fire-and-forget** - All propagation through taps (no delivery guarantees)
6. **Composable** - Stack DSLs arbitrarily deep

## Benefits

- **Expressivity** - Speak in domain terms, not gadget mechanics
- **Reusability** - Infrastructure gadgets used by all DSLs
- **Testability** - Each layer tested independently
- **Debuggability** - Can observe effects at any layer
- **Extensibility** - Add new DSLs without changing infrastructure

## Future DSLs

Potential additional layers:

- **State Machine DSL** - states, transitions, guards
- **Dataflow DSL** - pipes, filters, transforms
- **UI DSL** - components, layouts, interactions
- **Query DSL** - selectors, joins, aggregations
- **Reactive DSL** - signals, derived, effects

Each would compile to Network DSL or directly to Infrastructure.
