# Bassline Gadgets

A minimal propagation network model. ~50 lines of core code that composes into complex systems.

## What It Is

Gadgets are simple units that:
1. **Receive** partial information
2. **Decide** what to do (dispatch)  
3. **Act** on that decision (methods)
4. **Emit** effects into the void

```typescript
const max = maxCell(10);
max.receive(20);  // Updates to 20, emits { changed: 20 }
max.receive(5);   // Ignores, emits { noop: {} }
```

Effects go nowhere by default. Gadgets have no concept of handlers or observers. Communication isn't baked in - it's added as a semantic extension (like tapping) when needed.

## Core Design

**Everything is partial information**. Different gadgets have different merge strategies:

- `maxCell` - monotonically increases (lattice-like)
- `unionCell` - monotonically grows via set union
- `lastCell` - always takes newest (non-monotonic)
- `firstCell` - keeps first value, ignores rest

The merge strategy is just another semantic choice, not a requirement.

**Tapping is a semantic extension**. Gadgets don't know about handlers or observers - `withTaps` adds this capability:
```typescript
const a = withTaps(maxCell(0));  // Add tap capability
const b = withTaps(maxCell(0));
a.tap(({ changed }) => changed && b.receive(changed));
```

This separation is crucial: the gadget protocol stays minimal, and mechanical wiring is opt-in.

**Full TypeScript inference**:
```typescript
type SliderSpec = 
  & State<{ value: number; min: number; max: number }>
  & Input<{ set: number } | { increment: {} }>
  & Actions<{ set: number; increment: {} }>
  & Effects<{ changed: number }>;
```

## Quick Start

```typescript
import { maxCell, withTaps } from 'port-graphs';

// Create cells
const a = withTaps(maxCell(0));
const b = withTaps(maxCell(0));

// Wire them
a.tap(({ changed }) => changed && b.receive(changed));

// Use them
a.receive(10);  // b also becomes 10
```

## Integration (React Example)

The semantic openness means gadgets integrate trivially with any system. React is just one example:

```typescript
import { useGadget } from 'port-graphs-react';
import { counterGadget } from 'port-graphs';

const counter = counterGadget(0);  // Create once, outside component

function Counter() {
  const [count, send] = useGadget(counter);
  
  return (
    <button onClick={() => send({ increment: 1 })}>
      Count: {count}
    </button>
  );
}
```

We hijack `update()` and `current()` to make React the source of truth. Could just as easily integrate with Vue, Solid, vanilla DOM, CLI, or any other system. The gadget doesn't know or care.

Same gadget could be:
- Bound to DOM directly
- Synced over WebSocket
- Persisted to disk
- Rendered in terminal

The semantic openness means integration is always just a thin adapter, never a rewrite.

## Advanced: Meta-Gadgets

Routing is just another gadget:
```typescript
const router = defGadget({
  dispatch: (routes, effect) => {
    if ('changed' in effect && routes[effect.source]) {
      return { route: { to: routes[effect.source], data: effect.changed }};
    }
    return { ignore: {} };
  }
});
```

## Philosophy

The power isn't in features - it's in finding the right primitive. Gadgets are that primitive:

- **Simple** enough to understand completely
- **Powerful** enough to build anything  
- **Composable** enough that complexity emerges naturally
- **Open** enough that communication patterns aren't prescribed

This isn't about building a framework. It's about having a thinking tool that makes complex systems simple.