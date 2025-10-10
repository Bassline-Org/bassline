# Context: Bassline JavaScript Implementation

## Current State (2025-10-09)

**Major milestone**: The **Sex Editor** is now a **canvas-based IDE** with nested workspace navigation! This is the visual development environment for Bassline - think Figma for gadget networks.

The system has been restructured into separate packages and rewritten in vanilla JavaScript (no TypeScript). The core philosophy remains the same, but the implementation is now simpler and more dynamic.

### Recent Canvas Architecture Update

The sex editor has been transformed from a three-panel text-based interface into a **canvas-based visual IDE** using React Flow. Key features:

- **Graph Canvas**: Drag-and-drop nodes and edges
- **Nested Workspaces**: Double-click sex nodes to navigate inside
- **Breadcrumb Navigation**: Click to navigate back up workspace hierarchy
- **Auto-layout**: dagre algorithm for automatic graph layout
- **Inspector Panel**: Interactive gadget inspection with quick send
- **Sidebar**: Package browser with gadget spawning

## Sex Editor - The Bassline IDE

Location: `apps/web/app/routes/sex-editor/route.tsx`

This is now the **primary development interface** for Bassline. Think: Figma meets Jupyter notebooks for gadget networks.

### Canvas-Based Architecture

The editor uses **React Flow** (@xyflow/react) for the canvas and is split into components:

**route.tsx** - Main orchestrator
- Manages `rootSex` (top-level workspace)
- Tracks `navigationStack` (path through nested sex workspaces)
- Calculates `currentSex` (active workspace being edited)
- Provides navigation handlers (`handleNavigateInto`, `handleNavigateToLevel`)

**CanvasView.tsx** - Graph editor
- Receives `currentSex` (CRITICAL: not rootSex!)
- Converts workspace to nodes/edges
- Handles canvas operations (connect, delete, drag)
- **All operations must target currentSex** to work in nested scopes

**GadgetNode.tsx** - Visual gadget representation
- Shows gadget icon, name, state preview
- Double-click sex nodes to navigate inside
- Visual indicators (↴ symbol, purple hover) for navigable nodes
- Flash animation on state changes

**Inspector.tsx** - Gadget introspection panel
- Quick send with smart parsing (JSON, booleans, numbers)
- Quick value buttons (0, 1, true, false, null, {}, [])
- Effects history (last 5 effects, per-gadget)
- Connection display (incoming/outgoing wires)

**Breadcrumb.tsx** - Navigation path
- Shows: root › workspace › nested
- Click to navigate back to any level
- Highlights current workspace

**Sidebar.tsx** - Package browser
- Lists all installed packages
- Drag or click to spawn gadgets
- Icons per gadget type

### Navigation Stack Pattern

**Critical Architecture**: Navigation uses a stack to track the path through nested workspaces:

```typescript
// Stack structure
const navigationStack = [
  { sex: rootSex, name: "root" },
  { sex: nestedSex, name: "workspace1", parentSex: rootSex },
  { sex: deeperSex, name: "workspace2", parentSex: nestedSex }
];

// Current workspace is always the last item
const currentFrame = navigationStack[navigationStack.length - 1];
const currentSex = currentFrame.sex;

// Navigate into: append to stack
handleNavigateInto(name, gadget) {
  navigationStackCell.receive([...stack, { sex: gadget, name, parentSex: currentSex }]);
}

// Navigate back: slice stack
handleNavigateToLevel(index) {
  navigationStackCell.receive(stack.slice(0, index + 1));
}
```

**Why this matters**: All canvas operations (spawn, delete, wire) must use `currentSex`, not `rootSex`. Using rootSex breaks operations in nested workspaces.

### Wire Serialization Pattern

**Critical Detail**: Wires store BOTH gadget refs (runtime) AND names (persistence):

```javascript
// When creating wire via sex.wire()
await fromSpec({
  pkg: "@bassline/relations",
  name: "scopedWire",
  state: {
    source,      // Gadget instance (for tapping)
    target,      // Gadget instance (for tapping)
    sourceName,  // String name (for serialization/canvas)
    targetName   // String name (for serialization/canvas)
  }
});

// Canvas uses names to display edges
edges.push({
  id: wireName,
  source: wireState.sourceName,  // NOT wireState.source!
  target: wireState.targetName
});
```

### Critical Lifecycle Pattern

**scopedWire afterSpawn**: Must call `receive()` not just `update()` to trigger step() for tap setup:

```javascript
afterSpawn(initial) {
  this.update({});         // Initialize to empty state first
  this.receive(initial);   // Then receive to trigger step()
}

step(state = {}, input) {
  const { source, target } = state;
  if (source && target) return;  // Already wired

  const next = { ...state, ...input };
  if (next.source && next.target) {
    const cleanup = next.source.tap((e) => next.target.receive(e));
    this.update(next);
    this.cleanup = cleanup;
  }
}
```

**Why**: `update()` bypasses `receive()` → `validate()` → `step()`, so tap setup never happens.

### Keyboard Shortcuts (Current)
- **Delete** - Delete selected nodes/edges
- **Double-click** - Navigate into sex nodes
- **Drag** - Pan canvas
- **Scroll** - Zoom
- **Click breadcrumb** - Navigate back

### Planned Enhancements
See [.claude/sex-editor-roadmap.md](./.sex-editor-roadmap.md) for full enhancement plan:
- Command Palette (Cmd+K)
- More keyboard shortcuts (Cmd+D, Escape, Cmd+W, etc.)
- Context menus
- Sidebar redesign
- Canvas polish (minimap, controls, grid)
- Smart wire creation
- Visual enhancements (effect flow, state diff)

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

### Sex Editor (Canvas-Based)
- `apps/web/app/routes/sex-editor/route.tsx` - Main orchestrator
- `apps/web/app/routes/sex-editor/components/CanvasView.tsx` - React Flow canvas
- `apps/web/app/routes/sex-editor/components/GadgetNode.tsx` - Visual node component
- `apps/web/app/routes/sex-editor/components/Inspector.tsx` - Gadget inspector panel
- `apps/web/app/routes/sex-editor/components/Breadcrumb.tsx` - Navigation breadcrumbs
- `apps/web/app/routes/sex-editor/components/Sidebar.tsx` - Package browser
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

✅ Canvas-based visual editor with React Flow
✅ Nested workspace navigation (double-click sex nodes)
✅ Breadcrumb navigation (click to go back)
✅ Auto-layout with dagre algorithm
✅ Drag-and-drop gadget spawning
✅ Visual wire creation (connect nodes)
✅ Inspector with quick send and effects history
✅ Smart input parsing (JSON, booleans, numbers)
✅ Wire serialization (refs + names pattern)
✅ ScopedWire afterSpawn pattern (receive not update)
✅ currentSex vs rootSex pattern (operations target correct level)

**The system is visual and intuitive** - use the canvas to build Bassline!

## How to Use the Sex Editor

1. Start dev server: `pnpm dev` in `apps/web`
2. Navigate to `http://localhost:5173/sex-editor`
3. **Spawn gadgets** from left sidebar (click or drag to canvas)
4. **Wire gadgets** by dragging from one node to another
5. **Navigate nested workspaces** by double-clicking sex nodes
6. **Navigate back** by clicking breadcrumbs
7. **Select gadgets** to inspect in right panel
8. **Quick send values** using inspector input or quick buttons
9. **Delete nodes/edges** by selecting and pressing Delete
10. **Auto-layout** by clicking the layout button

## Next Steps

See [.claude/sex-editor-roadmap.md](./.sex-editor-roadmap.md) for comprehensive enhancement plan.

### Immediate Priorities
1. ✅ ~~Fix Inspector bugs~~ (quick buttons + effects clearing)
2. 🚀 **Command Palette** (Cmd+K) - HIGHEST IMPACT
3. ⌨️ Keyboard shortcuts (Delete, Cmd+D, Escape, etc.)
4. 🖱️ Context menus (right-click nodes/canvas/wires)
5. 📚 Sidebar redesign (collapsible packages, search, favorites)

### Future Phases
- Canvas polish (minimap, controls, grid, animations)
- Smart wire creation (auto-wire, suggestions)
- Visual enhancements (effect flow, state diff, heat map)
- Multi-selection operations
- Collaboration (export/import, share via link)
- Persistence (localStorage, named workspaces)
- Developer tools (console, profiler, debugger)
- Distribution (WebSocket, HTTP, workers)
