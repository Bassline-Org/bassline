# Port-Graphs React Integration

React hooks for integrating port-graphs gadgets with React components, using React's state as the single source of truth.

## Key Concept

The integration works by hijacking the gadget's `update()` and `current()` methods:
- `update()` → calls React's `setState`
- `current()` → reads from React state

This means React owns the state and triggers re-renders, while gadgets maintain their behavior and can participate in the network.

## Installation

```bash
pnpm add port-graphs-react
```

## Basic Usage

### Simple Counter with MaxCell

```tsx
import { useGadget } from 'port-graphs-react';
import { maxCell } from 'port-graphs/dist/patterns/cells/numeric';

function Counter() {
  const [count, send] = useGadget(
    () => maxCell(0),
    0
  );

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => send(count + 1)}>
        Increment
      </button>
      <button onClick={() => send(10)}>
        Set to 10
      </button>
    </div>
  );
}
```

### Handling Effects

```tsx
import { useGadgetWithRef, useGadgetEffect } from 'port-graphs-react';

function MyComponent() {
  const [state, send, gadget] = useGadgetWithRef(factory, initialState);

  useGadgetEffect(gadget, (effect) => {
    console.log('Gadget emitted:', effect);
    // Handle side effects, navigate, etc.
  }, []);

  return <div>{/* ... */}</div>;
}
```

### Connecting Gadgets

```tsx
import { useGadgetWithRef, useGadgetConnection } from 'port-graphs-react';

function ConnectedGadgets() {
  const [state1, send1, gadget1] = useGadgetWithRef(factory1, initial1);
  const [state2, send2, gadget2] = useGadgetWithRef(factory2, initial2);

  // Wire gadget1's emissions to gadget2's receive
  useGadgetConnection(gadget1, gadget2);

  return <div>{/* ... */}</div>;
}
```

## API

### `useGadget<State, Incoming, Effect>(factory, initialState)`

Creates a React-aware gadget with a simple API.

- **factory**: Function that creates a gadget with initial state
- **initialState**: Initial state for both React and the gadget
- **Returns**: `[state, send]` tuple where `send` passes data to the gadget

### `useGadgetWithRef<State, Incoming, Effect>(factory, initialState)`

Advanced version that also exposes the gadget for wiring.

- **factory**: Function that creates a gadget with initial state
- **initialState**: Initial state for both React and the gadget
- **Returns**: `[state, send, gadget]` tuple

### `useGadgetEffect<State, Incoming, Effect>(gadget, handler, deps)`

Intercepts gadget emissions.

- **gadget**: The gadget to monitor
- **handler**: Callback for handling emissions
- **deps**: React dependency array

### `useGadgetConnection(source, target, transform?)`

Connects two gadgets.

- **source**: Gadget whose emissions to capture
- **target**: Gadget to receive the data
- **transform**: Optional function to transform effects before sending

## Benefits

1. **Single Source of Truth**: React owns the state
2. **Automatic Re-renders**: State changes trigger React updates
3. **Bidirectional Flow**: UI → Gadget → Network → UI
4. **Type Safety**: Full TypeScript support
5. **Network Integration**: Gadgets can still participate in the network
6. **Clean Separation**: React rendering stays in React, gadget logic stays in gadgets

## Examples

See the `src/examples` directory for more complete examples including:
- Counter with MaxCell
- Form with validation
- PubSub chat system