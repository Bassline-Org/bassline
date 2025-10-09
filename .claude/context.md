# Context: Bassline JavaScript Implementation

## Current State (2025-10-08)

The system has been **restructured into separate packages** and **rewritten in vanilla JavaScript** (no TypeScript). The core philosophy remains the same, but the implementation is now simpler and more dynamic.

## Package Structure

```
packages/
├── core/         - Core gadget protocol, package system (bl(), fromSpec, installPackage)
├── cells/        - ACI merge strategies (max, min, union, intersection, first, last)
├── taps/         - Observation extension (tap, tapOn, emit)
├── functions/    - Function composition (map, partial, math, logic, array, http)
├── relations/    - Gadget wiring utilities
├── systems/      - Compound gadgets (meta-circularity)
├── refs/         - Reference types (localRef, gadgetRef, fileRef, webRef)
├── metadata/     - Metadata extension
├── devtools/     - Developer utilities
├── registry/     - Global gadget registry
└── react/        - React integration (useGadget hook)
```

All packages are **vanilla JavaScript ES modules** with no build step. Each package **auto-installs on import**.

## Core Concepts

### The Gadget Protocol

Located in [packages/core/src/gadget.js](../packages/core/src/gadget.js):

```javascript
export const gadgetProto = {
  receive(input) {
    const validated = this.validate(input);
    if (validated === undefined) return;
    this.step(this.current(), validated);
  },
  validate(input) { return input; },
  [StateSymbol]: null,
  current() { return this[StateSymbol]; },
  update(newState) {
    const old = this.current();
    this[StateSymbol] = newState;
    this.emit({ changed: newState, delta: { old, newState } });
  },
  emit(_data) {},  // No-op by default - semantic openness!
  spawn(initial) {
    const g = Object.create(this);
    g.afterSpawn(initial);
    return g;
  },
  afterSpawn(initial) {
    this.update(initial);
  }
};
```

**Key insight**: `emit()` goes nowhere by default. Communication is NOT baked into the protocol.

### The Package System

Three key functions in [packages/core/src/index.js](../packages/core/src/index.js):

1. **`bl()`** - Access global bassline runtime:
```javascript
import { bl } from "@bassline/core";
const { gadgetProto, packages, fromSpec } = bl();
```

2. **`installPackage(pkg)`** - Install gadgets:
```javascript
import { installPackage } from "@bassline/core";

const myProto = Object.create(bl().gadgetProto);
Object.assign(myProto, {
  pkg: "@myapp/gadgets",
  name: "counter",
  step(state, input) {
    if (input.increment) this.update(state + 1);
  }
});

installPackage({
  gadgets: { counter: myProto }
});
```

3. **`fromSpec(spec, resolver)`** - Create gadgets from data:
```javascript
const gadget = bl().fromSpec({
  pkg: "@bassline/cells/numeric",
  name: "max",
  state: 0
});

// Or with type resolution:
const gadget = bl().fromSpec(
  { type: "cells.max", state: 0 },
  resolver
);
```

### Auto-Install Pattern

All packages follow this pattern:

```javascript
// packages/[name]/src/index.js
import { installPackage } from "@bassline/core";
import myGadget from "./myGadget.js";

const package = {
  gadgets: { myGadget }
};

// Auto-install on import
installPackage(package);

export default package;
export * from "./myGadget.js";
```

This means `import "@bassline/cells"` automatically makes all cell gadgets available via `bl().packages["@bassline/cells/numeric"].max`.

### The Taps Extension

Located in [packages/taps/src/index.js](../packages/taps/src/index.js):

```javascript
export function installTaps() {
  const { gadgetProto } = bl();

  const originalEmit = gadgetProto.emit;
  Object.assign(gadgetProto, {
    tap(fn) {
      if (this.taps === undefined) this.taps = new Set();
      this.taps.add(fn);
      return () => this.taps.delete(fn);
    },
    emit(data) {
      originalEmit.call(this, data);
      this.taps?.forEach(fn => fn(data));
    },
    tapOn(key, fn) {
      return this.tap(effects => {
        if (effects[key] !== undefined) {
          fn(effects[key]);
        }
      });
    }
  });
}

// Auto-install
installTaps();
```

**Fire-and-forget**: Taps don't guarantee delivery or timing. This enables distribution without changes to the gadget model.

### Cell Patterns

All cells follow the same pattern. Example from [packages/cells/src/numeric.js](../packages/cells/src/numeric.js):

```javascript
import { bl } from "@bassline/core";

const max = Object.create(bl().gadgetProto);
Object.assign(max, {
  pkg: "@bassline/cells/numeric",
  name: "max",
  step(state, input) {
    if (input > state) {
      this.update(input);
    }
    // Otherwise reject (do nothing)
  }
});

export default {
  gadgets: { max }
};
```

Available cells:
- **Numeric**: `max`, `min` (monotonic numbers)
- **Set**: `union`, `intersection` (set operations)
- **Tables**: `first`, `last` (merge strategies for objects)
- **Versioned**: Version-tracked values
- **Unsafe**: `last` (no merge, always replace)

### Compound Gadgets (Meta-Circularity)

Located in [packages/systems/src/compound.js](../packages/systems/src/compound.js):

Compound gadgets are **gadgets composed of other gadgets**. They enable meta-circularity:

```javascript
import { bl } from "@bassline/core";
import "@bassline/systems";

const compound = bl().fromSpec({
  pkg: "@bassline/systems",
  name: "compound",
  state: {
    imports: { cells: "@bassline/cells/numeric" },
    gadgets: {
      threshold: { type: "cells.max", state: 50 },
      input: { type: "cells.max", state: 0 }
    },
    interface: {
      inputs: { value: "input", min: "threshold" },
      outputs: { output: "input" }
    }
  }
});

// Access internal gadgets
compound.current().gadgets.threshold.receive(100);
```

### Package Description Language

The system can **export compound gadgets as reusable packages**:

```javascript
import { exportAsPackage, savePackage, loadPackageFromFile } from "@bassline/core";

// 1. Create a compound
const myCompound = bl().fromSpec({
  pkg: "@bassline/systems",
  name: "compound",
  state: { /* ... */ }
});

// 2. Export as package
const packageDef = exportAsPackage(myCompound.toSpec(), {
  name: "@myapp/filters",
  gadgetName: "valueFilter"
});

// 3. Save to file
await savePackage(packageDef, "./my-filter.json");

// 4. Load from file
await loadPackageFromFile("./my-filter.json");

// 5. Use like any built-in gadget
const filter = bl().fromSpec({
  pkg: "@myapp/filters",
  name: "valueFilter",
  state: { threshold: 100 }
});
```

**This closes the meta-circular loop**: Gadgets → Compounds → Packages → Loaded Gadgets

### React Integration

Located in [packages/react/src/index.js](../packages/react/src/index.js):

Simple hook-based integration:

```javascript
import { useGadget } from "@bassline/react";
import { bl } from "@bassline/core";
import "@bassline/cells";

function Component() {
  const gadget = useMemo(() =>
    bl().fromSpec({ pkg: "@bassline/cells/numeric", name: "max", state: 0 }),
    []
  );

  // Subscribe to specific effects
  const [count] = useGadget(gadget, ["changed"]);

  return (
    <button onClick={() => gadget.receive(count + 1)}>
      Count: {count}
    </button>
  );
}
```

The `useGadget(gadget, effects)` hook:
- Uses `useSyncExternalStore` internally
- Subscribes to gadget via `tap()`
- Re-renders when specified effects are emitted
- Returns `[currentValue, gadget]`

## Key Architectural Decisions

### Why JavaScript, Not TypeScript?

The system was originally TypeScript but we discovered:
- **Dynamic behaviors** (prototype manipulation, runtime composition) fight static typing
- **Type ceremony** added complexity without proportional value
- **JavaScript's flexibility** enables emergent behaviors impossible with static types
- The system's power comes from **runtime flexibility**, not compile-time guarantees

We may add `.d.ts` files later for library consumers, but the core will remain JavaScript.

### Why Prototype Pattern?

Every gadget is created via `Object.create(proto)` and `spawn()`:
- **No classes** - simpler, more flexible
- **Shared behavior** - all instances inherit from the same proto
- **Extension via modification** - `Object.assign(gadgetProto, {...})` adds methods to all gadgets
- **Meta-circular** - protos are data, can be serialized and loaded

### Why Auto-Install?

Each package calls `installPackage()` on import:
- **Zero configuration** - just import and use
- **Side-effect imports** - `import "@bassline/taps"` is valid
- **Global registration** - available via `bl().packages`
- **Developer ergonomics** - no manual setup

### Why Fire-and-Forget?

Both effects and taps are fire-and-forget:
- **Uniformity** - same model works in-memory, over network, across processes
- **Simplicity** - no delivery guarantees or timing coordination
- **Distribution-ready** - async taps work identically to sync taps
- **Meta-gadgets** - timing/delivery concerns live in meta-gadgets if needed

## Common Patterns

### Creating Custom Gadgets

```javascript
import { bl, installPackage } from "@bassline/core";

const counterProto = Object.create(bl().gadgetProto);
Object.assign(counterProto, {
  pkg: "@myapp/gadgets",
  name: "counter",
  step(state, input) {
    if (input.increment) this.update(state + 1);
    if (input.decrement) this.update(state - 1);
    if (input.set !== undefined) this.update(input.set);
  }
});

installPackage({
  gadgets: { counter: counterProto }
});

const counter = bl().fromSpec({
  pkg: "@myapp/gadgets",
  name: "counter",
  state: 0
});
```

### Wiring Gadgets Together

```javascript
import { bl } from "@bassline/core";
import "@bassline/cells";
import "@bassline/taps";

const source = bl().fromSpec({ pkg: "@bassline/cells/numeric", name: "max", state: 0 });
const target = bl().fromSpec({ pkg: "@bassline/cells/numeric", name: "max", state: 0 });

// Wire via tap
source.tapOn("changed", newValue => target.receive(newValue));

source.receive(5);  // target also becomes 5
```

### Bidirectional Sync

```javascript
const a = bl().fromSpec({ pkg: "@bassline/cells/numeric", name: "max", state: 0 });
const b = bl().fromSpec({ pkg: "@bassline/cells/numeric", name: "max", state: 0 });

a.tapOn("changed", v => b.receive(v));
b.tapOn("changed", v => a.receive(v));

a.receive(10);  // Both become 10
```

### Async Propagation

```javascript
const source = bl().fromSpec({ pkg: "@bassline/cells/numeric", name: "max", state: 0 });
const delayed = bl().fromSpec({ pkg: "@bassline/cells/unsafe", name: "last", state: 0 });

source.tap(async ({ changed }) => {
  if (changed !== undefined) {
    await new Promise(r => setTimeout(r, 100));
    delayed.receive(changed);
  }
});
```

## Anti-Patterns to Avoid

❌ **Don't put communication in step()** - communication should be via taps, not in the gadget logic
❌ **Don't mutate state directly** - always use `this.update()`
❌ **Don't assume taps are synchronous** - they can be async
❌ **Don't create circular deps without termination** - bidirectional sync with non-idempotent cells will loop forever
❌ **Don't use async in step()** - step should be synchronous, use async taps instead

## Files to Know

### Core System
- [packages/core/src/gadget.js](../packages/core/src/gadget.js) - The gadget protocol (~60 lines)
- [packages/core/src/index.js](../packages/core/src/index.js) - bl(), installPackage(), fromSpec()
- [packages/core/src/packageLoader.js](../packages/core/src/packageLoader.js) - Load packages from JSON
- [packages/core/src/packageExporter.js](../packages/core/src/packageExporter.js) - Export gadgets as packages
- [packages/core/src/packageResolver.js](../packages/core/src/packageResolver.js) - Type resolution

### Extensions
- [packages/taps/src/index.js](../packages/taps/src/index.js) - Observation via tap/tapOn
- [packages/metadata/src/index.js](../packages/metadata/src/index.js) - Metadata extension
- [packages/devtools/src/index.js](../packages/devtools/src/index.js) - Developer utilities
- [packages/registry/src/index.js](../packages/registry/src/index.js) - Global registry

### Patterns
- [packages/cells/src/numeric.js](../packages/cells/src/numeric.js) - Max, Min
- [packages/cells/src/set.js](../packages/cells/src/set.js) - Union, Intersection
- [packages/cells/src/tables.js](../packages/cells/src/tables.js) - First, Last
- [packages/cells/src/unsafe.js](../packages/cells/src/unsafe.js) - Last (no merge)
- [packages/systems/src/compound.js](../packages/systems/src/compound.js) - Compound gadgets
- [packages/refs/src/localRef.js](../packages/refs/src/localRef.js) - Local references

### React
- [packages/react/src/index.js](../packages/react/src/index.js) - useGadget hook

## What Changed from TypeScript Version

1. **No types** - Removed all TypeScript type annotations
2. **No generics** - No `<S, I, A, E>` type parameters
3. **No interfaces** - Removed Protocol interfaces, Implements, Emits helpers
4. **Simpler protos** - Just objects with methods, no complex type machinery
5. **Runtime-first** - Focus on what works at runtime, not what type-checks
6. **Dynamic composition** - Leverage JavaScript's flexibility for meta-programming

The **core philosophy remains identical**, just without static type constraints.

## Next Steps

The system is now:
- ✅ Restructured into separate packages
- ✅ Rewritten in vanilla JavaScript
- ✅ Meta-circular (package description language working)
- ✅ Auto-installing (zero config)
- ✅ React-integrated (useGadget hook)

Possible directions:
- Visual package editor (edit compounds, export as packages)
- Package repositories (gadgets managing packages)
- Runtime package loading (load from URLs)
- Live editing (modify running compounds)
- Network distribution (gadgets across WebSockets/HTTP)
