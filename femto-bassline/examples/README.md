# Femto-Bassline Examples

This directory contains examples demonstrating various features and patterns of the Femto-Bassline propagation system.

## Examples Overview

### 01. Basic Math Network (`01-basic-math.ts`)

**Concepts**: Math primitives, basic wiring, gadget composition

Creates a simple calculation network that computes `(a + b) * c` using:
- Binary math gadgets (add, multiply)
- Slot declarations and wiring
- Board IR structure

**Run**: `npx ts-node examples/01-basic-math.ts`

### 02. Rate-Limited API Pipeline (`02-rate-limited-api.ts`)

**Concepts**: Shim gadgets, aspects, flow control, observability

Builds an API request pipeline with:
- Tap gadgets for monitoring
- Rate limiting with token bucket
- Credit-based scheduling
- Aspect composition via lattices

**Run**: `npx ts-node examples/02-rate-limited-api.ts`

### 03. String Processing Pipeline (`03-string-processing.ts`)

**Concepts**: String manipulation, stateful gadgets, conditional logic

Implements an email processing system with:
- String transformation (trim, lowercase)
- Pattern matching and validation
- Template processing
- Accumulator gadgets for statistics
- Conditional routing

**Run**: `npx ts-node examples/03-string-processing.ts`

## Key Patterns Demonstrated

### Board Structure

All examples show how to define boards with:
- Slot declarations with pinout requirements
- Wire connections between slots and pins
- Aspect application to wires
- Boundary contacts for inputs/outputs

### Gadget Composition

Examples demonstrate different composition patterns:
- **Sequential**: Output of one gadget feeds input of next
- **Parallel**: Multiple gadgets process same input
- **Conditional**: Logic gadgets control data flow
- **Stateful**: Accumulators maintain internal state

### Aspect System

The rate-limiting example shows how aspects:
- Apply to wires at different join points (tapIn, tapOut, around)
- Compose via lattices (taking most restrictive)
- Transform into shim gadgets during lowering

### Type Safety

All examples use TypeScript with Zod validation:
- Branded ID types prevent mixing identifiers
- Pinout specifications ensure compatibility
- Runtime validation catches errors early

## Running the Examples

### Prerequisites

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build
```

### Run Individual Examples

```bash
# Run with ts-node
npx ts-node examples/01-basic-math.ts
npx ts-node examples/02-rate-limited-api.ts
npx ts-node examples/03-string-processing.ts

# Or compile and run
pnpm build
node dist/examples/01-basic-math.js
```

### Run All Examples

```bash
# Create a runner script
for file in examples/*.ts; do
  echo "Running $file..."
  npx ts-node "$file"
  echo ""
done
```

## Creating Your Own Examples

To create a new example:

1. **Define the Board IR**:
```typescript
const board: BoardIR = {
  id: createBoardId('my-example'),
  slots: { /* ... */ },
  wires: { /* ... */ },
  aspects: { /* ... */ }
};
```

2. **Create Gadgets**:
```typescript
const gadget = createMyGadget('gadget-id', config);
```

3. **Wire Connections**:
```typescript
wires: {
  [createWireId('connection')]: {
    from: { slot: slotId1, pin: 'out' },
    to: { slot: slotId2, pin: 'in' }
  }
}
```

4. **Apply Aspects** (optional):
```typescript
aspects: {
  [wireId]: [{
    id: createAspectId('tap', 1),
    at: 'tapIn',
    params: { /* ... */ }
  }]
}
```

5. **Create Binder and Lower**:
```typescript
const binder = createBinder(boardId, {
  aspectRegistry: createDefaultAspectRegistry()
});
await binder.apply({ op: 'setBoardIR', board });
const graph = binder.lower();
```

## Common Patterns

### Input/Output Boundaries

```typescript
slots: {
  [createSlotId('input')]: {
    requires: createPinoutId('value-io')
  },
  [createSlotId('output')]: {
    requires: createPinoutId('value-io')
  }
}
```

### Error Handling

```typescript
try {
  const result = await gadget.process(input);
} catch (error) {
  console.error('Processing failed:', error);
  // Handle gracefully
}
```

### Statistics Collection

```typescript
const stats = gadget.getStats();
console.log('Processed:', stats.passed);
console.log('Dropped:', stats.dropped);
console.log('Queued:', stats.queued);
```

### Cleanup

```typescript
// Always clean up resources
gadget.destroy();
binder.destroy();
```

## Debugging Tips

1. **Use Tap Gadgets**: Insert taps at key points to observe data flow
2. **Check Pinout Compatibility**: Ensure slots require correct pinouts
3. **Validate IR**: Use Zod schemas to catch structural errors
4. **Enable Console Logging**: Set `DEBUG=true` for verbose output
5. **Inspect Lowered Graph**: Check the realized graph after lowering

## Further Reading

- [Core Types Documentation](../core/README.md)
- [Runtime Documentation](../runtime/README.md)
- [Standard Library Documentation](../stdlib/README.md)
- [Architecture Document](../../pico-bassline/BOARDS.md)