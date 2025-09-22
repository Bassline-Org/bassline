# Port-Graphs Typed Refactor - Complete Documentation

## Executive Summary

Port-graphs is a minimal propagation network system built on a single primitive: the **Gadget**. After a major refactoring, we now have a fully type-safe system that maintains simplicity while providing excellent developer experience through TypeScript's type inference.

## Core Architecture

### The Universal Gadget Protocol

Every gadget follows the same three-step protocol:

```typescript
interface Gadget<State, Incoming, Effect> {
  current: () => State;              // Get current state
  update: (state: State) => void;     // Update state
  receive: (data: Incoming) => void;  // Receive data and process
  emit: (effect: Effect) => void;     // Emit effects to the world
}
```

The flow is always: **Receive → Consider → Act → Emit**

### Type System Architecture

#### Core Types (port-graphs/src/core/types.ts)

```typescript
// Simplified spec with just the essentials
export type PartialSpec<State, Input, Effects> = {
  state: State;
  input: Input;
  effects: Effects;
};

// Full spec includes actions for multimethod dispatch
export type GadgetSpec<State, Input, Actions, Effects> =
  PartialSpec<State, Input, Effects> & {
    actions: Actions;
  };

// TypedGadget is now an INTERFACE (crucial for type compatibility!)
export interface TypedGadget<Spec extends PartialSpec>
  extends Gadget<Spec['state'], Spec['input'], Spec['effects']> { }

// Extract spec from any gadget-like type
export type ExtractSpec<G> = G extends Gadget<infer S, infer I, infer E>
  ? PartialSpec<S, I, E>
  : never;
```

**Key Insight**: Making `TypedGadget` an interface instead of a type alias allows intersection types like `TypedGadget & Tappable` to properly extend `TypedGadget`. This was a critical fix for type inference.

### Gadget Creation Pattern

#### defGadget Function (port-graphs/src/core/typed.ts)

```typescript
export function defGadget<Spec extends GadgetSpec>(
  consider: (state: Spec['state'], input: Spec['input']) => ActionResult,
  actions: ActionHandlers<Spec>
): (initial: Spec['state']) => TypedGadget<Spec>
```

The multimethod pattern:
1. `consider` function evaluates state + input → returns action to take
2. `actions` object maps action names → handlers that produce effects
3. Returns a factory function that creates gadgets with initial state

### Semantic Extensions

#### withTaps Extension (port-graphs/src/semantics/typed-extensions.ts)

```typescript
export interface Tappable<Effect> {
  tap: (fn: (effect: Effect) => void) => () => void;
}

export function withTaps<G extends TypedGadget<any>>(gadget: G) {
  // Preserves the original gadget type G
  // Adds tap method for subscribing to effects
  // Returns G & Tappable<Effects>
}
```

**Critical**: `withTaps` preserves the original gadget type. This allows the result to still extend `TypedGadget`.

## Pattern Implementations

### Cell Pattern
Gadgets that accumulate state monotonically using ACI operations:

```typescript
// Example: Max cell
export const maxCell = (initial: number) =>
  defGadget<CellSpec<number>>(
    (state, input) => input > state ? { update: input } : { ignore: {} },
    {
      update: (gadget, value) => {
        gadget.update(value);
        return { changed: value };
      },
      ignore: () => ({ noop: {} })
    }
  )(initial);
```

### Function Pattern
Gadgets that compute outputs from inputs:

```typescript
export function typedFn<Args, Result>(
  compute: (args: Args) => Result,
  requiredKeys: (keyof Args)[]
) {
  // Returns a gadget that:
  // 1. Accumulates arguments until all required keys present
  // 2. Computes result when ready
  // 3. Emits { changed: { result, args } }
}

// Helper for binary functions
export const adder = binary<number, number, number>((a, b) => a + b);
```

### UI Pattern
Typed UI gadgets with specific commands and state:

```typescript
export type SliderSpec = CommandSpec<
  { value: number; min: number; max: number; step: number },  // State
  { set: number } | { increment: {} } | { decrement: {} },    // Commands
  { /* actions */ },
  { changed: number; configured: SliderState; noop: {} }       // Effects
>;

export const sliderGadget = (initial = 50, min = 0, max = 100, step = 1) => {
  const baseGadget = defGadget<SliderSpec>(/* ... */);
  return withTaps(baseGadget);  // Factory returns gadget with tap
};
```

## React Integration

### Core Hook Pattern

```typescript
export function useGadget<G extends TypedGadget<any>>(gadget: G) {
  // Returns [state, send, gadgetWithTap]
  // Automatically wraps with tap if needed
  // Uses GadgetProvider for global state management
}
```

### Effect Hook Pattern

```typescript
export function useGadgetEffect<G extends TypedGadget<any>>(
  gadget: G,
  callback: (effect: ExtractSpec<typeof gadget>['effects']) => void,
  deps?: React.DependencyList
) {
  // Subscribes to gadget effects with automatic cleanup
  // Fully typed based on the gadget's spec
  // Handles React lifecycle properly
}
```

### Component Pattern

```typescript
export interface SliderProps<G extends TypedGadget<SliderSpec>> {
  gadget: G & Tappable<SliderSpec['effects']>;
  // ... other props
}

export function Slider<G extends TypedGadget<SliderSpec>>({
  gadget,
  ...props
}: SliderProps<G>) {
  const [state, send] = useGadget(gadget);
  // Component uses typed state and send
}
```

**Key Pattern**: Components accept `G extends TypedGadget<SpecificSpec>` to maintain type flexibility while ensuring type safety.

### GadgetProvider Architecture

- Uses `WeakMap` for memory-efficient gadget registry
- Wraps gadgets with tap functionality on first use
- Tracks state changes and notifies React components
- Uses `useSyncExternalStore` for React 18+ concurrent features

## File Organization

```
port-graphs/
├── src/
│   ├── core/
│   │   ├── typed.ts         # defGadget multimethod creator
│   │   └── types.ts         # Core types (Gadget, TypedGadget, etc.)
│   ├── patterns/
│   │   ├── specs.ts         # Pattern specifications
│   │   ├── cells/           # Cell pattern implementations
│   │   ├── functions/       # Function pattern implementations
│   │   └── ui/             # UI gadget implementations
│   ├── effects/            # Effect constructors
│   ├── semantics/
│   │   └── typed-extensions.ts  # withTaps extension
│   └── old/                # Legacy code (excluded from build)

port-graphs-react/
├── src/
│   ├── components/         # Typed React components
│   │   ├── Slider.tsx
│   │   ├── Meter.tsx
│   │   └── Toggle.tsx
│   ├── GadgetProvider.tsx  # Global state management
│   ├── useGadget.ts        # Core React hook
│   └── index.ts            # Public exports
```

## Critical Implementation Details

### 1. TypedGadget Must Be an Interface
```typescript
// ❌ WRONG - Type alias doesn't allow proper extension
export type TypedGadget<Spec> = Gadget<...>;

// ✅ CORRECT - Interface allows intersection types to extend it
export interface TypedGadget<Spec> extends Gadget<...> { }
```

### 2. withTaps Must Preserve Original Type
```typescript
// ❌ WRONG - Loses original gadget type
function withTaps(gadget): Gadget & Tappable

// ✅ CORRECT - Preserves generic type G
function withTaps<G extends TypedGadget>(gadget: G): G & Tappable
```

### 3. Components Should Use Generic Constraints
```typescript
// ❌ WRONG - Too rigid, doesn't allow extended types
interface Props {
  gadget: TypedGadget<SliderSpec>;
}

// ✅ CORRECT - Flexible while maintaining type safety
interface Props<G extends TypedGadget<SliderSpec>> {
  gadget: G & Tappable<...>;
}
```

### 4. Factory Functions Should Return Tappable Gadgets
```typescript
export const sliderGadget = (...args) => {
  const base = defGadget<SliderSpec>(...);
  return withTaps(base);  // Return ready-to-use gadget
};
```

## Known Issues and Solutions

### Function Gadget Type Inference
Function gadgets (like `adder`) have complex type structures that may require explicit typing:

```typescript
// The state includes both arguments and result
const calc = withTaps(adder({ a: 0, b: 0 }));
const [calcState] = useGadget(calc);
// calcState is { a: number; b: number; result?: number }
```

This works correctly now with the improved type system.

### Component Prop Types
All components expect gadgets with tap functionality:
```typescript
// Gadgets from factories already have tap
<Slider gadget={sliderGadget(50)} />

// Manual gadgets need withTaps
const custom = defGadget<SliderSpec>(...);
<Slider gadget={withTaps(custom)} />
```

## Best Practices

### 1. Always Use Factory Functions
Factory functions ensure gadgets are properly initialized with tap functionality:
```typescript
const slider = sliderGadget(50, 0, 100, 1);  // Ready to use
```

### 2. Create Gadgets Outside Components
```typescript
// ❌ WRONG - Recreates every render
function Component() {
  const slider = sliderGadget(50);
}

// ✅ CORRECT - Created once
const slider = sliderGadget(50);
function Component() {
  const [state] = useGadget(slider);
}
```

### 3. Use Type Inference Where Possible
```typescript
// Let TypeScript infer types from gadgets
const [state, send] = useGadget(slider);
// state is SliderState, send accepts SliderCommands
```

### 4. Keep Specs Simple
Use `PartialSpec` when you don't need actions:
```typescript
type MySpec = PartialSpec<State, Input, Effects>;
```

## Testing Strategy

### Type Testing
Use TypeScript's type system to verify type safety:
```typescript
// Test that gadget extends TypedGadget
type Test = typeof myGadget extends TypedGadget ? true : false;
```

### Unit Testing
- Test gadget state transitions
- Test effect emissions
- Test tap subscriptions

### Integration Testing
- Test gadget networks
- Test React component integration
- Test state synchronization

## Future Considerations

### Potential Improvements
1. **Better Function Gadget Types**: Improve type inference for complex function compositions
2. **Performance Optimizations**: Consider memoization for large gadget networks
3. **Developer Tools**: Create debugging tools for gadget networks
4. **More UI Components**: Expand the typed UI component library

### Things to Preserve
1. **Simplicity**: The single gadget primitive is powerful
2. **Type Safety**: Never compromise on type safety for convenience
3. **Flexibility**: Maintain structural typing over nominal typing
4. **Clean API**: Keep the public API surface minimal

## Migration Guide (From Old to Typed)

### Old Pattern
```typescript
const gadget = createGadget((state, input) => {
  // Direct mutation and effect emission
});
```

### New Pattern
```typescript
const gadget = defGadget<MySpec>(
  (state, input) => ({ actionName: context }),
  {
    actionName: (gadget, context) => ({ effectName: data })
  }
)(initialState);
```

## Common Patterns

### Wiring Gadgets Together

#### Using useGadgetEffect (Preferred in React)
```typescript
// Clean and declarative with automatic cleanup
useGadgetEffect(slider, ({ changed }) => {
  if (changed) {
    meter.receive({ display: changed });
  }
}, [meter]);
```

#### Using tap directly
```typescript
// Manual tap for non-React contexts
const cleanup = slider.tap((effect) => {
  if ('changed' in effect) {
    meter.receive({ display: effect.changed });
  }
});
// Remember to call cleanup() when done
```

### Partial Application
```typescript
// Functions accumulate arguments
const add = adder({});
add.receive({ a: 5 });  // Waits for b
add.receive({ b: 3 });  // Computes: 8
```

### State Synchronization
```typescript
// React components auto-sync through GadgetProvider
function Component() {
  const [state] = useGadget(sharedGadget);
  // Always shows current state
}
```

## Debugging Tips

### Type Errors
1. Check that gadget extends `TypedGadget`
2. Verify specs match expected patterns
3. Ensure withTaps is applied where needed
4. Use explicit type parameters if inference fails

### Runtime Issues
1. Verify gadgets are created outside render functions
2. Check that GadgetProvider wraps the component tree
3. Ensure tap cleanup functions are called
4. Verify effect handlers match expected structure

## Summary

The typed refactor achieves:
- ✅ **Full type safety** without runtime overhead
- ✅ **Clean separation** of old and new code
- ✅ **Flexible typing** with structural compatibility
- ✅ **Simple API** that's easy to use correctly
- ✅ **Excellent DX** with TypeScript inference
- ✅ **React integration** that feels natural

The key insight: Using interfaces for `TypedGadget`, preserving types through `withTaps`, and leveraging structural typing creates a system that's both type-safe and flexible. The single gadget primitive remains simple while the type system ensures correctness at compile time.