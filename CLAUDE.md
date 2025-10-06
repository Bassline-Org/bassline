# CLAUDE.md - Bassline System Guide

**📝 Note**: Check `.claude/context.md` for recent work context and architectural decisions from previous sessions.

## Project Overview

This is **Bassline** - a hyper-minimal propagation network model built around **gadgets**. Despite the repo name "port-graphs", this is actually an implementation of a more general and powerful model inspired by propagation networks (Sussman/Radul) but evolved into something more fundamental.

**Core Philosophy**: We don't define how gadgets communicate - we provide a minimal protocol for doing useful work and leave communication semantically open. This is intentional and critical to the design.

## Why JavaScript (Not TypeScript)

**The system is written in vanilla JavaScript, not TypeScript.** This is a deliberate choice:

- Our behaviors are highly dynamic (prototype manipulation, runtime composition, meta-programming)
- Static typing fought against the dynamic nature of the gadget model
- TypeScript ceremony added complexity without proportional value for this use case
- JavaScript lets us focus on the primitive without type gymnastics

**Future**: We may add type definitions later for library consumers, but the core implementation will remain JavaScript. The system's power comes from its runtime flexibility, not compile-time guarantees.

## Critical Design Principles

1. **Semantic Openness**: `emit()` goes nowhere by default. Communication is NOT baked into the model.
2. **Partial Information**: Everything is partial information moving up a lattice via ACI (Associative, Commutative, Idempotent) operations.
3. **Mechanical Simplicity**: Core is ~28 lines (gadget.js). Taps are an extension (~27 lines). Complexity emerges from composition, not the primitive.
4. **Fire-and-Forget Everything**: Both effects AND taps are fire-and-forget - no delivery or timing guarantees.
5. **Effects as Data**: Effects are just data about what happened internally - no prescribed handlers.
6. **Meta-Gadgets**: Routing/communication patterns are themselves gadgets operating on effects.
7. **Runtime Flexibility**: Prototype-based composition enables emergent behaviors impossible with static types.

## Architecture

```
packages/
├── core/                    # Core library (~454 LOC without devtools)
│   └── src/
│       ├── gadget.js        # THE CORE - 28 lines of gadget protocol
│       ├── taps.js          # Taps extension - 27 lines
│       ├── metadata.js      # Metadata extension
│       ├── devtools.js      # Developer utilities
│       └── patterns/
│           ├── cells/       # ACI merge strategies
│           │   ├── numeric.js    # Max, Min (30 LOC)
│           │   ├── set.js        # Union, Intersection (45 LOC)
│           │   ├── tables.js     # First, Last, table operations (57 LOC)
│           │   └── versioned.js  # Versioned values (22 LOC)
│           ├── functions/   # Function composition (113 LOC)
│           └── relations/   # Relational patterns (104 LOC)
│
└── react/                   # React integration (~59 LOC)
    └── src/
        └── index.js         # Prototype extensions for React hooks
```

**Total runtime code**: ~513 LOC (core + react, excluding devtools)

## Core Concepts

### 1. Gadget Anatomy

```javascript
// The gadget protocol (from gadgetProto)
{
  receive(input)      // Accept input, validate, step, handle
  validate(input)     // Validate input (default: pass-through)
  current()           // Get current state (from Symbol-protected storage)
  update(newState)    // Update state (internal use only!)
  step(state, input)  // User-defined: state + input -> action
  handle(action)      // User-defined: execute action
  emit(data)          // Emit effects (no-op by default!)
}
```

**Critical**: `emit()` goes nowhere by default. Communication is semantic, not baked in.

### 2. Creating Gadgets

```javascript
import { Gadget } from "@bassline/core";

// Define step function: (state, input) -> action
function step(state, input) {
  if (input > state) return input;  // Only accept increases
  return undefined;  // Reject decreases
}

// Create gadget with initial state
const gadget = new Gadget(step, 0);

// Use it
gadget.receive(5);   // Accepted
gadget.current();    // 5
gadget.receive(3);   // Rejected
```

### 3. Taps Extension (Mechanical Wiring)

```javascript
import { installTaps } from "@bassline/core/taps";

// Install taps extension (modifies gadgetProto)
installTaps();

// Now all gadgets can be tapped
const cleanup = gadget.tap(effects => {
  console.log("Effects:", effects);
});

// Specific effect tapping
gadget.tapOn("changed", ({ old, newState }) => {
  console.log(`Changed from ${old} to ${newState}`);
});

// Cleanup when done
cleanup();
```

Taps are **fire-and-forget** - they can be sync or async, and the emitting gadget doesn't care about timing or delivery guarantees. This uniformity means the same gadget works in-memory, over network, or across processes without modification.

### 4. Lattice Operations (Cells)

Cells implement different merge strategies for moving up a lattice:

```javascript
import { numeric, set, tables } from "@bassline/core/patterns";

// Numeric cells
const max = new numeric.Max(0);    // Monotonically increasing
const min = new numeric.Min(100);  // Monotonically decreasing

// Set cells
const union = new set.Union([]);         // Set union (growing)
const intersection = new set.Intersection([]); // Set intersection (shrinking)

// Table cells
const last = new tables.Last(0);   // Always take newest value
const first = new tables.First(0); // Keep first value, ignore rest
```

### 5. React Integration

```javascript
import { installReact } from "@bassline/react";
import { numeric } from "@bassline/core/cells";

// Install React hooks (modifies gadgetProto)
installReact();

// Now all gadgets have React hooks!
function Component() {
  const gadget = useMemo(() => new numeric.Max(0), []);

  // useState pattern (familiar API)
  const [count, send] = gadget.useState();

  // Or use separately
  const count = gadget.useCurrent();
  const send = gadget.useSend();

  // Computed values
  const doubled = gadget.useComputed(n => n * 2);

  // Effect tapping
  gadget.useTap(effects => {
    console.log("Effects:", effects);
  });

  return <button onClick={() => send(count + 1)}>{count}</button>;
}
```

**Key Innovation**: No wrapper components, no providers, no context. Just install once and every gadget gets React hooks for free via prototype extension.

## Working with the Codebase

### Creating Custom Gadgets

Pattern for custom step functions:

```javascript
function counterStep(state, input) {
  // Examine input and decide what to do
  if (input.increment) return state + 1;
  if (input.decrement) return state - 1;
  if (input.set !== undefined) return input.set;
  return undefined; // Reject unknown inputs
}

const counter = new Gadget(counterStep, 0);
counter.receive({ increment: true });
```

### Gadget Classes (for Complex Behavior)

```javascript
import { Gadget } from "@bassline/core";

class Counter extends Gadget {
  constructor(initial = 0) {
    super((state, input) => this.step(state, input), initial);
  }

  step(state, input) {
    if (input.increment) return state + 1;
    if (input.decrement) return state - 1;
    return undefined;
  }

  handle(newState) {
    this.update(newState);
  }
}
```

### Extension Pattern (Install Functions)

All extensions follow this pattern:

```javascript
import { gadgetProto } from "@bassline/core";

export function installMyExtension() {
  // Check if already installed
  if (gadgetProto.myMethod !== undefined) {
    return;
  }

  // Add methods to prototype
  Object.assign(gadgetProto, {
    myMethod() {
      // Now all gadgets have this method
    }
  });
}
```

### Pattern Libraries

**Cells** (`patterns/cells/`):
- `numeric`: Max, Min for monotonic numbers
- `set`: Union, Intersection for set operations
- `tables`: First, Last, table merge strategies
- `versioned`: Version-tracked values

**Functions** (`patterns/functions/`):
- Function composition
- Partial application
- (~113 LOC)

**Relations** (`patterns/relations/`):
- Relational data patterns
- (~104 LOC)

## Common Patterns

### Bidirectional Sync

```javascript
import { numeric } from "@bassline/core/cells";
import { installTaps } from "@bassline/core/taps";

installTaps();

const a = new numeric.Max(0);
const b = new numeric.Max(0);

a.tapOn("changed", ({ newState }) => b.receive(newState));
b.tapOn("changed", ({ newState }) => a.receive(newState));
```

### Async Propagation

```javascript
const source = new numeric.Max(0);
const delayed = new tables.Last(0);

source.tap(async ({ changed }) => {
  if (changed !== undefined) {
    await new Promise(r => setTimeout(r, 100));
    delayed.receive(changed.newState);
  }
});
```

### Aggregation

```javascript
const nums = [1, 2, 3].map(n => new numeric.Max(n));
const sum = new tables.Last(0);

nums.forEach(n => {
  n.tap(() => {
    const total = nums.reduce((acc, g) => acc + g.current(), 0);
    sum.receive(total);
  });
});
```

### React Usage

```javascript
import { numeric } from "@bassline/core/cells";

const max = new numeric.Max(0);

export default function SimpleTest() {
  const [count, update] = max.useState();
  const computed = max.useComputed(count => count * 2);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => update(count + 1)}>Increment</button>
      <div>Computed: {computed}</div>
    </div>
  );
}
```

## Philosophy Reminders

- **Don't fight the model** - if something feels hard, you're probably trying to bake in too much
- **Everything is fire-and-forget** - effects AND taps don't guarantee delivery or timing
- **Keep gadgets focused** - combine simple gadgets rather than making complex ones
- **Embrace partial information** - not knowing everything is a feature
- **Communication is just another gadget** - routers, channels, spaces are all gadgets
- **Prototype extensions over wrappers** - modify gadgetProto, don't wrap gadgets

## Debugging Tips

1. **Tap everything during development**:
```javascript
gadget.tap(e => console.log('Effect:', e));
```

2. **Check step logic first** - most bugs are in deciding what action to take

3. **Use devtools** (if available):
```javascript
import { installBassline } from "@bassline/core/devtools";
installBassline(); // Adds window.bassline
```

4. **Build trace gadgets for time-travel debugging**:
```javascript
const tracer = new tables.Last({});
gadget.tap(effect => {
  const timestamp = Date.now();
  tracer.receive({ [timestamp]: { state: gadget.current(), effect } });
});
// Now tracer.current() has full history for replay
```

## Anti-Patterns to Avoid

❌ **Don't** put communication logic in gadget step/handle methods
❌ **Don't** make effects dependent on external state
❌ **Don't** use async operations inside step/handle (async taps are fine!)
❌ **Don't** mutate state directly - always use gadget.update()
❌ **Don't** forget to install extensions before using them
❌ **Don't** create circular dependencies without careful thought about termination
❌ **Don't** assume taps execute synchronously or in order

## Advanced Patterns

### Async Taps
```javascript
// Taps can be async - fire-and-forget works across async boundaries
gadget.tap(async (effect) => {
  if ('changed' in effect) {
    await fetch('/api/log', {
      method: 'POST',
      body: JSON.stringify(effect)
    });
  }
});

// Or spawn background processing
gadget.tap(effect => {
  setTimeout(() => otherGadget.receive(effect.changed?.newState), 1000);
});
```

### Distributed Gadgets
```javascript
// Fire-and-forget taps naturally support distributed systems
const local = new numeric.Max(0);

// Could be across network, IPC, WebSocket, etc.
local.tap(({ changed }) => {
  if (changed !== undefined) {
    websocket.send(JSON.stringify({ type: 'sync', value: changed.newState }));
  }
});

// No changes needed to the gadget model - distribution is just async taps
```

### Custom Extensions

```javascript
// Example: Add logging to all gadgets
export function installLogging() {
  const originalReceive = gadgetProto.receive;

  Object.assign(gadgetProto, {
    receive(input) {
      console.log(`[${this.constructor.name}] receive:`, input);
      return originalReceive.call(this, input);
    }
  });
}
```

## No Bundler Needed

The core and React packages are vanilla ES modules with no build step:

**package.json for @bassline/core:**
```json
{
  "name": "@bassline/core",
  "type": "module",
  "main": "./src/index.js",
  "exports": {
    ".": "./src/index.js",
    "./taps": "./src/taps.js",
    "./metadata": "./src/metadata.js",
    "./patterns": "./src/patterns/index.js",
    "./cells": "./src/patterns/cells/index.js",
    "./devtools": "./src/devtools.js"
  }
}
```

Consuming apps (like Vite) handle bundling. We ship source.

## Remember

This system's power comes from its **minimalism** and **semantic openness**. The core is intentionally simple - complexity emerges from composition. When in doubt, make another gadget rather than making existing gadgets more complex.

Both effects and taps are **fire-and-forget** - this isn't a limitation, it's what enables the model to work across any transport (memory, network, IPC) without changes. Timing and delivery are concerns for meta-gadgets if needed, not the core model.

The prototype-based extension system means **one install, universal behavior**. No wrappers, no providers, no ceremony.

The goal is to do more than anyone else in the world not by having more features, but by having the right primitive that composes infinitely.

**Stats**: ~28 lines for the core protocol, ~513 total runtime LOC including all patterns and React integration.
