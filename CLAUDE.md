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
├── core/                    # Core primitives (gadget protocol, package system)
│   └── src/
│       ├── gadget.js        # THE CORE - ~60 lines of gadget protocol
│       ├── index.js         # Package installation, fromSpec, bl()
│       ├── packageLoader.js # Load packages from JSON definitions
│       ├── packageExporter.js # Export gadgets as packages
│       └── packageResolver.js # Type resolution system
│
├── cells/                   # ACI merge strategies (lattice operations)
│   └── src/
│       ├── numeric.js       # Max, Min (monotonic numbers)
│       ├── set.js           # Union, Intersection (set operations)
│       ├── tables.js        # First, Last (table merge strategies)
│       ├── versioned.js     # Version-tracked values
│       └── unsafe.js        # Last (no merge, always replace)
│
├── taps/                    # Observation extension (~40 lines)
│   └── src/
│       └── index.js         # tap(), tapOn(), emit() with Set-based distribution
│
├── functions/               # Function composition patterns
│   └── src/
│       ├── core.js          # Map, partial application
│       ├── math.js          # Mathematical operations
│       ├── logic.js         # Logical operations
│       ├── array.js         # Array operations
│       └── http.js          # HTTP request handling
│
├── relations/               # Gadget wiring utilities
│   └── src/
│       ├── index.js         # Wire, connect helpers
│       └── relationGadgets.js # Wire gadget implementation
│
├── systems/                 # Compound gadgets (meta-circularity)
│   └── src/
│       ├── compound.js      # Compound gadget proto
│       ├── compoundProto.js # Factory for creating compound protos
│       ├── scope.js         # Scoped gadget resolution
│       └── versionControl.js # Version tracking
│
├── refs/                    # Reference types (local, file, web, gadget)
│   └── src/
│       ├── localRef.js      # Local scope references
│       ├── gadgetRef.js     # References to other gadgets
│       ├── fileRef.js       # File system references
│       └── webRef.js        # HTTP/URL references
│
├── metadata/                # Metadata extension
├── devtools/                # Developer utilities
├── registry/                # Global gadget registry
└── react/                   # React integration
    └── src/
        └── index.js         # useGadget, useTap hooks
```

**Key Features**:
- Vanilla JavaScript (no build step)
- Auto-install on import (each package calls `installPackage()`)
- Meta-circular (gadgets describe gadgets via package system)
- Prototype-based extensions (one install, universal behavior)

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

Gadgets are created via the prototype pattern using `spawn()`:

```javascript
import { bl } from "@bassline/core";
import "@bassline/cells";  // Auto-installs max gadget

// Using installed gadgets
const { packages } = bl();
const maxProto = packages["@bassline/cells/numeric"].max;
const gadget = maxProto.spawn(0);

// Or use fromSpec (recommended)
const gadget2 = bl().fromSpec({
  pkg: "@bassline/cells/numeric",
  name: "max",
  state: 0
});

// Use it
gadget.receive(5);   // Accepted
gadget.current();    // 5
gadget.receive(3);   // Rejected (max only accepts increases)
```

**Custom Gadgets**:

```javascript
import { bl } from "@bassline/core";

const counterProto = Object.create(bl().gadgetProto);
Object.assign(counterProto, {
  pkg: "@myapp/gadgets",
  name: "counter",
  step(state, input) {
    if (input.increment) {
      this.update(state + 1);
    } else if (input.decrement) {
      this.update(state - 1);
    }
  }
});

const counter = counterProto.spawn(0);
counter.receive({ increment: true });  // 1
counter.receive({ increment: true });  // 2
counter.receive({ decrement: true });  // 1
```

### 3. Taps Extension (Mechanical Wiring)

```javascript
import "@bassline/taps";  // Auto-installs on import!

// Now all gadgets can be tapped
const cleanup = gadget.tap(effects => {
  console.log("Effects:", effects);
});

// Specific effect tapping
gadget.tapOn("changed", newValue => {
  console.log(`Changed to ${newValue}`);
});

// Cleanup when done
cleanup();
```

Taps are **fire-and-forget** - they can be sync or async, and the emitting gadget doesn't care about timing or delivery guarantees. This uniformity means the same gadget works in-memory, over network, or across processes without modification.

### 4. Lattice Operations (Cells)

Cells implement different merge strategies for moving up a lattice:

```javascript
import { bl } from "@bassline/core";
import "@bassline/cells";

const { fromSpec } = bl();

// Numeric cells (monotonic)
const max = fromSpec({ pkg: "@bassline/cells/numeric", name: "max", state: 0 });
const min = fromSpec({ pkg: "@bassline/cells/numeric", name: "min", state: 100 });

// Set cells
const union = fromSpec({ pkg: "@bassline/cells/set", name: "union", state: new Set() });
const intersection = fromSpec({ pkg: "@bassline/cells/set", name: "intersection", state: new Set() });

// Table cells
const last = fromSpec({ pkg: "@bassline/cells/tables", name: "last", state: {} });
const first = fromSpec({ pkg: "@bassline/cells/tables", name: "first", state: {} });

// Unsafe (no merge, always replace)
const unsafe = fromSpec({ pkg: "@bassline/cells/unsafe", name: "last", state: 0 });
```

### 5. React Integration

```javascript
import { useMemo } from "react";
import { bl } from "@bassline/core";
import { useGadget } from "@bassline/react";
import "@bassline/cells";

function Component() {
  const gadget = useMemo(() =>
    bl().fromSpec({ pkg: "@bassline/cells/numeric", name: "max", state: 0 }),
    []
  );

  // Subscribe to changed effect
  const [count] = useGadget(gadget, ["changed"]);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => gadget.receive(count + 1)}>Increment</button>
    </div>
  );
}
```

**Key Innovation**: Simple hook-based integration. `useGadget(gadget, effects)` subscribes to specific effects and re-renders when they occur.

## Working with the Codebase

### Creating Custom Gadgets

All gadgets follow the prototype pattern:

```javascript
import { bl, installPackage } from "@bassline/core";

// 1. Create proto extending gadgetProto
const counterProto = Object.create(bl().gadgetProto);

// 2. Define package/name and step function
Object.assign(counterProto, {
  pkg: "@myapp/gadgets",
  name: "counter",

  step(state, input) {
    // Decide what to do based on input
    if (input.increment) {
      this.update(state + 1);
    } else if (input.decrement) {
      this.update(state - 1);
    } else if (input.set !== undefined) {
      this.update(input.set);
    }
    // If no match, do nothing (reject input)
  }
});

// 3. Install the gadget
installPackage({
  gadgets: { counter: counterProto }
});

// 4. Use it
const counter = bl().fromSpec({
  pkg: "@myapp/gadgets",
  name: "counter",
  state: 0
});

counter.receive({ increment: true });  // 1
counter.receive({ increment: true });  // 2
counter.receive({ set: 10 });          // 10
counter.receive({ decrement: true });  // 9
```

### Extension Pattern (Install Functions)

Extensions modify `gadgetProto` to add methods to all gadgets:

```javascript
import { bl } from "@bassline/core";

export function installMyExtension() {
  const { gadgetProto } = bl();

  // Check if already installed
  if (gadgetProto.myMethod !== undefined) {
    return;
  }

  // Add methods to prototype
  Object.assign(gadgetProto, {
    myMethod() {
      // Now all gadgets have this method
      console.log("Extended!", this.current());
    }
  });
}

// Auto-install on import (common pattern)
installMyExtension();
```

### Available Packages

**@bassline/core** - Core protocol and package system
- `bl()` - Access global bassline runtime
- `installPackage(pkg)` - Install gadget packages
- `fromSpec(spec)` - Create gadgets from specifications
- Package loading/exporting for meta-circularity

**@bassline/cells** - ACI merge strategies
- `numeric` - Max, Min (monotonic numbers)
- `set` - Union, Intersection (set operations)
- `tables` - First, Last (table merge strategies)
- `versioned` - Version-tracked values
- `unsafe` - Last-write-wins (no merge)

**@bassline/taps** - Observation extension
- `tap(fn)` - Subscribe to all effects
- `tapOn(key, fn)` - Subscribe to specific effect
- Auto-installs on import

**@bassline/functions** - Function composition
- Map, partial application
- Math, logic, array operations
- HTTP request handling

**@bassline/relations** - Gadget wiring
- `wire` - Connect gadgets together
- Connection management

**@bassline/systems** - Compound gadgets
- `compound` - Compose gadgets into systems
- Meta-circular package description

**@bassline/refs** - Reference types
- `localRef` - Local scope references
- `gadgetRef` - References to other gadgets
- `fileRef`, `webRef` - External references

**@bassline/react** - React hooks
- `useGadget(gadget, effects)` - Subscribe and re-render
- Works with any gadget

**@bassline/metadata** - Metadata extension
**@bassline/devtools** - Developer utilities
**@bassline/registry** - Global gadget registry

## Common Patterns

### Bidirectional Sync

```javascript
import { bl } from "@bassline/core";
import "@bassline/cells";
import "@bassline/taps";

const { fromSpec } = bl();

const a = fromSpec({ pkg: "@bassline/cells/numeric", name: "max", state: 0 });
const b = fromSpec({ pkg: "@bassline/cells/numeric", name: "max", state: 0 });

a.tapOn("changed", (newValue) => b.receive(newValue));
b.tapOn("changed", (newValue) => a.receive(newValue));

a.receive(5);  // Both a and b become 5
```

### Async Propagation

```javascript
import { bl } from "@bassline/core";
import "@bassline/cells";
import "@bassline/taps";

const { fromSpec } = bl();

const source = fromSpec({ pkg: "@bassline/cells/numeric", name: "max", state: 0 });
const delayed = fromSpec({ pkg: "@bassline/cells/unsafe", name: "last", state: 0 });

source.tap(async ({ changed }) => {
  if (changed !== undefined) {
    await new Promise(r => setTimeout(r, 100));
    delayed.receive(changed);
  }
});
```

### Aggregation

```javascript
import { bl } from "@bassline/core";
import "@bassline/cells";
import "@bassline/taps";

const { fromSpec } = bl();

const nums = [1, 2, 3].map(n =>
  fromSpec({ pkg: "@bassline/cells/numeric", name: "max", state: n })
);
const sum = fromSpec({ pkg: "@bassline/cells/unsafe", name: "last", state: 0 });

nums.forEach(n => {
  n.tap(() => {
    const total = nums.reduce((acc, g) => acc + g.current(), 0);
    sum.receive(total);
  });
});
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

All packages are vanilla ES modules with no build step:

**Package structure:**
```json
{
  "name": "@bassline/[package]",
  "type": "module",
  "main": "./src/index.js",
  "exports": {
    ".": "./src/index.js"
  }
}
```

Each package auto-installs on import. Consuming apps (like Vite) handle bundling. We ship source directly.

## Meta-Circularity: Package Description Language

The system can describe and extend itself using its own primitives:

```javascript
import { bl } from "@bassline/core";
import "@bassline/systems";

// Create a compound gadget (gadgets composed of other gadgets)
const myCompound = bl().fromSpec({
  pkg: "@bassline/systems",
  name: "compound",
  state: {
    imports: { cells: "@bassline/cells/numeric" },
    gadgets: {
      threshold: { type: "cells.max", state: 50 },
      input: { type: "cells.max", state: 0 }
    }
  }
});

// Export it as a reusable package definition
import { exportAsPackage, savePackage } from "@bassline/core";

const packageDef = exportAsPackage(myCompound.toSpec(), {
  name: "@myapp/filters",
  gadgetName: "valueFilter"
});

await savePackage(packageDef, "./my-filter.json");

// Load it back and use it
import { loadPackageFromFile } from "@bassline/core";

await loadPackageFromFile("./my-filter.json");

// Now it's available like any built-in gadget
const filter = bl().fromSpec({
  pkg: "@myapp/filters",
  name: "valueFilter",
  state: { threshold: 100 }
});
```

**This closes the loop**: The system can now describe itself as data, load new capabilities from data, and export runtime structures as reusable types.

## Remember

This system's power comes from its **minimalism** and **semantic openness**. The core is intentionally simple - complexity emerges from composition. When in doubt, make another gadget rather than making existing gadgets more complex.

Both effects and taps are **fire-and-forget** - this isn't a limitation, it's what enables the model to work across any transport (memory, network, IPC) without changes. Timing and delivery are concerns for meta-gadgets if needed, not the core model.

The prototype-based extension system means **one install, universal behavior**. No wrappers, no providers, no ceremony.

The goal is to do more than anyone else in the world not by having more features, but by having the right primitive that composes infinitely.
