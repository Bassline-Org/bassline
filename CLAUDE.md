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

## Semantic Zoom Canvas

The editor uses semantic zoom on an infinite canvas:

### Zoom Levels
- **0.1-0.3x**: Dot with label (overview mode)
- **0.3-0.6x**: Compact box showing name and value
- **0.6-1.5x**: Normal view with input/output ports
- **1.5-3x**: Detailed view with metadata and labels
- **3x+**: Internal view - see inside networks

### Canvas Principles
1. **One infinite space** - No modals or separate views, everything on one canvas
2. **Zoom = Detail** - Zoom level determines what you see and can interact with
3. **Continuous navigation** - Zoom into networks to see/edit internals
4. **Unique instances** - Each gadget is unique, no shared definitions
5. **Bottom panel** - Tools panel that will become a gadget itself

### Interaction Model
- **Pan**: Shift+drag or middle mouse button
- **Zoom**: Scroll wheel, zooms toward cursor
- **Create**: Drag from bottom panel palette
- **Connect**: Drag from output port to input port
- **Select**: Click or drag rectangle

## Type-Safe Patterns

### Working with LatticeValues

```typescript
// CORRECT: Safe extraction with type checking
const value = cell.getOutput()
if (value?.type === 'number') {
  const num = value.value // TypeScript knows this is a number
}

// WRONG: Assuming types without checking
const value = cell.getOutput()
const num = value.value // Could be undefined or wrong type!
```

### Creating Type-Safe FunctionGadgets

```typescript
// CORRECT: Properly typed function implementation
class AddFunction extends FunctionGadget {
  constructor(id: string) {
    super(id, ['a', 'b']) // Define input names
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const a = args['a']
    const b = args['b']
    
    // Always check for undefined with noUncheckedIndexedAccess
    if (!a || !b) return nil()
    
    // Type guard before using values
    if (a.type !== 'number' || b.type !== 'number') {
      return nil()
    }
    
    return num(a.value + b.value)
  }
}
```

### Safe Array/Object Access

```typescript
// With noUncheckedIndexedAccess, array access returns T | undefined
const items = ['a', 'b', 'c']
const item = items[0] // item is string | undefined

// CORRECT: Check before using
if (item !== undefined) {
  console.log(item.toUpperCase())
}

// For objects with index signatures
const map: Record<string, number> = { a: 1 }
const value = map['key'] // value is number | undefined

// CORRECT: Use nullish coalescing or check
const safeValue = map['key'] ?? 0
```

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

### Memory Management with WeakRefs

```typescript
// CORRECT: Use WeakRef for preventing memory leaks in connections
class Cell {
  inputs: Set<WeakRef<Gadget>> = new Set()
  
  connectFrom(source: Gadget) {
    this.inputs.add(new WeakRef(source))
  }
  
  pullFromInputs() {
    for (const inputRef of this.inputs) {
      const input = inputRef.deref()
      if (!input) continue // Source was garbage collected
      // Use input...
    }
  }
}
```

## Common Mistakes and How to Avoid Them

### ❌ DON'T: Use React useState for application state
```typescript
// WRONG
const [value, setValue] = useState(0)
```

### ✅ DO: Use cells for all state
```typescript
// CORRECT
const [value, setValue] = useCell(cell)
```

### ❌ DON'T: Manually call compute() on FunctionGadgets
```typescript
// WRONG
func.compute()
```

### ✅ DO: Let functions compute automatically via propagation
```typescript
// CORRECT - Just wire and set inputs
func.connectFrom('input', cell)
cell.userInput(value)  // Function computes automatically
```

### ❌ DON'T: Pass values directly to FunctionGadgets
```typescript
// WRONG
func.setValue(5)  // FunctionGadgets don't have setValue
```

### ✅ DO: Wire functions to cells
```typescript
// CORRECT
const input = new OrdinalCell('input')
func.connectFrom('value', input)
input.userInput(num(5))
```

### ❌ DON'T: Create gadgets in render loops
```typescript
// WRONG
function Component() {
  const gadget = new MyGadget()  // Creates new gadget every render!
  return <div>...</div>
}
```

### ✅ DO: Use useGadget for stable references
```typescript
// CORRECT
function Component() {
  const gadget = useGadget(() => new MyGadget())
  return <div>...</div>
}
```

### ❌ DON'T: Access array/object properties without checking
```typescript
// WRONG (with noUncheckedIndexedAccess)
const value = array[index].property  // Could throw!
```

### ✅ DO: Check for undefined first
```typescript
// CORRECT
const item = array[index]
if (item !== undefined) {
  const value = item.property
}
```

## Code Organization Rules

### File Structure
- One gadget class per file
- Name files after the gadget class (kebab-case)
- Group related gadgets in subdirectories
- Keep visual gadgets in `visuals/` directory

### Export Patterns
```typescript
// PREFER: Named exports for better refactoring
export class MyGadget extends Gadget { }
export function createMyGadget() { }

// AVOID: Default exports (harder to refactor)
export default class MyGadget { }
```

### Test File Placement
- Place tests next to source files: `my-gadget.test.ts`
- Use descriptive test names that explain the behavior

## Performance Considerations

### Avoid Creating Gadgets in Hot Paths
```typescript
// WRONG: Creates gadget every call
function compute(value: number) {
  const cell = new OrdinalCell('temp')  // Memory leak!
  cell.userInput(num(value))
  return cell.getOutput()
}

// CORRECT: Reuse gadgets
const tempCell = new OrdinalCell('temp')
function compute(value: number) {
  tempCell.userInput(num(value))
  return tempCell.getOutput()
}
```

### Batch Operations When Possible
```typescript
// CORRECT: Batch multiple changes
network.transaction(() => {
  cell1.userInput(value1)
  cell2.userInput(value2)
  cell3.userInput(value3)
})  // All changes propagate together
```

### Use WeakRefs for Connections
Always use WeakRefs in connections to prevent memory leaks when gadgets are removed from the network.

## Working Examples

See the working examples in:
- `app/routes/list-view-demo.tsx` - Shows how to wire QueryGadget to ListView
- `app/routes/inspector-demo.tsx` - Shows how to wire gadgets for inspection
- `app/routes/proper-demo.tsx` - General proper-bassline patterns
- `app/routes/tree-view-demo.tsx` - Hierarchical view implementation

## What NOT to Do

- Don't use React useState for application state
- Don't manually call compute() on FunctionGadgets (they auto-compute)
- Don't pass values directly to FunctionGadgets (wire them to cells)
- Don't create cycles in directed wires (bidirectional is fine)
- Don't mix old micro/femto/atto code with proper-bassline
- Don't ignore TypeScript strict mode errors - they prevent runtime bugs
- Don't access arrays/objects without checking for undefined
- Don't create gadgets in render loops or hot paths

## Next Steps

The goal is to build a clean, extensible infinite canvas editor that showcases the power of propagation networks where the UI itself is the computational graph.

## Development Commands

```bash
# Start development server
pnpm dev

# Run type checking
pnpm typecheck

# Run tests
pnpm test

# Build for production
pnpm build
```

## Debugging Tips

1. **Use TypeScript strict mode errors as a guide** - They often point to real bugs
2. **Check for undefined** - With `noUncheckedIndexedAccess`, always verify array/object access
3. **Watch propagation** - Use console.log in accept/emit to trace propagation flow
4. **Check connections** - Verify gadgets are properly wired with connectFrom
5. **Memory leaks** - Use browser DevTools to check for retained gadgets