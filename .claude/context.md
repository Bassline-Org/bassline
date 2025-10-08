# Context: Current Understanding of Gadget System Evolution

## Protocol System - Behavioral Contracts for Gadgets

### The Core Philosophy

**Effects define behavioral contracts, actions are implementation details.**

When we write generic code that operates on gadgets, we don't care about:
- How state is stored internally (implementation)
- What actions the step chooses (private vocabulary)

We only care about:
- What inputs the gadget accepts (public commands)
- What effects it emits (observable behavior)

This separation enables **behavioral polymorphism** - code that works with ANY gadget implementing a particular protocol.

### Protocol Helper Types

Located in `src/core/context.ts`:

```typescript
// Constrain by what a gadget accepts
type Accepts<I> = Gadget<any, I, any, any>

// Constrain by what effects it emits (includes Tappable)
type Emits<E extends Record<string, any>> = Gadget<any, any, any, E> & Tappable<E>

// Full behavioral contract (input + effects)
type Protocol<I, E extends Record<string, any>> = Gadget<any, I, any, E> & Tappable<E>

// Define reusable protocol shapes
interface ProtocolShape<I, E extends Record<string, any>> {
  input: I;
  effects: E;
}

// Convert protocol shape to gadget constraint
type Implements<P extends ProtocolShape<any, any>> = ...

// Compose two protocols
type And<P1, P2> = ProtocolShape<P1['input'] | P2['input'], P1['effects'] & P2['effects']>
```

### Standard Protocols Library

Located in `src/core/protocols.ts` - 11 common behavioral patterns:

1. **`Valued<T>`** - Holds and emits value changes (cells, sliders, counters)
2. **`Clearable`** - Can be reset (inputs, accumulators)
3. **`Fallible`** - Can produce errors (validators, network requests)
4. **`Validator<T>`** - Validates input against rules
5. **`Requester<Req, Res>`** - Request/response pattern (HTTP, RPC)
6. **`Aggregator<T, R>`** - Aggregates multiple inputs (sum, average)
7. **`Temporal<T>`** - Timestamped changes (event logs, time series)
8. **`Collection<T>`** - Manages items (lists, sets, registries)
9. **`Toggleable`** - Can be enabled/disabled (UI controls, flags)
10. **`Topology`** - Manages connections (basslines, routers)
11. **`Registry<T>`** - Manages named items (namespaces, symbol tables)

### Usage Patterns

**Instead of constraining by implementation:**
```typescript
// Before: Exposes implementation details
function mirror<S, I, A, E>(
  source: Gadget<S, I, A, E> & Tappable<E>,
  target: Gadget<S, I, A, E>
) { ... }
```

**Constrain by behavioral contract:**
```typescript
// After: Only cares about behavior
function mirror<T>(
  source: Implements<Protocols.Valued<T>>,
  target: Implements<Protocols.Valued<T>>
) {
  source.tap(({ changed }) => {
    if (changed !== undefined) target.receive(changed);
  });
}
```

### Key Benefits

1. **Self-documenting**: `Implements<Valued<T>>` tells you exactly what the gadget does
2. **Behavioral polymorphism**: Works with cells, sliders, toggles - anything that emits `{ changed: T }`
3. **Stable contracts**: Effect protocols are the public API, actions can change freely
4. **Type safety**: Can't wire incompatible protocols
5. **Composability**: `And<P1, P2>` builds complex contracts from simple pieces

### Protocols vs Tappable

`Tappable` is just another protocol - an optional capability:

```typescript
// Core protocol - base gadget interface
interface CoreProtocol<I, E> { input: I; effects: E; }

// Observable protocol - can be tapped
interface Observable<E> extends ProtocolShape<never, E> { ... }

// A gadget can implement multiple protocols
type ObservableGadget<I, E> = Implements<CoreProtocol<I, E>> & Tappable<E>
```

Gadgets can opt into additional protocols: `Persistable`, `Serializable`, `Debuggable`, etc.

### Basslines as Protocol Implementers

Basslines are just gadgets implementing a specific protocol:

```typescript
interface BasslineProtocol {
  input:
    | { create: { id: string; type: string } }
    | { wire: { from: string; to: string } }
    | { destroy: string };
  effects:
    | { spawned: { id: string } }
    | { connected: { from: string; to: string } }
    | { destroyed: string };
}

type Bassline = Implements<BasslineProtocol>
```

Different basslines = different protocol combinations. The protocol lens makes explicit what was implicit.

### The Paradigm Shift

**Before**: "Gadgets are objects with methods and state"
**After**: "Gadgets are behavioral contracts defined by their effects"

Effects become first-class - they're not just "extra data," they're the **semantic layer** that defines what a gadget means behaviorally. Things that emit similar effects are behaviorally similar, even if their internal actions differ completely.

## Handler Architecture - Open Constraints with Record Effects

### The Type Theory Problem We Solved
We spent significant effort figuring out how to make handlers **compositional** while maintaining proper type inference. The challenge was making handlers:
- **Open over actions** (accept any superset of required fields)
- **Constrained over effects** (produce a known set of effect types)
- **Polymorphic over state** (work with any state type `S`)
- **Composable** (multiple handlers can be combined)

### What Didn't Work

#### Attempt 1: Generic Function Handlers
```typescript
type Handler<S, AMin, EMax> = <A extends AMin>(g, actions: A) => Partial<EMax>
```
**Problem**: Can't extract types from generic functions in TypeScript. `composeHandlers` can't infer what `AMin` and `EMax` are.

#### Attempt 2: Factory Functions
```typescript
const mergeHandler = <S>(): Handler<S, MergeActions<S>, MergedEffects<S>> => (g, actions) => {...}
```
**Problem**: Calling `mergeHandler()` before passing to `.handler()` means TypeScript infers `S = unknown` too early.

#### Attempt 3: Direct Generic Functions
```typescript
export function mergeHandler<S>(g, actions: MergeActions<S>): Partial<MergedEffects<S>>
```
**Problem**: Can't compose at the type level - no way to extract action/effect structure from generic function type.

### What Works: Manual Composition with Reusable Functions

**The Solution**: Don't try to compose handlers at the type level. Instead:

1. **Define handlers as simple generic functions**:
   ```typescript
   export function mergeHandler<S>(
     g: HandlerContext<S>,
     actions: MergeActions<S>
   ): Partial<MergedEffects<S>> {
     if ('merge' in actions && actions.merge !== undefined) {
       g.update(actions.merge);
       return { changed: actions.merge };
     }
     return {};
   }
   ```

2. **Call them explicitly in the handler passed to `.handler()`**:
   ```typescript
   protoGadget(step)
     .handler((g, actions) => ({
       ...mergeHandler(g, actions),
       ...contradictionHandler(g, actions)
     }))
   ```

3. **TypeScript infers everything correctly**:
   - Step defines: `S = number`, `A = { merge: number } | { contradiction: number }`
   - Handler gets typed as: `(g: HandlerContext<number>, actions: { merge: number } | { contradiction: number }) => ...`
   - Individual handler calls are type-checked
   - Effect type properly inferred as `Partial<{ changed?: number, oops?: number }>`

### Key Constraints We Added

#### Effects Must Be Records
```typescript
type Handler<S, AMin, Effects extends Record<string, any>> =
  (g: HandlerContext<S>, actions: AMin) => Partial<Effects>
```

This constraint enables:
- Clean merging via spread: `{ ...e1, ...e2 }`
- Proper TypeScript inference
- Natural representation of discrete events as keys

#### MergeEffects Utility
```typescript
type MergeEffects<E1, E2> = {
  [K in keyof E1 | keyof E2]?:
    (K extends keyof E1 ? E1[K] : never) |
    (K extends keyof E2 ? E2[K] : never)
}
```

Merges two effect records into a single record with optional fields.

### Why This Approach Wins

1. **No `any` or `unknown`** - Full type safety throughout
2. **Simple to understand** - No complex type machinery
3. **Reusable handlers** - Individual handler functions can be used in multiple gadgets
4. **Type inference works** - The `S` flows naturally from step → handler → gadget
5. **Explicit composition** - Clear what handlers are being called
6. **DRY code** - Handler logic isn't duplicated, just invoked explicitly

### The Core Insight

**Composition should happen at the value level, not the type level.** TypeScript can't extract type parameters from generic functions, so trying to build automatic handler composition is fighting the type system. Instead, make handlers simple reusable functions and compose them explicitly with spread syntax.

# Context: Current Understanding of Gadget System Evolution

## Relations Module - Type-Safe Gadget Wiring

### What We Built
My understanding is that we've created a relations system that makes wiring gadgets together more declarative:
- **`combiner`** - A builder pattern that seems to enforce type safety at compile time
- **`extract`** - Appears to pull specific effect fields and forward them as input
- **`transform`** - Like extract but applies a transformation function
- **`relations`** - Seems to compose multiple wiring operations with unified cleanup

### TypeScript Learnings I've Observed

#### Overloading Constraints
From what I can tell, TypeScript overloads need different generic constraints to actually be useful. Initially we had overloads that all accepted `Gadget<S>` with no real constraints, which defeated the purpose. The fix was to make each overload constrain `S` differently - like `S extends Effects<{ changed: InputOf<Target>[K] }>`.

#### The `any` Problem
I learned that using `Gadget<any>` breaks TypeScript's inference chain. It seems to cause variance issues where TypeScript can't reconcile `update(state: unknown)` with `update(state: number)`. The solution appears to be using proper generic constraints throughout.

#### Type Helper Benefits
We discovered that type helpers like `type AvailableKeys<Target, Wired> = Exclude<keyof InputOf<Target>, Wired>` make the code much cleaner than repeating complex type expressions everywhere.

### React Integration Progress

#### What Works Now
- **`useRelations`** hook - Appears to handle automatic cleanup of relations on unmount
- **`Wire`** component - Provides JSX syntax for declarative wiring
- **`useGadgetMap`** - Transforms gadget maps into `{state, send, gadget}` objects

#### Integration Patterns
The notebook demo now uses relations instead of manual tap management. The aggregation pattern uses `combiner` to wire sliders to a sum function. We've added a declarative wiring demo using `Wire` components.

## Bassline Meta-Gadget System

### Core Concept
My understanding is that "bassline" represents the contextual truth - what gadget names mean, how they wire, what capabilities they have. It's implemented as a composition of gadgets themselves.

### Architecture (as I understand it)
A bassline appears to be composed of four table gadgets:
1. **Namespace** - Maps names to factory functions
2. **Registry** - Maps IDs to actual gadget instances
3. **Connections** - Stores wiring information with cleanup functions
4. **Patterns** - Maps pattern names to wiring functions

### Key Design Decisions

#### Everything is Declarative Commands
Rather than imperatively manipulating data structures, basslines receive commands:
- `{ create: { id, type, args } }` - Creates instances from factories
- `{ wire: { id, from, to, pattern } }` - Establishes connections
- `{ registerFactory: { name, factory } }` - Adds to namespace
- `{ destroy: id }` - Removes instances and their connections

#### Tables All the Way Down
We realized these are essentially just tables, so we use `lastTable` from the existing patterns rather than reimplementing table logic. This gives us merge semantics and change effects for free.

#### Composition Through Effects
Basslines can observe each other's effects to compose. When one bassline registers a factory, another can observe that and mirror it. This enables derived basslines that merge vocabularies from multiple sources.

### Current Testing Status
From the tests, it appears that:
- Basic operations work (create, wire, disconnect)
- Dynamic factory registration works
- Bassline composition by merging namespaces works
- Custom wiring patterns can be added to derived basslines
- One minor issue with table updates not immediately reflecting in tests

### Files Created/Modified
- `/port-graphs/src/meta/bassline.ts` - Full-featured bassline with registry, factories, and wiring
- `/port-graphs/src/meta/bassline.test.ts` - Test suite showing bassline as a gadget
- `/port-graphs/src/meta/otherBassline.ts` - Minimal bassline showing core concept
- `/port-graphs/src/relations/index.ts` - Relations primitives (extract, transform, combiner)
- `/port-graphs-react/src/useRelations.ts` - React hook for relations
- `/port-graphs-react/src/Wire.tsx` - Declarative wiring component

### Deeper Understanding of Basslines

#### Basslines as Network Constitutions
After further exploration, I understand that a bassline is fundamentally just **a gadget that builds and manages networks of gadgets**. It defines the "ground truth" or "constitution" for that particular network. What this means is completely open to interpretation:
- One bassline might only allow monotonic gadgets
- Another might enforce strict typing rules
- Another might require authentication for connections
- Each bassline defines its own rules and semantics

#### Data Over Objects Philosophy
Basslines prioritize data over object references. The network topology is data that can be serialized, persisted, and replayed. The tension between gadget identity (objects with methods and tap Sets) and data storage is intentional - different basslines solve this differently:
- Some use ID registries
- Some store descriptions and resolve at connection time
- Some keep objects in closures outside state

#### The Minimal Bassline Pattern
The `otherBassline.ts` implementation shows that you don't even need identity tracking or registries. A minimal bassline can just:
- Accept connection descriptions (which are already closures with cleanup)
- Track cleanup functions
- Provide a way to nuke all connections
This demonstrates the absolute core of what a bassline is.

#### Bassline Flavors
Different basslines serve different purposes:
- **Registry bassline** - Tracks named instances and factories (like our main implementation)
- **Topology bassline** - Just tracks connections without caring about instances
- **Monotonic bassline** - Only allows monotonically increasing connections
- **Temporal bassline** - Connections with timeouts
- **Semantic bassline** - Enforces type compatibility or other rules

#### Meta-Bassline Patterns
Since basslines are gadgets themselves:
- Basslines can manage other basslines
- Meta-basslines can observe and coordinate multiple networks
- Basslines can modify their own rules based on observations
- The meta-layer behaves identically to the normal layer

#### Key Insights
- Basslines are NOT infrastructure or frameworks
- They're just gadgets with the convention of building networks
- A bassline IS a gadget - it receives input, maintains state, emits effects
- The uniformity (meta = normal) is what makes the system powerful
- Different basslines = different "constitutions" for networks

---

## Sugar API - Ergonomic Gadget Construction

### What We Actually Use Daily

The "sugar" layer (`port-graphs/src/sugar/`) provides the ergonomic APIs we build with. These wrap the proto-gadget system with friendly constructors.

### Cell Constructors (`cells.*`)

Located in `/port-graphs/src/sugar/cells.ts`:

```typescript
import { cells } from 'port-graphs';

// Monotonic cells
const count = cells.max(0);        // Only increases
const temp = cells.min(100);       // Only decreases

// Last-write-wins
const name = cells.last('Alice');  // Always takes newest value
const pos = cells.last({x: 0, y: 0});

// Set operations
const tags = cells.union(new Set(['a']));     // Set union (grows)
const valid = cells.intersection(new Set());  // Set intersection (shrinks)

// All return: Implements<Valued<T>> & SweetCell<T>
// Can call: .current(), .receive(), .sync()
```

**Key Pattern**: Cells are gadgets with sweet helpers like `.sync()` for bidirectional wiring.

### Table Constructors (`table.*`)

Located in `/port-graphs/src/sugar/tables.ts`:

```typescript
import { table } from 'port-graphs';

// Create tables (records of values)
const data = table.first({ a: 1, b: 2 });   // First-write-wins
const state = table.last({ x: 0, y: 0 });   // Last-write-wins

// Update
data.set({ c: 3 });                  // Merge
data.get('a');                       // → 1
data.query().whereKeys(k => k > 'a') // → { b: 2, c: 3 }

// All return: Implements<Table<string, T>> & SweetTable<T>
```

**Sweet Helpers**: `.get()`, `.set()`, `.query()`, `.whenAdded()`

### The Critical Pattern: `table.flattenTable()`

**THE KEY TO META-CIRCULARITY**:

```typescript
// A table where each ROW is GADGET CELLS
type NodeRow = {
  position: SweetCell<{x: number, y: number}>,
  type: SweetCell<'max' | 'min'>,
  gadget: SweetCell<number>,
}

const nodes = table.first<NodeRow>({
  a: {
    position: cells.last({x: 100, y: 100}),
    type: cells.last('max'),
    gadget: cells.max(0),
  },
  b: {
    position: cells.last({x: 200, y: 200}),
    type: cells.last('min'),
    gadget: cells.min(100),
  },
});

// Flatten: Gadget table → Value table (LIVE!)
const [nodeValues, cleanup] = table.flattenTable(nodes);

// nodeValues is a table gadget that emits { changed, added } when ANY cell changes
nodeValues.current() // → { a: {position: {x,y}, type: 'max', gadget: 0}, ... }

// In React:
const [state] = useGadget(nodeValues, ['changed', 'added']);
// Re-renders when any gadget cell in any row updates!
```

**How It Works**:
1. Uses `table.deriveRows()` internally
2. For each row, creates a `fn.partial()` gadget that combines all cell values
3. Taps each cell, calls the function when any cell changes
4. Fans out to aggregated table
5. Returns `[aggregatedTable, cleanupFn]`

**This is the foundation of the visual editor** - gadget tables flatten to value tables for rendering!

### Function Gadgets (`fn.*`)

Located in `/port-graphs/src/sugar/functions.ts`:

```typescript
import { fn } from 'port-graphs';

// Map function
const double = fn.map((x: number) => x * 2);
double.call(5);  // Emits { computed: 10 }

// Partial application (for combining multiple sources)
const sum = fn.partial(
  (args: {a: number, b: number}) => args.a + args.b,
  ['a', 'b']
);
sum.call({a: 5});      // Waits for 'b'
sum.call({b: 3});      // Now emits { computed: 8 }

// Fan out pattern
const source = fn.map((x: number) => x * 2);
const cleanup = source.fanOut()
  .to(targetGadget)
  .toWith(otherGadget, x => String(x))
  .build();

// All return: Implements<Transform<In, Out>> & SweetFunction<In, Out>
```

**Used by `flattenTable`** to combine cell values into row values!

---

## Table Flattening: The Meta-Circular Pattern

### The Problem It Solves

You have a table where each row contains **gadgets** (cells), and you need to render their **values** in React. But:
- Gadgets update independently
- React needs a single subscription point
- You want automatic cleanup

### The Solution

```typescript
// Step 1: Define row structure (gadgets)
type NodeRow = {
  position: SweetCell<Pos>,
  type: SweetCell<NodeType>,
  value: SweetCell<number>,
}

// Step 2: Create table of gadget rows
const nodes = table.first<NodeRow>({});

// Step 3: Add rows (each field is a gadget!)
nodes.set({
  'a': {
    position: cells.last({x: 100, y: 100}),
    type: cells.last('max'),
    value: cells.max(0),
  }
});

// Step 4: Flatten to value table
const [nodeValues] = table.flattenTable(nodes);

// Step 5: Subscribe in React
const [state] = useGadget(nodeValues, ['changed', 'added']);
// state = { a: { position: {x,y}, type: 'max', value: 0 } }

// Step 6: Render
{Object.entries(state).map(([id, node]) => (
  <Node position={node.position} type={node.type} value={node.value} />
))}

// THE MAGIC: Edit a cell → nodeValues emits → React re-renders
nodes.get('a').position.receive({x: 200, y: 100});
// React component updates immediately!
```

### How It Actually Works

From `/port-graphs/src/sugar/tables.ts:88-143`:

1. **Creates a derived function for each row**:
   ```typescript
   const [derived, cleanup] = deriveFrom(
     { position: row.position, type: row.type, value: row.value },
     (vals) => vals  // Identity function for flatten
   );
   ```

2. **Fans out to aggregated table**:
   ```typescript
   derived.fanOut()
     .toWith(aggregated, (result) => ({ [key]: result }))
     .build();
   ```

3. **Calls function with initial values**:
   ```typescript
   const initial = Object.fromEntries(
     Object.entries(gadgets).map(([k, g]) => [k, g.current()])
   );
   derived.call(initial);  // Populate immediately
   ```

4. **Returns aggregated table + cleanup**:
   ```typescript
   return [aggregated, () => { /* cleanup all taps */ }];
   ```

**Result**: A live table that updates whenever any gadget cell changes!

### Custom Derivations with `deriveRows`

You can transform values during flattening:

```typescript
const [computedValues] = table.deriveRows(
  nodes,
  (row) => ({ position: row.position, value: row.value }),  // Extract gadgets
  (vals) => ({                                              // Transform values
    x: vals.position.x,
    y: vals.position.y,
    doubled: vals.value * 2,
  })
);
```

---

## React Integration - Patterns & Pitfalls

### The `useGadget` Hook

Located in `/port-graphs-react/src/useGadget.ts`:

```typescript
const [state, gadget] = useGadget(myGadget, ['changed', 'added']);
```

**CRITICAL BUG FIX** (line 46):
```typescript
// ❌ WRONG - iterates array indices ("0", "1", "2")
for (const k in effects) {
  if (k in e && e[k] !== undefined) callback();
}

// ✅ CORRECT - iterates array values ("changed", "added")
for (const effect of effects) {
  if (effect in e && e[effect] !== undefined) callback();
}
```

**Usage**:
```typescript
// Subscribe to specific effects
const [nodeState] = useGadget(nodes, ['changed', 'added']);

// Subscribe to all effects (pass empty array)
const [state] = useGadget(gadget, []);
```

**How It Works**:
- Uses React's `useSyncExternalStore` for concurrent mode safety
- Taps the gadget on mount, cleans up on unmount
- Calls callback when specified effects are emitted
- Returns `[currentValue, gadget]` tuple

### React Flow Integration - State Preservation

**The Problem**: React Flow needs stable object references to track selection, drag state, etc. But our gadgets emit new data constantly.

**The Solution**: Spread existing node/edge state BEFORE overwriting with gadget data:

```typescript
useEffect(() => {
  setReactNodes(old =>
    Object.entries(nodeValues).map(([id, newData]) => {
      const existing = old.find(n => n.id === id);
      return {
        ...existing,        // ✅ Preserve React Flow internals
        id,
        position: newData.position,
        type: newData.type,
        data: newData,
      };
    })
  );
}, [nodeValues]);
```

**Why This Works**:
- `...existing` preserves properties like `selected`, `dragging`, internal IDs
- Overwriting specific fields updates only what changed
- React Flow's diffing algorithm sees same object shape
- No more jank during drag!

### Avoiding Infinite Loops

**DON'T DO THIS**:
```typescript
useEffect(() => {
  // Updates gadget
  gadget.receive(someValue);
}, [gadget.current()]);  // ← Infinite loop!
```

**Gadget changes → useEffect runs → updates gadget → repeat ∞**

**DO THIS INSTEAD**:
```typescript
// Only update gadgets on USER interaction
const onDragStop = (node) => {
  gadget.receive(node.position);  // User caused this
};

// Or use idempotent cells (no loop because same value = ignored)
const position = cells.last({x, y});
position.receive({x, y});  // No effect if same
position.receive({x, y});  // Still no effect
```

**The Rule**: Let user interactions update gadgets, let gadget changes update UI. Never close the loop in useEffect.

---

## Meta-Circular Visual Editor Architecture

### The Core Insight

**Everything that defines the editor is itself gadgets in tables**:
- Nodes → table of gadget rows ✅
- Edges → table of gadget rows ✅
- **Factories → table of gadget rows** ✅ ← THIS IS THE KEY!

When factories are a gadget table, the UI that creates nodes is **data-driven** and **modifiable at runtime** through the same mechanisms!

### Factory Table Pattern

Located in `/apps/web/app/routes/canvas-demo.tsx:222-259`:

```typescript
type FactoryRow = {
  name: SweetCell<string>,
  type: SweetCell<NodeType>,
  icon: SweetCell<string>,
  initialValue: SweetCell<any>,
  create: SweetCell<(pos: Pos) => NodeRow>,
}

const factories = table.first<FactoryRow>({
  max: {
    name: cells.last('Max Cell'),
    type: cells.last('max'),
    icon: cells.last('📈'),
    initialValue: cells.last(0),
    create: cells.last((pos) => ({
      position: cells.last(pos),
      type: cells.last('max'),
      dims: cells.last({width: 100, height: 100}),
      gadget: cells.max(0),
    })),
  },
  // min, union, etc...
});

const [factoryValues] = table.flattenTable(factories);
```

**In React**:
```typescript
const [factoryState] = useGadget(factoryValues, ['changed', 'added']);

// UI automatically updates from factory table!
{Object.entries(factoryState).map(([id, factory]) => (
  <button onClick={() => createNode(id, clickPos)}>
    {factory.icon} {factory.type}
  </button>
))}

// Create node using factory
function createNode(factoryId: string, pos: Pos) {
  const factory = factories.get(factoryId);
  const nodeRow = factory.create.current()(pos);
  nodes.set({ [generateId()]: nodeRow });
}
```

**The Meta-Circular Magic**:
1. Factory table defines what you can create
2. UI renders from factory table
3. Edit factory → `factories.get('max').name.receive('Super Max ⚡')`
4. UI picker updates immediately!
5. You can even add new factories at runtime!

### Recursive Inspector Pattern

**The Insight**: Gadgets are recursively inspectable - a `NodeRow` contains more gadgets!

```typescript
// A node row
{
  position: cells.last({x, y}),  // ← Gadget!
  type: cells.last('max'),        // ← Gadget!
  gadget: cells.max(5),           // ← Gadget!
}

// Inspector component (recursive)
function GadgetInspector({ gadget, label }) {
  const current = gadget.current?.() ?? gadget;
  const hasGadgetProps = Object.values(current)
    .some(v => v?.current);  // Detect sub-gadgets

  return (
    <div>
      <div>{label}: {JSON.stringify(current).slice(0, 50)}</div>
      {expanded && hasGadgetProps && (
        <div>
          {Object.entries(current).map(([key, val]) =>
            val?.current ? (
              <GadgetInspector gadget={val} label={key} />  // RECURSE!
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
```

**Usage**:
```typescript
// Click node → show inspector
const selectedNode = nodes.get(selectedNodeId);
<GadgetInspector gadget={selectedNode} label="NodeRow" />

// Expands to show:
// NodeRow
//   ├─ [+] position: {x: 100, y: 100}
//   ├─ [+] type: "max"
//   ├─ [+] dims: {width: 100, height: 100}
//   └─ [+] gadget: 5
```

**Next Step**: Add control widgets (sliders, inputs) that call `.receive()` on sub-gadgets!

### Complete Data Flow

```
User clicks factory button
  ↓
createNode(factoryId, pos)
  ↓
factory.create.current()(pos) → Creates NodeRow (gadget cells!)
  ↓
nodes.set({ [id]: nodeRow })
  ↓
nodeValues emits { added: {id: newNode} }
  ↓
useGadget triggers re-render
  ↓
Canvas shows new node
  ↓
User drags node
  ↓
onNodeDragStop → nodes.get(id).position.receive(newPos)
  ↓
Position cell emits { changed: newPos }
  ↓
nodeValues emits { changed: ... }
  ↓
React re-renders
  ↓
Node moves on canvas
```

**Perfect meta-circular loop** - UI controls gadgets, gadgets control UI!

### Key Learnings

1. **Tables of gadgets → Flattened values → React rendering**
   - This is THE pattern for data-driven UIs

2. **Everything as gadgets enables inspection**
   - Factories are inspectable
   - Nodes are inspectable
   - Even views could be inspectable gadgets!

3. **No bassline infrastructure needed**
   - Simple helper functions work fine
   - Just `createNode()`, `deleteNode()` manipulating tables
   - Bassline adds value for undo/redo, persistence, remote sync

4. **Recursive inspector reveals structure**
   - "Gadgets all the way down"
   - Each layer can have appropriate controls
   - Meta-circularity emerges from uniformity

5. **React Flow integration is straightforward**
   - Spread existing state to preserve internals
   - Don't close feedback loops in useEffect
   - Let user actions drive gadget updates

### Working Example

See `/apps/web/app/routes/canvas-demo.tsx` for complete implementation with:
- Factory table system
- Node creation via factories
- React Flow canvas integration
- Recursive gadget inspector
- Live updates throughout

**This is real, working meta-circularity!**

---

## Package Description Language - Full Meta-Circularity Achieved

### The Breakthrough

We now have a complete meta-circular system where compound gadgets can be:
1. **Created** as data (compound specs)
2. **Exported** as package definitions (JSON)
3. **Loaded** back into the system as reusable types
4. **Instantiated** via `fromSpec()` just like built-in gadgets

This closes the loop - the system can now describe and extend itself using its own primitives!

### Implementation Files

**Created**: 2025-10-08

#### Core Modules

1. **[compoundProto.js](../packages/core/src/compoundProto.js)** - Compound proto factory
   - `createCompoundProto(template, options)` - Creates reusable compound protos
   - Parameter resolution (`$parameters.name`)
   - Template + state merging
   - Extends base `compound` proto

2. **[packageLoader.js](../packages/core/src/packageLoader.js)** - Package loading system
   - `loadPackage(packageDef)` - Install packages from definitions
   - `loadPackageFromFile(path)` - Load from JSON files
   - Supports package-level imports
   - Creates compound protos for each gadget definition

3. **[packageExporter.js](../packages/core/src/packageExporter.js)** - Package export utilities
   - `exportAsPackage(spec, options)` - Convert specs to package definitions
   - `savePackage(packageDef, path)` - Save as JSON
   - `parameterizeSpec(spec, paramMap)` - Convert values to parameter references

4. **[packageResolver.js](../packages/core/src/packageResolver.js)** - Type resolution system (previously created)
   - Enables short-form specs: `{ type: "cells.max" }` instead of `{ pkg: "@bassline/cells/numeric", name: "max" }`
   - Import aliasing and parent chaining

### Package Definition Schema

```json
{
  "name": "@acme/filters",
  "version": "1.0.0",
  "description": "Custom filtering gadgets",
  "imports": {
    "cells": "@bassline/cells/numeric",
    "unsafe": "@bassline/cells/unsafe",
    "wire": "@bassline/relations"
  },
  "gadgets": {
    "valueFilter": {
      "description": "Filters values below a threshold",
      "parameters": {
        "threshold": 50
      },
      "template": {
        "gadgets": {
          "minValue": { "type": "cells.max", "state": "$parameters.threshold" },
          "input": { "type": "cells.max", "state": 0 },
          "filtered": { "type": "unsafe.last", "state": 0 },
          "wire1": {
            "type": "wire.wire",
            "state": {
              "source": { "ref": "input" },
              "target": { "ref": "filtered" }
            }
          }
        },
        "interface": {
          "inputs": { "value": "input", "threshold": "minValue" },
          "outputs": { "output": "filtered" }
        }
      }
    }
  }
}
```

### End-to-End Flow

```javascript
// 1. Create a compound gadget
const myCompound = bl().fromSpec({
  pkg: "@bassline/compound",
  name: "compound",
  state: {
    imports: { cells: "@bassline/cells/numeric" },
    gadgets: {
      threshold: { type: "cells.max", state: 50 },
      input: { type: "cells.max", state: 0 }
    }
  }
});

// 2. Parameterize and export
const parameterized = parameterizeSpec(myCompound.toSpec(), {
  "state.gadgets.threshold.state": "threshold"
});

const packageDef = exportAsPackage(parameterized, {
  name: "@acme/filters",
  gadgetName: "valueFilter",
  parameters: { threshold: 50 }
});

// 3. Save to file
await savePackage(packageDef, "/tmp/acme-filters.json");

// 4. Load from file
await loadPackageFromFile("/tmp/acme-filters.json");

// 5. Create instances with different parameters
const resolver = createPackageResolver();
resolver.import("acme", "@acme/filters");

const filter100 = bl().fromSpec(
  { type: "acme.valueFilter", state: { threshold: 100 } },
  resolver
);

const filter200 = bl().fromSpec(
  { type: "acme.valueFilter", state: { threshold: 200 } },
  resolver
);

// 6. Use them!
filter100.receive({ value: 150 });
filter200.receive({ value: 250 });
```

### Key Features

#### Parameter Resolution
Templates can reference parameters using `$parameters.name`:
```javascript
{
  gadgets: {
    threshold: { type: "cells.max", state: "$parameters.threshold" }
  }
}
```

At spawn time, `$parameters.threshold` resolves to:
1. Value from spawn state (`{ threshold: 100 }`)
2. Default from parameter definition (`parameters: { threshold: 50 }`)
3. Error if neither exists

#### Package-Level Imports
Imports defined at package level are merged with template imports:
```json
{
  "imports": { "cells": "@bassline/cells/numeric" },
  "gadgets": {
    "myGadget": {
      "template": {
        "imports": { "wire": "@bassline/relations" },
        // Has access to BOTH cells and wire
      }
    }
  }
}
```

#### Reusable Compound Protos
Once loaded, compound gadgets behave identically to built-in gadgets:
```javascript
// Built-in gadget
const max = bl().fromSpec({ type: "cells.max", state: 0 });

// Loaded compound gadget (identical API!)
const filter = bl().fromSpec({ type: "acme.valueFilter", state: { threshold: 50 } });
```

### Testing

Full end-to-end test in [test-package-system.js](../packages/core/src/test-package-system.js) demonstrates:
- Creating compound gadgets
- Parameterizing specs
- Exporting to package definitions
- Saving to JSON files
- Loading from files
- Creating instances via `fromSpec()`
- Using instances with different parameters

All tests pass ✅

### Meta-Circular Implications

This completes the fundamental loop:

1. **Gadgets define behavior** (via step/emit)
2. **Compounds compose gadgets** (via specs)
3. **Packages define reusable compounds** (via templates)
4. **The system loads packages** (via `loadPackage`)
5. **Loaded compounds are gadgets** (via `createCompoundProto`)
6. **Gadgets can create packages** (via `exportAsPackage`)

The system can now:
- Describe itself as data (package definitions)
- Load new capabilities from data (package files)
- Export runtime structures as reusable types (compound → package)
- Compose meta-gadgets that manipulate packages (package managers as gadgets!)

### Next Possibilities

With this foundation, we can now build:

1. **Visual package editor** - Edit compound structures, export as packages
2. **Package repositories** - Gadgets that manage collections of packages
3. **Runtime package loading** - Load packages from URLs/network
4. **Package composition** - Packages that combine other packages
5. **Live editing** - Modify running compounds, export as new types
6. **Meta-packages** - Packages that generate other packages

The uniformity is preserved - all of these are just gadgets operating on gadget data!