# Spawning Language

A simple language for creating gadget instances from factories.

## Vocabulary

### Commands (Input)

#### `spawn` - Create instance from factory
Calls a factory function and stores the resulting instance.

**Parameters:**
- `id: string` - Unique identifier for this instance
- `factory: () => Gadget` - Factory function that creates the gadget

**Example:**
```typescript
spawning.receive({
  spawn: {
    id: 'c1',
    factory: () => withTaps(quick(maxProto, 0))
  }
})
```

### Events (Effects)

#### `spawned` - Instance created
Emitted when an instance is successfully created and stored.

**Fields:**
- `id: string` - The instance identifier

**Example:**
```typescript
{ spawned: { id: 'c1' }}
```

#### `error` - Spawn failed
Emitted when factory throws an exception.

**Fields:**
- `type: 'spawn_failed'`
- `details: string` - Error message

**Example:**
```typescript
{ error: { type: 'spawn_failed', details: 'TypeError: ...' }}
```

## Semantics

When you send `{ spawn: { id, factory }}`:

1. **Factory Call**: Calls `factory()` to create instance
2. **Storage**: Stores instance in internal registry: `instances.set(id, instance)`
3. **Effect Emission**: Emits `{ spawned: { id }}`

If factory throws:
1. **Error Capture**: Catches exception
2. **Effect Emission**: Emits `{ error: { type: 'spawn_failed', details: ... }}`
3. **No Storage**: Instance is not stored

## State

The spawning gadget maintains an internal registry of instances:

```
Map<string, Gadget>
```

Where the key is the instance ID and the value is the created gadget.

## Examples

### Basic Spawning
```typescript
spawning.receive({
  spawn: {
    id: 'counter1',
    factory: () => withTaps(quick(maxProto, 0))
  }
})
// → Emits { spawned: { id: 'counter1' }}
// → Instance stored and accessible
```

### Multiple Instances
```typescript
spawning.receive({
  spawn: {
    id: 'c1',
    factory: () => withTaps(quick(maxProto, 0))
  }
})

spawning.receive({
  spawn: {
    id: 'c2',
    factory: () => withTaps(quick(maxProto, 0))
  }
})

// Two independent instances created
```

### Error Handling
```typescript
spawning.receive({
  spawn: {
    id: 'broken',
    factory: () => { throw new Error('Factory failed!') }
  }
})
// → Emits { error: { type: 'spawn_failed', details: 'Error: Factory failed!' }}
// → No instance stored
```

### Accessing Instances
```typescript
spawning.receive({ spawn: { id: 'c1', factory: counterFactory }})

// Get instance from spawning gadget's state
const instance = spawning.current().instances.current().get('c1')
instance.receive(10)  // Use the instance
```

## Protocol

The spawning gadget implements:

```typescript
Input: { spawn: { id: string, factory: () => Gadget }}
Effects: { spawned: { id: string }} | { error: { type: string, details: string }}
```

## Design Principles

1. **Simple**: Just calls factory and stores result
2. **Safe**: Catches factory errors
3. **Transparent**: Instances stored in accessible registry
4. **Reusable**: Works with any factory function

## Limitations

- No instance destruction (planned for future)
- No duplicate ID checking (overwrites silently)
- No validation that factory returns a gadget
- No lifecycle hooks (created, destroyed, etc.)
