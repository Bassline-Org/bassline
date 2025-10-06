# Bassline

A minimal propagation network model. ~28 lines of core code that composes into complex systems.

## What It Is

Gadgets are simple units that:
1. **Receive** input and validate it
2. **Step** to decide what action to take
3. **Handle** the action (usually updating state)
4. **Emit** effects into the void

```javascript
import { numeric } from "@bassline/core/cells";

const max = new numeric.Max(10);
max.receive(20);  // Updates to 20, emits { changed: { old: 10, newState: 20 } }
max.receive(5);   // Ignores (max only increases)
```

Effects go nowhere by default. Gadgets have no concept of handlers or observers. Communication isn't baked in - it's added via extensions (like taps) when needed.

## Core Design

**Everything is partial information**. Different gadgets have different merge strategies:

- `numeric.Max` - monotonically increases (lattice-like)
- `numeric.Min` - monotonically decreases
- `set.Union` - monotonically grows via set union
- `tables.Last` - always takes newest (non-monotonic)
- `tables.First` - keeps first value, ignores rest

The merge strategy is just a semantic choice, not a requirement.

**Tapping is an extension**. Gadgets don't know about handlers - `installTaps()` adds this capability:

```javascript
import { installTaps } from "@bassline/core/taps";

installTaps();

const a = new numeric.Max(0);
const b = new numeric.Max(0);

a.tapOn("changed", ({ newState }) => b.receive(newState));
```

This separation is crucial: the gadget protocol stays minimal, and mechanical wiring is opt-in.

**Written in JavaScript**. The system uses prototype-based extension for maximum flexibility. No TypeScript ceremony, no type gymnastics - just clean, composable code.

## Quick Start

```javascript
import { numeric } from "@bassline/core/cells";
import { installTaps } from "@bassline/core/taps";

installTaps();

// Create cells
const a = new numeric.Max(0);
const b = new numeric.Max(0);

// Wire them
a.tapOn("changed", ({ newState }) => b.receive(newState));

// Use them
a.receive(10);  // b also becomes 10
```

## React Integration

Install React hooks once, then every gadget works seamlessly:

```javascript
import { installReact } from "@bassline/react";
import { numeric } from "@bassline/core/cells";

installReact();

const max = new numeric.Max(0);

export default function Counter() {
  const [count, send] = max.useState();
  const doubled = max.useComputed(n => n * 2);

  return (
    <div>
      <button onClick={() => send(count + 1)}>Count: {count}</button>
      <div>Doubled: {doubled}</div>
    </div>
  );
}
```

No providers, no context, no wrappers. Just install once and gadgets get React hooks via prototype extension.

Same gadget could be:
- Bound to DOM directly
- Synced over WebSocket
- Persisted to disk
- Rendered in terminal

The semantic openness means integration is always just a thin adapter, never a rewrite.

## Architecture

```
packages/
├── core/           # ~28 line core + patterns (~454 LOC total)
│   ├── gadget.js   # The core protocol
│   ├── taps.js     # Tap extension
│   └── patterns/   # Cells, functions, relations
└── react/          # React integration (~59 LOC)
    └── index.js    # Prototype extensions for hooks
```

No bundler needed - vanilla ES modules shipped as source.

## Philosophy

The power isn't in features - it's in finding the right primitive. Gadgets are that primitive:

- **Simple** enough to understand completely (~28 lines)
- **Powerful** enough to build anything
- **Composable** enough that complexity emerges naturally
- **Open** enough that communication patterns aren't prescribed

This isn't about building a framework. It's about having a thinking tool that makes complex systems simple.

## Packages

- **[@bassline/core](./packages/core)** - Core gadget protocol and patterns
- **[@bassline/react](./packages/react)** - React integration

## Learn More

See [CLAUDE.md](./CLAUDE.md) for comprehensive guide including:
- Core concepts and patterns
- Extension system
- Common recipes
- Philosophy and design principles
