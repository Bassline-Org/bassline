# CLAUDE.md

This file provides guidance to Claude Code when working with the Bassline codebase.

## Project Overview

Bassline is a propagation network system where computation flows through a graph of connected gadgets. The core innovation is that UI elements themselves are gadgets in the network - "UI IS computation."

## Architecture

### Core Packages

1. **port-graphs/src/pp** - The propagation network engine (our only active code)
  - `core.ts`: The 32-line protocol implementation
  - `common.ts`: Basic gadget patterns (cell, fn, wire)
  - Everything else in port-graphs is old/deprecated

2. **apps/web** - React Router demo application
   - Not actively used yet, will be integration target later

## TypeScript Strict Mode Configuration

This codebase uses TypeScript's strict mode with additional checks for maximum type safety:

### What Each Flag Catches

- **strict**: Enables all strict type-checking options
- **noUncheckedIndexedAccess**: Prevents `arr[i]` without checking if `i` is valid
- **noImplicitOverride**: Requires `override` keyword when overriding base class methods
- **noUnusedLocals/Parameters**: Catches unused variables and parameters
- **noFallthroughCasesInSwitch**: Prevents accidental switch case fallthrough
- **exactOptionalPropertyTypes**: Distinguishes between `undefined` and missing properties
- **noPropertyAccessFromIndexSignature**: Forces explicit index signature access

# Propagation Network Model: Apply/Consider/Act Protocol

## Overview

This document summarizes our minimal propagation network model based on a three-step protocol. The key insight is that everything in the system - including topology management - follows the same pattern of partial information flow.

## Core Protocol

Every gadget (computational unit) follows this three-step protocol:

1. **APPLY** - Receive and integrate partial information with current state
2. **CONSIDER** - Evaluate the significance of the result in context  
3. **ACT** - Decide what to do (propagate, connect, or nothing)

```typescript
gadget = (information, context) => (new_context, effects)
```

## Key Principles

### Everything is Partial Information
- No assumption of complete data
- Information accumulates monotonically
- Merge functions define how information combines
- Semilattice properties guarantee convergence

### Everything is a Gadget
- **Cells**: Stateful gadgets that accumulate values
- **Functions**: Stateless transformation gadgets
- **Pools**: Gadgets that manage topology by accumulating assertions
- **Networks**: Can be wrapped as single gadgets

### Topology is Data
The breakthrough: wiring isn't primitive infrastructure. It's just another form of partial information managed by Pool gadgets:

```
TempSensor → Pool: "I provide temperature"
Display → Pool: "I need temperature"
Pool: APPLY (accumulate) → CONSIDER (match found) → ACT (create connection)
```

## Protocol Layers

Each step adds a layer of interpretation:

- **APPLY**: Mechanical transformation ("add this to my sum")
- **CONSIDER**: Semantic interpretation ("did this change things?")
- **ACT**: Pragmatic response ("propagate this value")

The same pattern works at every scale:
- A cell applies a number, considers if changed, acts by propagating
- Pool applies assertions, considers matches, acts by wiring
- Meta-gadgets apply protocol descriptions, consider completeness, act by generating code

## Why Three Steps Matter

The separation enables gadgets to operate at different abstraction levels simultaneously:
- Pool's APPLY treats assertions as mechanical data
- Pool's CONSIDER evaluates matches semantically
- Pool's ACT creates connections pragmatically

Without this separation, topology would require special infrastructure outside the protocol.

## Relativity of Protocol Layers

What one gadget considers an action could be mechanical data transformation to another:
- Pool sees "create connection" as its action
- But to the network, it's just data flow
- Effect handling location doesn't matter if behavior is preserved

## Implementation Simplicity

Core implementation in ~150 lines:
```typescript
type Protocol<T> = (data: unknown) => void;

const cell = <T>(merge: (old: T, new: T) => T, initial: T): Protocol<T> => {
    let state = initial;
    return (data) => {
        const result = merge(state, data as T);  // APPLY
        if (result !== state) {                  // CONSIDER
            state = result;
            propagate(result);                    // ACT
        }
    };
};
```

## Handling Cycles

Unlike reactive systems that ban cycles, this model handles them naturally:
- Partial information allows iteration
- Monotonic merge functions ensure progress
- Semilattice properties guarantee convergence
- Systems reach fixed points rather than deadlocking

## Terms and Proto-Protocols

### Terms
Structured partial information (like Clojure's EDN):
- Atomic: integers, strings, symbols, keywords
- Compound: arrays `[ ]`, maps `{:key value}`, sets `#{}`
- Tagged: `#temp/celsius 22.5`

### Proto-Protocols
Describe term transformations through the three phases:
```lisp
(protocol thermometer
  (apply (temp ?x) -> (temp (max ?x ?previous)))
  (consider (temp ?new) -> (changed ?new ?previous))
  (act (changed true) -> (temp-changed ?new)))
```

The proto-protocol interpreter itself is a gadget that:
- APPLYs protocol definitions by accumulating rules
- CONSIDERs if rules are sufficient to generate
- ACTs by producing implementation code

## Summary

The entire system reduces to:
```
partial information → apply → consider → act → more partial information
```

Everything else - CRDTs, consensus, constraints - are just gadgets with different merge functions. The network builds itself using the same mechanism it uses to process data.

This is propagation networks at their absolute minimum: no special cases, no magic, just information flowing through three universal questions at every scale.

## Implementation Details

### Current State (port-graphs/src/pp)

The entire implementation is ~80 lines across two files:

1. **core.ts** (32 lines):
   - `Gadget<TIn>` interface with `receive(data: TIn)` 
   - `protocol()` function implementing apply→consider→act pattern
   - Uses `null` returns for early exit (no special "unchanged" types)

2. **common.ts** (~50 lines):
   - `cell()`: Stateful gadget with merge function
   - `fn()`: Stateless transformation gadget  
   - `wire()`: Simple event-based connection
   - `G` builder helpers for ergonomics

### Key Implementation Insights

#### The Protocol's Null Pattern
Each step returns `null` to signal "nothing to do", enabling clean early exit without complex state tracking.

#### Effect Wrapping
Effects are wrapped as `{ effect: value }` to distinguish them from regular data, but this is just a convention - not required by the protocol.

#### Wire Implementation
Currently uses DOM events (`addEventListener`/`dispatchEvent`) but this is just one possible action semantic. Could equally use:
- Direct function calls
- React context updates
- Message passing
- Shared memory

#### No Subscription Management
Unlike traditional FRP, no complex subscription tracking. Connections are just event listeners or direct calls - garbage collection handles cleanup naturally.

### Common Patterns to Implement

#### Pool Pattern
A gadget that accumulates assertions and creates connections:
```typescript
pool = cell(
  (old, new) => mergeAssertions(old, new),
  {},
  (assertions) => matchAndWire(assertions)
)
```

#### Realizer Pattern  
Bridges abstract effects to concrete side effects:
```typescript
realizer = protocol(
  (effects) => accumulate(effects),
  (batch) => shouldExecute(batch),
  (ready) => executeEffects(ready)
)
```

#### React Integration Pattern
Components as gadgets:
```typescript
reactGadget = protocol(
  (props) => mergeWithState(props),
  (state) => shouldRerender(state),
  (next) => setReactState(next)
)
```

### Semantic Extensions

The protocol doesn't prescribe HOW gadgets act, enabling semantic extensions:

- **Event Semantics**: Act by emitting DOM events
- **Delegation Semantics**: Act by calling a central coordinator
- **Effect Semantics**: Act by producing effect descriptions
- **Direct Semantics**: Act by directly calling other gadgets

These can be mixed freely in the same network since they all follow the same protocol.

### Relativity and Composition

Key insight: What's an "action" to one gadget is just "data" to another:
- Pool thinks it's "creating a connection" (action)
- Network sees it as "data transformation" (mechanical)
- Effect location doesn't matter if behavior is preserved

This enables:
- Gadgets containing entire networks internally
- Topology as data (Pool pattern)
- Effects as data (Realizer pattern)
- Complete implementation flexibility