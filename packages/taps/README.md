# @bassline/taps

Taps extension for Bassline - observe gadget effects.

## Installation

```bash
pnpm add @bassline/taps
```

## Usage

Taps auto-install on import:

```javascript
import "@bassline/taps";  // Auto-installs
import { max } from "@bassline/cells";

const gadget = max.spawn(0);

// Now all gadgets have tap methods
const cleanup = gadget.tap(effects => {
  console.log("Effects:", effects);
});

// Tap specific effects
gadget.tapOn("changed", ({ newState }) => {
  console.log("Changed to:", newState);
});

// Cleanup when done
cleanup();
```

## API

### `gadget.tap(fn)`

Subscribe to all effects from a gadget. Returns cleanup function.

### `gadget.tapOn(eventKey, fn)`

Subscribe to specific effect. Returns cleanup function.

### `gadget.emit(data)`

Emit effects to all taps. Extended by this package.

## Fire-and-Forget

Taps are fire-and-forget - they can be sync or async, and the emitting gadget doesn't care about timing or delivery. This uniformity means the same gadget works in-memory, over network, or across processes without modification.
