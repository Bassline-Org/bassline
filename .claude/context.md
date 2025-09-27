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
- `/port-graphs/src/meta/bassline.ts` - The bassline implementation
- `/port-graphs/src/meta/bassline.test.ts` - Test suite
- `/port-graphs-react/src/useRelations.ts` - React hook for relations
- `/port-graphs-react/src/Wire.tsx` - Declarative wiring component

### Open Questions/Next Steps
Based on the conversation, it seems like:
- React integration for basslines hasn't been built yet (deliberately postponed)
- The verbosity issues in the notebook demo could potentially be addressed using basslines
- There might be opportunities to use basslines as a standard way to set up gadget contexts