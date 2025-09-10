# Gadget Model Evolution and Patterns

## Overview

This document captures the evolution of our propagation network model from the original three-step protocol to a unified discrimination/dispatch pattern based on reduction.

## Key Evolution

### Original Model
```
receive → apply → consider → act
```
- **Receive**: Accept partial information
- **Apply**: Merge with current state
- **Consider**: Evaluate significance
- **Act**: Produce effects

### Refined Model
```
consider → act (with dispatch)
```
- **Consider**: Discriminate based on state and input (pure)
- **Act**: Dispatch to appropriate reducer (effectful)

## Core Insights

### 1. Everything is Reduction

The fundamental operation is reduction over partial information:
```typescript
(state, input) → state'
```

Even "stateless" gadgets follow this pattern - they just ignore the previous state.

### 2. Consider/Act = Discriminate/Dispatch

This is essentially multimethod dispatch:
- **Consider** computes a dispatch value from (state, input)
- **Act** is a map from dispatch values to reducers
- Both phases see the same arguments (symmetric)

### 3. Operations are Injected, Not Hardcoded

Gadgets are parameterized by operations:
- **ConsiderOps**: Pure operations for discrimination
- **ActOps**: Effectful operations for actions

This enables:
- Late binding of behavior
- Clear separation of pure/effectful code
- Testability through operation injection

### 4. Observation Through Chaperones

Chaperones provide transparent observation:
- Gadgets don't know they're being observed
- Observation is just another gadget processing the observation stream
- No primitive communication - only through chaperones/routing

### 5. Topology as Partial Information

Pool gadgets demonstrate that wiring isn't primitive:
- Topology emerges from accumulating assertions
- Connections are created through the same consider/act protocol
- The network builds itself through partial information flow

## Pattern Relationships

### Connection to Clojure Concepts

1. **Multimethods**: 
   - Dispatch on computed values
   - Consider = dispatch function
   - Act = method implementations

2. **Transducers**:
   - Transform reduction processes
   - Gadgets transform how partial information accumulates
   - Composable without knowing context

3. **Agents**:
   - Asynchronous state accumulation
   - Similar to gadgets accumulating partial information
   - Effects happen through message passing

### Connection to Racket Concepts

1. **Chaperones**:
   - Transparent interposition
   - Enable observation without gadget awareness
   - Compose naturally for multiple observation layers

2. **Custodians**:
   - Hierarchical lifecycle management
   - Groups of gadgets managed together
   - Natural boundaries for network regions

3. **Inspectors**:
   - Control visibility
   - Determine what can be observed
   - Hierarchical access control

## Implementation Strategy

### TypeScript Constraints

Since TypeScript lacks Racket's runtime interposition:
1. Gadgets must explicitly expose their operations
2. Chaperones wrap gadgets rather than intercept primitives
3. Operations are passed as parameters rather than intercepted

### Core Abstractions

```typescript
interface Gadget<State, Input, Decision> {
  initial: State
  consider: (state: State, input: Input, ops: ConsiderOps) => Decision  
  act: Map<Decision, (state: State, input: Input, ops: ActOps) => State>
}
```

### Gadget Types

1. **Cells**: Accumulate state through reduction
2. **Functions**: Transform inputs (ignore previous state)
3. **Pools**: Accumulate topology information
4. **Chaperones**: Observe other gadgets transparently

## Benefits of This Model

1. **Uniform**: Everything follows the same pattern
2. **Compositional**: Gadgets compose naturally
3. **Late-bound**: Behavior determined by injected operations
4. **Observable**: Chaperones enable transparent monitoring
5. **Emergent**: Complex behavior from simple patterns

## Open Questions

1. Should discrimination values be restricted to certain types?
2. How do we handle error states in the consider/act flow?
3. Should we support async operations in act?
4. How do we model hierarchical gadget composition?

## Next Steps

1. Build out the TypeScript runtime
2. Implement real propagation between gadgets
3. Add proper chaperone-based routing
4. Create examples of emergent topology through Pools
5. Explore async/concurrent execution models