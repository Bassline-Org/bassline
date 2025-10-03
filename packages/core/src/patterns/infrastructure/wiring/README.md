# Wiring Language

A simple language for connecting gadgets.

## Vocabulary

### Commands (Input)

#### `wire` - Connect two gadgets
Establishes a one-way connection where effects from the source are forwarded to the target.

**Parameters:**
- `from: Gadget` - Source gadget (must be tappable)
- `to: Gadget` - Target gadget (must have `receive`)
- `via?: string` - Effect field to forward (default: `'changed'`)

**Example:**
```typescript
wiring.receive({
  wire: {
    from: counter,
    to: doubler,
    via: 'changed'
  }
})
```

### Events (Effects)

#### `wired` - Connection established
Emitted when a wire is successfully created.

**Fields:**
- `id: string` - Unique identifier for this connection (format: `{from}→{to}:{via}`)

**Example:**
```typescript
{ wired: { id: 'counter→doubler:changed' }}
```

## Semantics

When you send `{ wire: { from, to, via }}`:

1. **Validation**: Checks that `from` has `.tap()` and `to` has `.receive()`
2. **Tap Creation**: Sets up `from.tap(effects => to.receive(effects[via]))`
3. **Cleanup Storage**: Stores cleanup function in internal registry
4. **Effect Emission**: Emits `{ wired: { id }}`

## State

The wiring gadget maintains an internal registry of cleanup functions:

```
Map<string, () => void>
```

Where the key is the wire ID and the value is the cleanup function returned by `.tap()`.

## Examples

### Basic Wiring
```typescript
const counter = withTaps(quick(maxProto, 0))
const doubler = withTaps(quick(transformProto(x => x * 2), undefined))

wiring.receive({ wire: { from: counter, to: doubler, via: 'changed' }})

// Now when counter emits:
counter.receive(5)  // emits { changed: 5 }
// doubler receives 5 and computes 10
```

### Multiple Wires from Same Source
```typescript
wiring.receive({ wire: { from: counter, to: display1 }})
wiring.receive({ wire: { from: counter, to: display2 }})
wiring.receive({ wire: { from: counter, to: logger }})

// counter broadcasts to all three targets
```

### Different Effect Fields
```typescript
// Forward 'computed' instead of 'changed'
wiring.receive({
  wire: {
    from: transformer,
    to: consumer,
    via: 'computed'
  }
})
```

## Protocol

The wiring gadget implements:

```typescript
Input: { wire: { from: Gadget, to: Gadget, via?: string }}
Effects: { wired: { id: string }}
```

## Design Principles

1. **Simple**: Only handles one-way taps
2. **Dumb**: No knowledge of protocols or semantics
3. **Reusable**: Works with any tappable → receivable gadgets
4. **Automatic cleanup**: Stores cleanup functions for later use

## Limitations

- No bidirectional wiring (use two wire commands)
- No automatic unwiring (planned for future)
- No validation that effect field exists
- No handling of gadget destruction
