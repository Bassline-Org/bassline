# Proper Bassline

A lattice-based propagation network with a clean distinction between semi-lattice operations and functions.

## Core Concepts

### Cells (Semi-Lattice Operations)
Cells implement lattice join operations that are:
- **Associative**: `join(a, join(b, c)) = join(join(a, b), c)`
- **Commutative**: `join(a, b) = join(b, a)`
- **Idempotent**: `join(a, a) = a`

Cells can accept multiple inputs (many-to-one) and automatically merge them using their lattice operation.

```typescript
const maxCell = new MaxCell("max")
maxCell.connectFrom(source1)  // Connect first input
maxCell.connectFrom(source2)  // Connect second input
maxCell.connectFrom(source3)  // Connect third input
// Output will be the maximum of all inputs
```

### Functions (Fixed-Arity Operations)
Functions have fixed, named inputs and don't need to be ACI:

```typescript
const subtract = new SubtractFunction("sub")
subtract.connectFrom("minuend", source1)
subtract.connectFrom("subtrahend", source2)
// Output will be source1 - source2
```

### Networks
Networks are Cells that contain other gadgets. They implement union as their lattice operation:

```typescript
const network = new Network("main")
network.addGadget(cell1)
network.addGadget(func1)
network.propagate()  // Compute fixpoint
```

## Key Features

- **No Wire objects** - Direct connections using WeakRefs
- **Memory safe** - Networks hold strong references, connections use weak
- **Monotonic** - Networks only grow, never shrink
- **Boundary cells** - Mark module interfaces with `cell.makeBoundary()`

## Running Examples

```bash
npm install
npm run example        # Basic examples
npx ts-node boundary-example.ts    # Boundary cells demo
npx ts-node network-merge-example.ts   # Network merging demo
```

## Quick Example

```typescript
import { Network } from './src/network'
import { MaxCell } from './src/cells/basic'
import { AddFunction } from './src/functions/basic'

// Create a network
const network = new Network("main")

// Create cells (many-to-one)
const max = new MaxCell("max")
max.connectFrom(input1)
max.connectFrom(input2)

// Create functions (fixed inputs)
const adder = new AddFunction("add")
adder.connectFrom("a", max)
adder.connectFrom("b", constant)

// Add to network and propagate
network.addGadget(max)
network.addGadget(adder)
network.propagate()
```

## Architecture

```
Gadget (abstract base)
├── Cell (many-to-one, lattice operations)
│   ├── MaxCell, MinCell, OrCell, AndCell, UnionCell
│   └── Network (container, also a Cell!)
└── FunctionGadget (fixed arity, named inputs)
    ├── AddFunction, SubtractFunction, MultiplyFunction
    └── GateFunction, EqualFunction, GreaterThanFunction
```

## Next Steps

- Incremental computation (only recompute changes)
- Spawner cells for dynamic gadget creation
- UI integration for visualization