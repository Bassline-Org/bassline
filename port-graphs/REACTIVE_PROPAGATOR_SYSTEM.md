# Reactive Propagator System

A clean, minimal reactive programming system based on propagator networks with mode polymorphism and explicit wiring.

## Core Concepts

### Mode Polymorphism
Calls to reactive components behave differently based on the current mode:
- **Wiring Mode**: Establishes dependencies between components
- **Run Mode**: Computes and propagates values through the network

### Reactive Components
- **Cells**: Stateful reactive values that merge inputs using a merge function
- **Gadgets**: Stateless reactive computations that execute a body function

### Explicit Wiring
Use the `.into()` method to create downstream connections between reactive components.

## Key Features

- **Structural Equality**: Uses lodash `isEqual` to prevent infinite loops with complex data types
- **Type Safety**: Full TypeScript support with proper call signatures
- **Distributed Ready**: Pure functions and idempotent operations for distributed systems
- **Clean API**: Minimal, intuitive interface

## Usage Examples

### Basic Cells and Gadgets

```typescript
// Create cells with merge functions
const a = Cell(maxFn, 0);
const b = Cell(maxFn, 0);

// Create a gadget that computes a + b
const adder = Gadget(() => {
    return a() + b(); // These calls wire up connections during construction
});

// Wire the gadget to a cell
const c = Cell(maxFn, 0);
adder.into(c);

// Set values and observe propagation
a(5);
b(3);
console.log(adder.value()); // 8
```

### Set Operations with Circular Dependencies

```typescript
const aSet = Cell(setUnion, new Set([1]));
const bSet = Cell(setUnion, new Set([2]));
const cSet = Cell(setUnion, new Set([3]));

// Create circular connections
aSet.into(bSet);
bSet.into(cSet);
cSet.into(aSet);

// All sets will converge to contain {1, 2, 3}
aSet([5, 7, 9]);
// All sets now contain {1, 2, 3, 5, 7, 9}
```

### Parameterized Gadgets

```typescript
// Create a parameterized multiplier gadget
const multiplier = Gadget((x, y) => x() * y());

// Use it with specific inputs
const result = Cell(maxFn, 0);
multiplier(a, b).into(result);
```

## Architecture Benefits

### For Distributed Systems
- **Pure Functions**: All merge functions are pure with no side effects
- **Idempotent Operations**: Safe to retry and replay
- **No Hidden State**: All dependencies are explicit
- **Network Friendly**: Simple serialization and deserialization

### For Performance
- **Structural Equality**: Prevents unnecessary recomputations
- **Explicit Dependencies**: Clear propagation paths
- **Minimal Overhead**: Simple implementation with native JS structures

### For Maintainability
- **Clean API**: Intuitive and minimal interface
- **Type Safety**: Full TypeScript support
- **Explicit Wiring**: Dependencies are visible and controllable
- **Mode Polymorphism**: Clear separation of concerns

## Implementation Details

The system uses a single `createReactive` function that handles both cells and gadgets through parameters:
- `stateful`: Whether the reactive holds state (cells) or is stateless (gadgets)
- `isGadget`: Whether this is a gadget for type checking
- `body`: The merge function (cells) or computation function (gadgets)

Mode polymorphism is achieved through global state (`current_mode`) that changes the behavior of the `call` function.

## Why This Approach Works

1. **Simplicity**: Minimal codebase with clear semantics
2. **Flexibility**: Supports both stateful and stateless reactive components
3. **Performance**: Efficient with structural equality and explicit dependencies
4. **Scalability**: Ready for distributed deployment with pure functions
5. **Maintainability**: Clean separation of concerns and explicit wiring

This design provides a solid foundation for building reactive systems that can scale from simple local applications to complex distributed networks.
