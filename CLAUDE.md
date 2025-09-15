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

## Common Patterns (Not Fundamental Types!)

### Cell Pattern
Gadgets that accumulate state monotonically:
- Use ACI (Associative, Commutative, Idempotent) merge functions
- Naturally support multiple writers (order doesn't matter)
- Examples: `maxCell`, `unionCell`, `intersectionCell`

```typescript
const max = maxCell(10);      // Keeps maximum value seen
max.receive(20);               // Updates to 20
max.receive(15);               // Stays at 20
```

### Function Pattern
Gadgets that transform inputs to outputs:
- Use maps for multiple arguments: `{a: 5, b: 3}`
- Semantically expect single writer per argument
- Compute when all required arguments present
- Natural partial binding through partial maps

```typescript
const adder = binary((a, b) => a + b);
const add = adder({a: undefined, b: undefined});
add.receive({a: 5});           // Waits for b
add.receive({b: 3});           // Computes: 8
```

### Meta-gadget Pattern
Gadgets that manage connections/routing:
- Receive routing information as their data
- Internally create/manage connections
- **Still just regular gadgets** following the same protocol

```typescript
// A routing gadget - same shape as any other gadget!
const router = createGadget((routes, newRoute) => {
  if (shouldConnect(newRoute)) return 'connect';
  return 'ignore';
})({
  'connect': (gadget, routes, newRoute) => {
    // Internally wire gadgets together
    createConnection(newRoute.from, newRoute.to);
    return changed({connected: newRoute});
  },
  'ignore': () => noop()
});
```

## Key Insights

### Everything Has the Same Shape
A router managing connections is the **exact same shape** as a cell tracking a maximum:
- Both receive data
- Both consider what to do
- Both act (and maybe emit effects)

The router just happens to interpret its data as routing instructions, while the max cell interprets its data as numbers to compare.

### Effects Are Just Data
- Gadgets emit effects into "the void"
- They don't know or care who handles them
- Effects are partial data: `changed(value)`, `noop()`, `contradiction()`
- Meta-gadgets can consume effects as their input

### Semantic Openness
- No prescribed communication patterns
- Mechanical wiring (intercepting emit/receive) is one option
- Semantic routing (meta-gadgets) is another
- You can build any communication pattern as a gadget

## Implementation Architecture

### Core (`port-graphs/src/`)

- **core.ts**: The gadget creation function with multimethod dispatch
- **patterns/cells/**: Cell pattern implementations (max, min, union, etc.)
- **patterns/functions/**: Function pattern implementations
- **effects/**: Effect constructors and types
- **semantics/**: Wiring and extension mechanisms

### Design Principles

1. **Extreme minimalism** - One protocol, infinite patterns
2. **Semantic openness** - Don't prescribe communication
3. **Mechanical simplicity** - Direct wiring without magic
4. **Composability** - Complex behavior from simple gadgets
5. **Type safety** - Full TypeScript with inference

## Map-Based Arguments

Functions use maps for arguments to enable:
- **Partial binding**: `{a: 5}` waiting for `{b: 3}`
- **Named arguments**: No positional coupling
- **Natural merging**: Maps compose cleanly
- **Utilities**: Use lodash `pick`, `omit`, etc. for ergonomics

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

Everything else - cells, functions, routers, tuplespaces - are just gadgets with different consider/act implementations. The network builds itself using the same mechanism it uses to process data.