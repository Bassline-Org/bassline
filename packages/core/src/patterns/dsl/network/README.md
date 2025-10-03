# Network Language

A DSL for declarative gadget network construction.

## Purpose

The Network Language provides a vocabulary for defining, creating, and connecting gadgets. It compiles high-level network operations into low-level infrastructure commands.

## Vocabulary

### Commands (Input)

#### `define` - Register a factory by name
Defines a reusable gadget type that can be spawned multiple times.

**Parameters:**
- `name: string` - Type name (e.g., 'counter', 'doubler')
- `factory: () => Gadget` - Factory function

**Example:**
```typescript
network.receive({
  define: {
    name: 'counter',
    factory: () => withTaps(quick(maxProto, 0))
  }
})
```

#### `spawn` - Create instance from registered type
Creates a new instance of a previously defined type.

**Parameters:**
- `id: string` - Unique instance identifier
- `type: string` - Type name (from `define`)

**Example:**
```typescript
network.receive({
  spawn: { id: 'c1', type: 'counter' }
})
```

#### `wire` - Connect two instances
Establishes a one-way connection between instances.

**Parameters:**
- `from: string` - Source instance ID
- `to: string` - Target instance ID
- `via?: string` - Effect field to forward (default: 'changed')

**Example:**
```typescript
network.receive({
  wire: { from: 'c1', to: 'd1', via: 'changed' }
})
```

### Events (Effects)

#### `defined` - Factory registered
**Fields:** `name: string`

#### `spawned` - Instance created
**Fields:** `id: string`

#### `wired` - Connection established
**Fields:** `from: string`, `to: string`

#### `error` - Operation failed
**Fields:** `type: string`, `details: string`

## Compilation

Network commands compile to infrastructure operations:

| Network Command | Infrastructure Operation |
|----------------|-------------------------|
| `define` | `definitions.register({ id: name, value: factory })` |
| `spawn` | `spawning.spawn({ id, factory: definitions.get(type) })` |
| `wire` | `wiring.wire({ from: instances.get(from), to: instances.get(to), via })` |

## State Structure

```typescript
{
  definitions: Registry<Factory>,     // name → factory
  spawning: SpawningGadget,          // handles instance creation
  wiring: WiringGadget               // handles connections
}
```

The network gadget **delegates** to infrastructure gadgets rather than implementing logic itself.

## Examples

### Complete Network

```typescript
const network = createNetworkGadget()

// 1. Define types
network.receive({
  define: {
    name: 'counter',
    factory: () => withTaps(quick(maxProto, 0))
  }
})

network.receive({
  define: {
    name: 'doubler',
    factory: () => withTaps(quick(transformProto(x => x * 2), undefined))
  }
})

// 2. Create instances
network.receive({ spawn: { id: 'c1', type: 'counter' }})
network.receive({ spawn: { id: 'd1', type: 'doubler' }})

// 3. Connect them
network.receive({ wire: { from: 'c1', to: 'd1' }})

// Now the network is live:
// c1.receive(5) → emits { changed: 5 } → d1 receives 5 → computes 10
```

### Error Handling

```typescript
// Unknown type
network.receive({ spawn: { id: 'x', type: 'unknown' }})
// → { error: { type: 'unknown_type', details: 'No factory for type: unknown' }}

// Unknown instances
network.receive({ wire: { from: 'nonexistent', to: 'd1' }})
// → { error: { type: 'not_found', details: 'Source not found: nonexistent' }}
```

## Protocol

```typescript
Input:
  | { define: { name: string, factory: () => Gadget }}
  | { spawn: { id: string, type: string }}
  | { wire: { from: string, to: string, via?: string }}

Effects:
  | { defined: string }
  | { spawned: { id: string }}
  | { wired: { from: string, to: string }}
  | { error: { type: string, details: string }}
```

## Design Principles

1. **Declarative**: Describe the network, don't build it imperatively
2. **Type-based**: Define types once, spawn many instances
3. **ID-based**: Reference instances by string IDs
4. **Compilation**: Forwards to infrastructure, doesn't implement

## Comparison to Infrastructure

The Network Language is **higher-level** than infrastructure:

**Infrastructure Level:**
```typescript
// Manual factory management
const factory = () => withTaps(quick(maxProto, 0))
spawning.receive({ spawn: { id: 'c1', factory }})

// Manual instance lookup
const c1 = spawning.current().instances.current().get('c1')
const c2 = spawning.current().instances.current().get('c2')
wiring.receive({ wire: { from: c1, to: c2 }})
```

**Network Level:**
```typescript
// Type registry
network.receive({ define: { name: 'counter', factory }})
network.receive({ spawn: { id: 'c1', type: 'counter' }})

// ID-based wiring
network.receive({ wire: { from: 'c1', to: 'c2' }})
```

Network provides:
- ✅ Type registry (reusable definitions)
- ✅ ID-based addressing (no manual lookup)
- ✅ Validation (type exists, instances exist)
- ✅ Simpler vocabulary (define/spawn/wire)

## Limitations

- No instance destruction
- No unwiring
- No batch operations
- No templates or patterns
- IDs must be unique (no scoping)
