# CLAUDE.md

This file provides guidance to Claude Code when working with the Bassline codebase.

## Project Overview

Bassline is a propagation network system where computation flows through a graph of connected gadgets. The core innovation is that UI elements themselves are gadgets in the network - "UI IS computation."

## Architecture

### Core Packages

1. **proper-bassline** - The propagation network engine
   - Cells: Value holders with lattice operations
   - Functions: Fixed-arity computation gadgets
   - Networks: Containers that hold gadgets
   - Visual Gadgets: UI elements as gadgets
   - Types: Lattice-based type system

2. **proper-bassline-react** - React integration
   - Hooks for using gadgets in React
   - NetworkCanvas for rendering visual gadgets

3. **apps/web** - React Router demo application
   - File-based routing
   - Example implementations showing proper-bassline usage

## Key Concepts

### Propagation Networks
- **Bidirectional**: Information flows both ways through connections
- **Automatic**: Changes propagate automatically when values change
- **Stable**: System converges when no more changes propagate
- **Reflective**: Networks can contain networks, gadgets can create gadgets

### Everything is a Gadget
- UI elements are VisualGadgets
- Tools are gadgets
- Even the canvas is a ViewGadget
- No React state - all state lives in cells

### Development Philosophy
1. **UI as Computation**: Every visual element is part of the propagation network
2. **No Manual State Management**: The network handles all state propagation
3. **Live Programming**: Changes to the network immediately affect the UI
4. **Extensible**: Users can create new gadgets while using the system

## Current Focus

Building an infinite canvas editor where users can:
- Create and wire gadgets visually
- See propagation happening in real-time
- Build complex systems through direct manipulation
- Extend the system with custom gadgets

## Important Patterns

### Creating and Using Cells
```typescript
const cell = new OrdinalCell('my-cell')
cell.userInput(value)  // Use userInput for ordinal cells
```

### Using FunctionGadgets
FunctionGadgets need to be wired to input cells. They compute automatically when inputs change:

```typescript
// Create a function gadget
const adder = new AddFunction('my-adder')

// Create input cells
const a = new OrdinalCell('a')
const b = new OrdinalCell('b')

// Wire inputs to the function
adder.connectFrom('a', a)  // Connect named input 'a' to cell a
adder.connectFrom('b', b)  // Connect named input 'b' to cell b

// Set values in cells - function computes automatically
a.userInput(num(5))
b.userInput(num(3))

// Get the output
const result = adder.getOutput()  // Will be num(8)
```

### Using in React
```typescript
const network = useNetwork()

// Create gadgets that persist across renders
const gadget = useGadget(() => {
  const g = new MyGadget()
  network.add(g)  // Add to network
  return g
})

// Get function output that updates when it changes
const output = useFunctionOutput(gadget)
```

### Connecting ViewGadgets
See the working examples in:
- `app/routes/list-view-demo.tsx` - Shows how to wire QueryGadget to ListView
- `app/routes/inspector-demo.tsx` - Shows how to wire gadgets for inspection
- `app/routes/proper-demo.tsx` - General proper-bassline patterns

## What NOT to Do
- Don't use React useState for application state
- Don't manually call compute() on FunctionGadgets (they auto-compute)
- Don't pass values directly to FunctionGadgets (wire them to cells)
- Don't create cycles in directed wires (bidirectional is fine)
- Don't mix old micro/femto/atto code with proper-bassline

## Next Steps
The goal is to build a clean, extensible infinite canvas editor that showcases the power of propagation networks where the UI itself is the computational graph.