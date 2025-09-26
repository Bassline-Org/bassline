# CLAUDE.md - Port-Graphs/Gadgets System Guide

## Project Overview

This is **Bassline** - a hyper-minimal propagation network model built around **gadgets**. Despite the repo name "port-graphs", this is actually an implementation of a more general and powerful model inspired by propagation networks (Sussman/Radul) but evolved into something more fundamental.

**Core Philosophy**: We don't define how gadgets communicate - we provide a minimal protocol for doing useful work and leave communication semantically open. This is intentional and critical to the design.

## Critical Design Principles

1. **Semantic Openness**: `emit()` goes nowhere by default. Communication is NOT baked into the model.
2. **Partial Information**: Everything is partial information moving up a lattice via ACI (Associative, Commutative, Idempotent) operations.
3. **Mechanical Simplicity**: Core is ~50 lines. Complexity emerges from composition, not the primitive.
4. **Fire-and-Forget Everything**: Both effects AND taps are fire-and-forget - no delivery or timing guarantees.
5. **Effects as Data**: Effects are just data about what happened internally - no prescribed handlers.
6. **Meta-Gadgets**: Routing/communication patterns are themselves gadgets operating on effects.

## Architecture

```
port-graphs/                 # Core library
├── src/
│   ├── core/
│   │   └── typed.ts        # THE CORE - defGadget, Gadget interface, type machinery
│   ├── patterns/
│   │   ├── cells/          # ACI merge strategies (max, min, union, intersection, tables)
│   │   ├── functions/      # Function gadgets with partial application
│   │   └── ui/            # UI gadgets (slider, button, checkbox, etc.)
│   ├── effects/           # Standard effect constructors
│   └── multi.ts           # Multimethod dispatch utility

port-graphs-react/          # React integration
├── src/
│   ├── GadgetProvider.tsx # Global gadget state registry
│   ├── useGadget.ts      # Core hook - hijacks update/current for React
│   ├── useGadgetEffect.ts # Tap into gadget effects
│   └── components/        # React components for UI gadgets
```

## Core Concepts

### 1. Gadget Anatomy

```typescript
type Gadget<Spec> = {
  current: () => StateOf<Spec>;      // Get current state
  update: (state: StateOf<Spec>) => void;  // Update state
  receive: (data: InputOf<Spec>) => void;  // Accept input
  emit: (effect: Partial<EffectsOf<Spec>>) => void;  // Emit effects (goes nowhere by default!)
}
```

**Critical**: Both `emit()` and `tap()` are fire-and-forget. No delivery guarantees, no timing guarantees. This is intentional.

### 2. Spec Composition

Specs are built by composing type-level pieces:

```typescript
type MySpec = 
  & State<T>        // What state it holds
  & Input<I>        // What input it accepts
  & Actions<A>      // What internal actions can occur
  & Effects<E>      // What effects it can emit
```

### 3. The defGadget Pattern

```typescript
defGadget<Spec>({
  dispatch: (state, input) => /* return action or null */,
  methods: {
    actionName: (gadget, context) => /* return effects */
  }
})
```

**Key Insight**: dispatch decides WHAT to do, methods define HOW to do it.

### 4. Lattice Operations (Cells)

Cells implement different merge strategies for moving up a lattice:
- `maxCell`: Monotonically increasing numbers
- `minCell`: Monotonically decreasing numbers
- `unionCell`: Set union (always growing)
- `intersectionCell`: Set intersection (always shrinking)
- `lastCell`: Always take newest value
- `firstCell`: Keep first value, ignore rest

### 5. Tapping (Mechanical Wiring)

```typescript
withTaps(gadget) // Makes a gadget tappable
gadget.tap(effect => /* do something */) // Returns cleanup function
```

This is how we do mechanical wiring without baking communication into the model. Taps are **fire-and-forget** just like effects - they can be synchronous or asynchronous, and the emitting gadget doesn't care about timing or delivery guarantees. This uniformity means the same gadget works in-memory, over network, or across processes without modification.

## TypeScript Type Safety Standards

### ABSOLUTE RULES - NO EXCEPTIONS

**NEVER USE `any`** - If you're reaching for `any`, you're doing it wrong. Period.

**NO LAZY TYPE ASSERTIONS** - Absolutely forbidden:
- ❌ `as any`
- ❌ `as unknown as SomeType`  
- ❌ `// @ts-ignore`
- ❌ `// @ts-expect-error` (unless in test files specifically testing type errors)
- ❌ Non-null assertions (`!`) without explicit guards

### Type Safety Requirements

1. **Let TypeScript Infer** - The gadget system is designed for maximum inference:
   ```typescript
   // ✅ GOOD - TypeScript infers everything
   const gadget = sliderGadget(50, 0, 100);
   
   // ❌ BAD - Unnecessary annotations
   const gadget: Gadget<SliderSpec> = sliderGadget(50, 0, 100);
   ```

3. **Leverage the Type System**:
   ```typescript
   // ✅ Use conditional types and mapped types
   // THIS ALREADY EXISTS!
   type StateOf<S> = S extends State<infer St> ? St : never;
   
   // ✅ Use discriminated unions for commands
   type Commands = 
     | { type: 'set'; value: number }
     | { type: 'increment' }
   ```

4. **Generic Constraints Are Your Friend**:
  ALMOST ALL CODE SHOULD BE GENERIC OVER A SPEC FOR GADGETS!
   ```typescript
   // ✅ Proper constraints
   function connect<S, G extends Gadget<S> & Tappable<S>>(gadget: G) {
     // Full type safety maintained
   }
   ```

### Why This Matters

The entire gadget system is built on **compile-time guarantees**. When you use `any` or lazy assertions:
- You break the inference chain
- You lose the benefits of the typed dispatch system
- You make refactoring dangerous
- You defeat the entire purpose of the typed architecture

### If You're Stuck

If you find yourself wanting to use `any`:
1. **Stop and reconsider the design** - The need for `any` usually indicates a design problem
2. **Use proper generics** - Our system supports complex generic constraints
3. **Use discriminated unions** - For variant types
4. **Ask for help** - Better to spend time getting types right than shipping unsafe code

### Common Patterns That Maintain Safety

```typescript
// Function that works with any gadget spec
function processGadget<S>(gadget: Gadget<S>) {
  // TypeScript knows the relationships
  const state = gadget.current();  // StateOf<S>
}

// Extracting types from existing gadgets
type MyGadgetSpec = SpecOf<typeof myGadget>;

// Building complex specs via composition
type ComplexSpec = 
  & State<MyState>
  & Input<MyInput>
  & Actions<MyActions>
  & Effects<MyEffects>;
```

**Remember**: The ~50 line core gives us incredible type safety through inference. Don't throw that away with lazy typing. The types ARE the documentation, they ARE the guardrails, and they ARE what makes this system powerful.

## Working with the Codebase

### Creating New Gadgets

**ALWAYS** follow this pattern for new gadgets:

```typescript
// 1. Define the spec with all four components
export type MyGadgetSpec = 
  & State<{/* state shape */}>
  & Input</* union of command types */>
  & Actions<{/* internal actions */}>
  & Effects<{/* possible effects */}>

// 2. Create the gadget factory
export function myGadget(/* params */) {
  const baseGadget = defGadget<MyGadgetSpec>({
    dispatch: (state, input) => {
      // Examine input and state, return action name or null
      // This should be PURE - no side effects!
    },
    methods: {
      // One method per action
      actionName: (gadget, context) => {
        // Can call gadget.update() here
        // Return effects (or undefined)
      }
    }
  })(/* initial state */);
  
  // ALWAYS wrap with taps for composability
  // Note: taps are also fire-and-forget, can be sync or async
  return withTaps(baseGadget);
}
```

### Adding React Components

For new UI gadget components:

```typescript
// 1. Props interface with gadget and callbacks
export interface MyComponentProps<S extends MySpec, G extends Gadget<S> & Tappable<S>> {
  gadget: G;
  className?: string;
  onChange?: (value: EffectsOf<S>['changed']) => void;
}

// 2. Component using useGadget hook
export function MyComponent<S extends MySpec, G extends Gadget<S> & Tappable<S>>({
  gadget,
  onChange
}: MyComponentProps<S, G>) {
  const [state, send] = useGadget<S, G>(gadget);
  
  useGadgetEffect(gadget, ({ changed }) => {
    if (changed !== undefined) {
      onChange?.(changed);
    }
  }, [onChange]);
  
  // Render based on state, send commands on interaction
}
```

### Type Inference Rules

1. **Let TypeScript infer whenever possible** - avoid explicit type annotations
2. **Use `SpecOf<T>` to extract specs** from gadget instances
3. **Use `StateOf`, `InputOf`, `EffectsOf`** to extract parts of specs
4. **Generic constraints should be minimal** - usually just `Gadget<S>`

### Command Patterns for UI

UI gadgets should use tagged unions for commands:

```typescript
type Commands = 
  | { set: T }           // Set to specific value
  | { increment: {} }    // Increment by step
  | { toggle: {} }       // Toggle boolean
  | { configure: {...} } // Update configuration
  | { enable: {} }       // Enable interaction
  | { disable: {} }      // Disable interaction
```

### Effect Naming Conventions

- `changed`: State was updated with new value
- `validated`: Input was modified to meet constraints  
- `configured`: Configuration was updated
- `cleared`: State was reset/cleared
- `noop`: Nothing happened (input ignored)
- `contradiction`: Conflicting data received

## Extension Patterns

### 1. Meta-Gadgets (Semantic Routing)

```typescript
// Meta-gadgets consume effects as data
const router = defGadget<RouterSpec>({
  dispatch: (state, effect) => {
    // Route based on effect type
    if ('changed' in effect) return { route: effect.changed };
    return { ignore: {} };
  },
  methods: {
    route: (gadget, value) => {
      // Semantic routing logic
    }
  }
});
```

### 2. Family Tables (Dynamic Collections)

Use `defFamilyTable` for managing collections of gadgets:

```typescript
const family = defFamilyTable(() => createGadget());
family.receive({ create: ['key1', 'key2'] });
family.receive({ send: { key1: someInput } });
```

### 3. Derived Gadgets

```typescript
const derived = derive(source, state => transform(state));
// Automatically connected via taps
```

## Testing Guidelines

1. **Test dispatch logic separately** from methods
2. **Test effects emission** not internal state changes
3. **Test composition** by wiring gadgets and checking propagation
4. **Use withTaps in tests** to observe effects
5. **Handle async taps in tests** with proper awaits

```typescript
// Sync testing
const gadget = withTaps(myGadget());
let emitted: any;
gadget.tap(e => emitted = e);
gadget.receive(input);
expect(emitted).toEqual({ changed: expected });

// Async testing
const gadget = withTaps(myGadget());
const emissions: any[] = [];
gadget.tap(async e => {
  await someAsyncOp();
  emissions.push(e);
});
gadget.receive(input);
await new Promise(r => setTimeout(r, 100));
expect(emissions).toContain({ changed: expected });
```

## Performance Considerations

1. **Gadgets are lightweight** - create many without concern
2. **Taps are fire-and-forget** - can be sync or async, no guarantees about timing
3. **React integration uses useSyncExternalStore** for concurrent mode
4. **WeakMap for registry** prevents memory leaks

## Common Patterns

### Bidirectional Sync

```typescript
const a = withTaps(maxCell(0));
const b = withTaps(maxCell(0));

a.tap(({ changed }) => changed && b.receive(changed));
b.tap(({ changed }) => changed && a.receive(changed));
```

### Async Propagation

```typescript
const source = withTaps(maxCell(0));
const delayed = withTaps(lastCell(0));

// Async tap for delayed propagation
source.tap(async ({ changed }) => {
  if (changed !== undefined) {
    await new Promise(r => setTimeout(r, 100));
    delayed.receive(changed);
  }
});
```

### Validation Chain

```typescript
const input = withTaps(textInputGadget());
const valid = withTaps(predicateCell(isEmail));

input.tap(({ changed }) => valid.receive(changed));
valid.tap(({ changed }) => {
  if (changed) console.log('Valid email!');
});
```

### Aggregation

```typescript
const nums = [1, 2, 3].map(n => withTaps(maxCell(n)));
const sum = withTaps(lastCell(0));

nums.forEach(n => {
  n.tap(() => {
    const total = nums.reduce((a, g) => a + g.current(), 0);
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

## Debugging Tips

1. **Tap everything during development**:
```typescript
gadget.tap(e => console.log('Effect:', e));
```

2. **Check dispatch logic first** - most bugs are in deciding what action to take

3. **Verify state updates** in methods before emitting effects

4. **Build trace gadgets for time-travel debugging**:
```typescript
const tracer = withTaps(lastTable({}));
gadget.tap(effect => {
  const timestamp = Date.now();
  tracer.receive({ [timestamp]: { state: gadget.current(), effect } });
});
// Now tracer.current() has full history for replay
```

## Anti-Patterns to Avoid

❌ **Don't** put communication logic in gadget methods
❌ **Don't** make effects dependent on external state  
❌ **Don't** use async operations inside dispatch/methods (async taps are fine)
❌ **Don't** mutate state directly - always use gadget.update()
❌ **Don't** forget to wrap with withTaps()
❌ **Don't** create circular dependencies without careful thought about termination
❌ **Don't** assume taps execute synchronously or in order

## Advanced Patterns

### Async Taps
```typescript
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
  setTimeout(() => otherGadget.receive(effect.changed), 1000);
});
```

### Temporal Gadgets
```typescript
// Gadgets that track time-based state
const temporal = defGadget<TemporalSpec>({
  dispatch: (state, input) => {
    const now = Date.now();
    if (now - state.lastUpdate > 1000) {
      return { update: { ...input, timestamp: now } };
    }
    return { throttle: {} };
  }
});
```

### Cryptographic Gadgets
```typescript
// Gadgets operating on encrypted partial information
const encrypted = defGadget<EncryptedSpec>({
  dispatch: (state, input) => {
    // Operate on encrypted values without decrypting
    return { merge: homomorphicAdd(state, input) };
  }
});
```

### Constraint Propagation
```typescript
// Gadgets that emit constraints, not values
const constraint = defGadget<ConstraintSpec>({
  dispatch: (state, input) => {
    if (satisfies(input, state.constraints)) {
      return { propagate: deriveNewConstraints(input) };
    }
    return { contradiction: {} };
  }
});
```

### Distributed Gadgets
```typescript
// Fire-and-forget taps naturally support distributed systems
const local = withTaps(maxCell(0));

// Could be across network, IPC, WebSocket, etc.
local.tap(({ changed }) => {
  if (changed !== undefined) {
    websocket.send(JSON.stringify({ type: 'sync', value: changed }));
  }
});

// No changes needed to the gadget model - distribution is just async taps
```

## Remember

This system's power comes from its **minimalism** and **semantic openness**. The core is intentionally simple - complexity emerges from composition. When in doubt, make another gadget rather than making existing gadgets more complex.

Both effects and taps are **fire-and-forget** - this isn't a limitation, it's what enables the model to work across any transport (memory, network, IPC) without changes. Timing and delivery are concerns for meta-gadgets if needed, not the core model.

The goal is to do more than anyone else in the world not by having more features, but by having the right primitive that composes infinitely.