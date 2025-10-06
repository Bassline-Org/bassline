# @bassline/react

React integration for Bassline gadgets. ~59 lines of code.

## Installation

```bash
pnpm add @bassline/react @bassline/core
```

## Key Innovation

**Prototype-based React hooks**. Install once, then every gadget automatically has React hooks:

```javascript
import { installReact } from "@bassline/react";

installReact();  // Modifies gadgetProto once

// Now ALL gadgets have React hooks!
const gadget = new numeric.Max(0);
gadget.useState();     // Works!
gadget.useComputed();  // Works!
gadget.useTap();       // Works!
```

No providers, no context, no wrappers. Just install and go.

## Core Hooks

### `gadget.useState()` - Familiar API

```javascript
import { numeric } from "@bassline/core/cells";

const max = new numeric.Max(0);

export default function Counter() {
  const [count, send] = max.useState();

  return (
    <button onClick={() => send(count + 1)}>
      Count: {count}
    </button>
  );
}
```

### `gadget.useCurrent()` - Subscribe to State

```javascript
const count = gadget.useCurrent();
```

### `gadget.useSend()` - Memoized Receive

```javascript
const send = gadget.useSend();
send(newValue);  // Calls gadget.receive(newValue)
```

### `gadget.useComputed(fn)` - Derived Values

```javascript
const doubled = gadget.useComputed(n => n * 2);
```

### `gadget.useTap(fn)` - Effect Subscriptions

```javascript
gadget.useTap(effects => {
  console.log("Effects:", effects);
});
```

## Complete Example

```javascript
import { installReact } from "@bassline/react";
import { numeric } from "@bassline/core/cells";

installReact();

const max = new numeric.Max(0);

export default function SimpleTest() {
  const [count, update] = max.useState();
  const computed = max.useComputed(count => count * 2);

  return (
    <div>
      <h1>Simple Test</h1>
      <p>Count: {count}</p>
      <button onClick={() => update(count + 1)}>Increment</button>
      <button onClick={() => update(count - 1)}>Decrement</button>
      <div>Computed: {computed}</div>
    </div>
  );
}
```

## Module-Level vs Component-Local

**Module-Level** (shared across components):
```javascript
const sharedCounter = new numeric.Max(0);

function ComponentA() {
  const count = sharedCounter.useCurrent();
  return <div>{count}</div>;
}

function ComponentB() {
  const [count, send] = sharedCounter.useState();
  return <button onClick={() => send(count + 1)}>+1</button>;
}
```

**Component-Local** (isolated to component):
```javascript
import { useLocalGadget } from "@bassline/react";

function Component() {
  const [count, send] = useLocalGadget(() => new numeric.Max(0));
  // Gadget created on mount, cleaned up on unmount
}
```

## How It Works

The `installReact()` function adds methods to `gadgetProto`:

```javascript
Object.assign(gadgetProto, {
  useCurrent() {
    return useSyncExternalStore(
      (callback) => this.tapOn("changed", callback),
      () => this.current()
    );
  },
  useSend() {
    return useCallback((value) => this.receive(value), [this]);
  },
  useState() {
    return [this.useCurrent(), this.useSend()];
  },
  useComputed(fn) {
    const current = this.useCurrent();
    return useMemo(() => fn(current), [current]);
  },
  useTap(fn) {
    useEffect(() => this.tap(fn), [this, fn]);
  }
});
```

Uses React 18's `useSyncExternalStore` for concurrent mode compatibility.

## Integration Philosophy

Same gadget works with:
- React (this package)
- Vue (hypothetical - same pattern)
- Solid (hypothetical - same pattern)
- Vanilla DOM
- CLI
- WebSocket sync
- Disk persistence

The semantic openness means integration is always just a thin adapter. We don't rebuild the gadget for each framework - we just add the hooks it needs.

## API Reference

All methods installed on `gadgetProto`:

- `.useCurrent()` → `state` - Subscribe to state changes
- `.useSend()` → `(value) => void` - Memoized receive function
- `.useState()` → `[state, send]` - Combined getter/setter
- `.useComputed(fn)` → `computedValue` - Derived value with memoization
- `.useTap(fn)` → `void` - Effect subscription with cleanup

Helper hook:

- `useLocalGadget(factory)` → `[state, send]` - Create component-local gadget

## Philosophy

**One install, universal behavior**. The prototype-based extension system means you install once and every gadget - past, present, and future - gets React hooks for free.

No wrappers, no providers, no ceremony. Just clean, composable code.

See [../../CLAUDE.md](../../CLAUDE.md) for the complete Bassline guide.
