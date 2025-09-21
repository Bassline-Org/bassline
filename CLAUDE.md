# CLAUDE.md

This file provides guidance to Claude Code when working with the Bassline codebase.

## Project Overview

Bassline is a minimal propagation network system built around **gadgets** - simple units that follow a universal protocol. The entire system emerges from this single primitive.

## Core Concept: The Universal Gadget Protocol

There is **ONE** fundamental concept: the **Gadget**

Every gadget follows the same protocol:
1. **Receive** - Accept incoming data
2. **Consider** - Evaluate what to do based on current state and incoming data
3. **Act** - Do something (update state, emit effects, or nothing)

That's it. Everything else is just patterns built on this protocol.

## The Consider → Act Protocol

```typescript
// The shape of every gadget
gadget = (incoming_data) => {
  const action = consider(current_state, incoming_data);  // CONSIDER
  const result = act_on(action);                         // ACT
  if (result) emit(result);                              // (effects go into the void)
}
```

## Type-Safe Gadget Creation

We use a **spec-driven approach** for type-safe gadgets:

```typescript
// Define a spec as a plain type literal
type CounterSpec = {
  state: number;
  input: 'inc' | 'dec' | 'reset';
  actions: {
    update: number;   // Actions are objects, not discriminated unions
    skip: {};
  };
  effects: {
    changed: number;  // Effects are objects too
    noop: {};
  };
};

// Create gadget using defGadget
const counter = defGadget<CounterSpec>(
  (state, input) => {
    // Consider returns single-key object
    if (input === 'inc') return { update: state + 1 };
    if (input === 'dec') return { update: state - 1 };
    if (input === 'reset') return { update: 0 };
    return { skip: {} };
  },
  {
    // Action handlers get exact typed context
    update: (gadget, value) => {
      gadget.update(value);
      return { changed: value };
    },
    skip: () => ({ noop: {} })
  }
)(0);
```

Key insights:
- **Specs are just type literals** - no generic ceremony
- **Actions/effects are objects** - `{ update: value }` not `{ action: 'update', context: value }`
- **Full type inference** - TypeScript knows all the types
- **Compile-time safety** - can't return wrong actions or emit wrong effects

## Pattern Recognition and Discipline

### Cell Pattern - ACI Merge Operations
Cells MUST have **Associative, Commutative, and Idempotent** merge operations:

```typescript
type CellSpec<State, Input> = {
  state: State;
  input: Input;
  actions: {
    merge: Input;
    ignore: {}
  };
  effects: {
    changed: State;
    noop: {}
  };
};
```

**Valid Cells** (all are ACI):
- `maxCell` - max(x,x) = x ✓
- `minCell` - min(x,x) = x ✓
- `unionCell` - union(S,S) = S ✓
- `lastCell` - last(x,x) = x ✓
- `predicateCell` - first valid value wins (monotonic) ✓
- `firstMap` - first value per key wins ✓

**NOT Cells** (not ACI):
- `sumCell` - sum(x,x) ≠ x ✗ (not idempotent)
- `counterCell` - count++ ✗ (not idempotent)
- `listCell` - append operations ✗ (not idempotent)
- Collections with add/remove ✗ (command-driven)

### Function Pattern - Map-Based Computation
Functions compute results from map-based arguments:

```typescript
type FunctionSpec<Args, Result> = {
  state: Args & { result?: Result };
  input: Partial<Args>;  // Partial maps for natural binding
  actions: {
    compute: Args;
    accumulate: Partial<Args>;
    ignore: {};
  };
  effects: {
    changed: { result: Result; args: Args };
    noop: {};
  };
};
```

Map-based arguments enable:
- **Partial binding**: `{a: 5}` waiting for `{b: 3}`
- **Named arguments**: No positional coupling
- **Natural merging**: Maps compose cleanly

### Command Pattern - Instruction Interpretation
Commands interpret explicit instructions rather than merge data:

```typescript
type CommandSpec<State, Commands> = {
  state: State;
  input: Commands;  // Explicit commands/instructions
  actions: /* derived from commands */;
  effects: /* domain specific */;
};
```

**Examples of Command Gadgets**:
- **UI Controls**: slider, meter, toggle (respond to user commands)
- **Collections**: list, index (respond to add/remove/clear)
- **Position transformers**: anchoredPosition, boundedPosition (transform input)
- **State machines**: explicit state transitions
- **Protocol handlers**: interpret protocol messages

Commands are NOT cells because they:
- Don't have ACI merge semantics
- Interpret instructions rather than accumulate data
- Often have order-dependent operations

## Key Implementation Insights

### Composition Over Specialization
Don't create specialized gadgets when composition works:
- `positionCell` → just use `lastMap<number>()` with keys 'x' and 'y'
- Array operations → Set cells already accept arrays
- Specialized types → compose from primitives

### Pattern Selection Guide
1. **Is the merge operation ACI?** → Cell pattern
2. **Computing from arguments?** → Function pattern
3. **Interpreting instructions?** → Command pattern
4. **Managing connections?** → Meta-gadget (still follows protocol)

### Effects Are Just Data
- Gadgets emit effects into "the void"
- They don't know or care who handles them
- Effects are partial objects: `{ changed: value }`, `{ noop: {} }`
- Can emit multiple effects at once

### Semantic Openness
- No prescribed communication patterns
- Mechanical wiring (intercepting emit/receive) is one option
- Semantic routing (meta-gadgets) is another
- You can build any communication pattern as a gadget

## Implementation Architecture

### Core (`port-graphs/src/`)

- **core/typed.ts**: Type-safe gadget creation with `defGadget`
- **patterns/specs.ts**: Core pattern specifications (CellSpec, FunctionSpec, CommandSpec)
- **patterns/cells/typed-*.ts**: Typed cell implementations (all ACI)
- **patterns/functions/typed-*.ts**: Typed function implementations
- **patterns/commands/**: Command pattern implementations (coming soon)
- **effects/**: Effect constructors and types
- **semantics/**: Wiring and extension mechanisms

### Design Principles

1. **Extreme minimalism** - One protocol, infinite patterns
2. **Pattern discipline** - Use the right pattern for the semantics
3. **Type safety** - Full compile-time verification with specs
4. **Composability** - Complex behavior from simple gadgets
5. **Semantic openness** - Don't prescribe communication

## TypeScript Configuration

Uses strict mode with additional safety checks:
- `strict`: All strict type-checking
- `noUncheckedIndexedAccess`: Safe array access
- `exactOptionalPropertyTypes`: Distinguish undefined vs missing

## Summary

The entire system is:
```
data → consider → act → effects → (someone else's data)
```

Everything else - cells, functions, commands, routers - are just gadgets with different consider/act implementations. The network builds itself using the same mechanism it uses to process data.

The key is recognizing which pattern fits your semantics:
- **Cells** for ACI merge operations
- **Functions** for computation with partial binding
- **Commands** for instruction interpretation
- **Meta-gadgets** for managing other gadgets