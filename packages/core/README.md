# @bassline/core

The core gadget protocol and pattern library. ~28 lines of core code.

## What is a Gadget?

A gadget is a simple stateful unit with a minimal protocol:

```javascript
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

## Creating Gadgets

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

## Taps Extension (Mechanical Wiring)

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

Taps are **fire-and-forget** - they can be sync or async, and the emitting gadget doesn't care about timing or delivery guarantees.

## Lattice Operations (Cells)

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

### Custom Gadget Classes

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

## Extension Pattern

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

## Pattern Libraries

**Cells** (`patterns/cells/`):
- `numeric`: Max, Min for monotonic numbers
- `set`: Union, Intersection for set operations
- `tables`: First, Last, table merge strategies
- `versioned`: Version-tracked values

**Functions** (`patterns/functions/`):
- Function composition
- Partial application

**Relations** (`patterns/relations/`):
- Relational data patterns

## No Bundler Needed

Vanilla ES modules with no build step:

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

## Philosophy

The core is intentionally minimal (~28 lines). Complexity emerges from composition, not the primitive.

Effects and taps are **fire-and-forget** - this isn't a limitation, it's what enables the model to work across any transport (memory, network, IPC) without changes.

See [../../CLAUDE.md](../../CLAUDE.md) for the complete guide.
