# Context: Bassline JavaScript Implementation

## Current State (2025-10-09)

**Major milestone**: The **Sex Editor** is now functional! This is the visual development environment for Bassline - a REPL for gadget networks.

The system has been restructured into separate packages and rewritten in vanilla JavaScript (no TypeScript). The core philosophy remains the same, but the implementation is now simpler and more dynamic.

## Sex Editor - The Bassline IDE

Location: `apps/web/app/routes/sex-editor.tsx`

This is now the **primary development interface** for Bassline. Think: Jupyter notebooks for gadget networks, DevTools for propagation systems.

### Three-Panel Layout

**Left: Explorer**
- Tree view of spawned gadgets with nesting support
- Click to select and inspect
- Icons: 🔢 numeric, 📝 tables, 📦 sex, 🔗 wire
- Shows inline state preview

**Center: Tabbed Workspace**
- **Actions Tab**: JSON editor for sex action arrays
  - Example dropdown with common patterns
  - Execute button (or Cmd+Enter)
- **History Tab**: Log of executed actions with timestamps
  - Click to copy back to editor
  - Clear button
- **Effects Tab**: Live log of all effects from all gadgets
  - Auto-taps every gadget in workspace
  - Shows gadget name, effect type, timestamp

**Right: Inspector**
- Shows selected gadget's package, name, state
- **Smart input**: Auto-parses types
  - Type `42` → number
  - Type `hello` → string
  - Type `true` → boolean
  - Type `{"x":1}` → JSON
  - No manual quotes needed!

### Keyboard Shortcuts
- `Cmd+Enter` / `Ctrl+Enter`: Execute actions
- `Cmd+S` / `Ctrl+S`: Save workspace

### Save/Load Modes

When loading a workspace, three options:
1. **Add to current** - Execute actions in current workspace (compositional!)
2. **As nested workspace** - Spawn as new sex gadget (modular!)
3. **Replace current** - Kill all, then load (clean slate)

**This makes workspaces infinitely composable** - load workspaces inside workspaces!

## Sex Gadget (`packages/systems/src/sex.js`)

Sequential execution environment for building gadget networks.

### Actions DSL

**Core Actions**:
- `["spawn", name, spec]` - Create gadget in namespace
- `["send", name, value]` - Send value to gadget
- `["val", name, value]` - Define value binding
- `["withVals", [names], action]` - Execute with val scope
- `["ref", [names], action]` - Execute with ref scope

**Substitution Rules**:
- In `ref` scope: strings → gadget instances
- In `withVals` scope: `{ "$val": "name" }` → bound value
- Outside scopes: no substitution

**Example**:
```javascript
[
  ["val", "initial", 42],
  ["withVals", ["initial"],
    ["spawn", "counter", {
      pkg: "@bassline/cells/numeric",
      name: "max",
      state: { "$val": "initial" }
    }]
  ]
]
```

### Serialization Pattern

`sex.stateSpec()` converts spawned gadgets back to spawn actions:
```javascript
stateSpec() {
  const spawned = this.current();
  const actions = [];
  for (const [name, gadget] of Object.entries(spawned)) {
    actions.push(["spawn", name, gadget.toSpec()]);
  }
  return actions;
}
```

Now `sex.toSpec()` returns executable action arrays. **The spec IS the program** that creates the state!

This makes workspaces:
- **Versionable** - Git tracks action sequences
- **Shareable** - JSON files run anywhere
- **Composable** - Load inside other workspaces
- **Reproducible** - Same actions = same state

## Package Structure

```
packages/
├── core/         - Core gadget protocol, package system (bl(), fromSpec, installPackage)
├── cells/        - ACI merge strategies (max, min, union, intersection, first, last)
├── taps/         - Observation extension (tap, tapOn, emit)
├── functions/    - Function composition (map, partial, math, logic, array, http)
├── relations/    - Gadget wiring (scopedWire)
├── systems/      - Sequential execution (sex) - **compound deleted**
├── refs/         - Reference types (localRef, gadgetRef, fileRef, webRef)
├── metadata/     - Metadata extension
├── devtools/     - Developer utilities
├── registry/     - Global gadget registry
└── react/        - React integration (hooks added to gadgetProto)
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
  },
  kill() {
    this.emit({ killed: true });
    this.onKill();
  },
  onKill() {
    this[StateSymbol] = null;
  },
  toSpec() {
    return {
      pkg: this.pkg,
      name: this.name,
      state: this.stateSpec(),
    };
  },
  stateSpec() {
    return this.current();
  }
};
```

**Key insight**: `emit()` goes nowhere by default. Communication is NOT baked into the protocol.

### The Package System

Three key functions in [packages/core/src/index.js](../packages/core/src/index.js):

1. **`bl()`** - Access global bassline runtime
2. **`installPackage(pkg)`** - Install gadgets
3. **`fromSpec(spec)`** - Create gadgets from data

### Auto-Install Pattern

All packages follow this pattern:
```javascript
import { installPackage } from "@bassline/core";
import myGadget from "./myGadget.js";

const package = {
  gadgets: { myGadget }
};

installPackage(package);
export default package;
```

This means `import "@bassline/cells"` automatically registers all cell gadgets.

### The Taps Extension

Located in [packages/taps/src/index.js](../packages/taps/src/index.js):

Modifies `gadgetProto` to add observation:
```javascript
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
```

**Fire-and-forget**: Taps don't guarantee delivery or timing. This enables distribution without changes to the gadget model.

### Cell Patterns

Example from [packages/cells/src/numeric.js](../packages/cells/src/numeric.js):

```javascript
export const max = Object.create(gadgetProto);
Object.assign(max, {
  pkg: "@bassline/cells/numeric",
  name: "max",
  step(current, input) {
    if (input > current) this.update(input);
    // Otherwise reject (do nothing)
  }
});
```

Available cells:
- **Numeric**: `max`, `min` (monotonic numbers)
- **Set**: `union`, `intersection` (set operations)
- **Tables**: `first`, `last` (merge strategies for objects)
- **Versioned**: Version-tracked values
- **Unsafe**: `last` (no merge, always replace)

### React Integration

Located in [packages/react/src/index.js](../packages/react/src/index.js):

`installReact()` adds hooks directly to gadgetProto:
```javascript
Object.assign(gadgetProto, {
  useCurrent() {
    return useSyncExternalStore(
      (callback) => this.tapOn("changed", () => callback()),
      () => this.current()
    );
  },
  useSend() {
    return useCallback((value) => this.receive(value), [this]);
  },
  useState() {
    return [this.useCurrent(), this.useSend()];
  }
});
```

Now **every gadget** has React hooks. No providers, no wrappers!

## Key Patterns

### ScopedWire Gadget

`packages/relations/src/scopedWire.js` - Elegant incremental assembly:

```javascript
step(state = {}, input) {
  // If already wired, do nothing
  if (state.source && state.target) return;

  // Merge new input
  const next = { ...state, ...input };

  // If we now have both, wire them
  if (next.source && next.target) {
    const cleanup = next.source.tap((e) => next.target.receive(e));
    this.update(next);
    this.cleanup = cleanup;
  }
}
```

Can receive source/target in separate calls! Accumulates until it has both. **Partial information at the gadget level**.

### Smart Input Parsing

Type inference for effortless value sending:
```javascript
function smartParse(input: string) {
  try { return JSON.parse(input); } catch {}
  if (input === "true") return true;
  if (input === "false") return false;
  if (!isNaN(Number(input)) && input.trim() !== "") return Number(input);
  return input;
}
```

### Effects Logging

Auto-tap all gadgets to track effects:
```javascript
useEffect(() => {
  const cleanups = [];
  Object.entries(workspace).forEach(([name, gadget]) => {
    const cleanup = gadget.tap((effect) => {
      effectsLogCell.receive([
        ...effectsLogCell.current(),
        { timestamp: Date.now(), gadgetName: name, effect }
      ]);
    });
    cleanups.push(cleanup);
  });
  return () => cleanups.forEach(c => c());
}, [workspace]);
```

Complete observability - see every effect in real-time.

## Anti-Patterns to Avoid

❌ **Don't put communication in step()** - communication via taps, not in gadget logic
❌ **Don't mutate state directly** - always use `this.update()`
❌ **Don't assume taps are synchronous** - they can be async
❌ **Don't create circular deps without termination** - use monotonic cells for cycles
❌ **Don't use async in step()** - step should be sync, use async taps

## Philosophy Reminders

- **Sex is a shell for gadgets** - Like bash for processes, sex for gadget networks
- **Workspaces are programs** - Specs are executable, versionable, shareable
- **Composition over complexity** - Load workspaces inside workspaces
- **Fire-and-forget everywhere** - Effects and taps have no delivery guarantees
- **Everything is data** - Actions, specs, effects - all just JSON
- **The editor IS the runtime** - No separation between dev and prod
- **Cycles are great** - They represent redundancy, multiple paths to compute
- **Don't fight the model** - If something feels hard, you're probably baking in too much

## Files to Know

### Sex Editor
- `apps/web/app/routes/sex-editor.tsx` - Main editor component (~700 lines)
- `apps/web/app/routes/home.tsx` - Landing page

### Core System
- `packages/core/src/gadget.js` - The gadget protocol (~95 lines)
- `packages/core/src/index.js` - bl(), installPackage(), fromSpec()
- `packages/core/src/scope.js` - Scope with promise resolution

### Extensions
- `packages/taps/src/index.js` - Observation via tap/tapOn (~40 lines)
- `packages/react/src/index.js` - React hooks on gadgetProto

### Systems
- `packages/systems/src/sex.js` - Sequential execution (~150 lines)
- `packages/systems/src/index.js` - installSystems(), bl().rootSex

### Relations
- `packages/relations/src/scopedWire.js` - Wire gadget
- `packages/relations/src/index.js` - Relations utilities

### Cells
- `packages/cells/src/numeric.js` - Max, Min
- `packages/cells/src/tables.js` - First, Last
- `packages/cells/src/unsafe.js` - Last (no merge)

## Current Status

✅ Sex editor functional and usable
✅ Save/load with composition modes
✅ Smart input parsing
✅ Effects logging and history tracking
✅ Keyboard shortcuts
✅ Sex serialization fixed
✅ ScopedWire incremental assembly

**The system is self-hosting ready** - use the sex editor to build Bassline!

## How to Use the Sex Editor

1. Start dev server: `pnpm dev` in `apps/web`
2. Navigate to `http://localhost:5173/sex-editor`
3. Write sex actions in Actions tab (or pick example)
4. Hit Execute (Cmd+Enter)
5. Watch Explorer update with spawned gadgets
6. Click gadgets to inspect
7. Use Quick Send with smart parsing
8. Check History/Effects tabs
9. Save (Cmd+S) to export JSON
10. Load to add/nest/replace

## Next Steps / Ideas

### Phase 2: Advanced Editor
- Context menu on tree nodes
- Visual wire editor (drag connections)
- Command palette (Cmd+K)
- Undo/redo
- Syntax highlighting

### Phase 3: Meta-Circular
- Export workspace as package
- Package marketplace
- Live collaboration
- Visual package builder

### Phase 4: Distribution
- Network transports (WebSocket, HTTP)
- Persistent storage (IndexedDB, Postgres)
- Worker execution (off main thread)
- Time-travel debugging
