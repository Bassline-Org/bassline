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