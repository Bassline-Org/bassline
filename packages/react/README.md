# port-graphs-react

React integration for port-graphs sugar layer. Provides hooks that expose sugar gadgets to React components.

## Key Concept: [value, gadget] Pattern

All hooks return `[value, gadget]` tuples where:
- **value**: Current state for rendering
- **gadget**: Gadget object for operations, wiring, and passing to other hooks

**Why expose gadgets?** Because you need them for:
- Creating derivations with `useDerive()`
- Wiring gadgets together (`.sync()`, `.provide()`, `.fanOut()`)
- Calling methods (`.receive()`, `.call()`)
- Passing to other hooks and components

## Installation

```bash
pnpm add port-graphs-react port-graphs
```

## Core Hooks

### `useGadget(gadget)` - Subscribe to Existing Gadget

Use when you have a gadget defined outside the component (module-level, prop, or context).

```tsx
import { useGadget, cells } from 'port-graphs-react';

// Module-level gadget
const sharedCounter = cells.max(0);

function Counter() {
  const [count, counter] = useGadget(sharedCounter);

  return (
    <button onClick={() => counter.receive(count + 1)}>
      Count: {count}
    </button>
  );
}
```

### `useLocalGadget(factory)` - Create Component-Local Gadget

Use when you need a gadget that exists only within a single component.

```tsx
import { useLocalGadget, cells } from 'port-graphs-react';

function Counter() {
  const [count, counter] = useLocalGadget(() => cells.max(0));

  return (
    <button onClick={() => counter.receive(count + 1)}>
      Count: {count}
    </button>
  );
}
```

### `useDerive(sources, compute)` - Derived/Computed Values

Create reactive computations that automatically update when any source changes.

```tsx
import { useLocalGadget, useDerive } from 'port-graphs-react';

function Calculator() {
  const [a, cellA] = useLocalGadget(() => cells.max(0));
  const [b, cellB] = useLocalGadget(() => cells.max(0));

  // Derive sum from multiple sources
  const [sum] = useDerive(
    { a: cellA, b: cellB },
    ({ a, b }) => a + b
  );

  return (
    <div>
      <input type="number" value={a}
        onChange={e => cellA.receive(+e.target.value)} />
      <input type="number" value={b}
        onChange={e => cellB.receive(+e.target.value)} />
      <div>Sum: {sum}</div>
    </div>
  );
}
```

### `useTable(factory)` - Table Gadgets

```tsx
import { useTable, table } from 'port-graphs-react';

function ContactList() {
  const [contacts, contactTable] = useTable(() => table.max());

  return (
    <div>
      <button onClick={() =>
        contactTable.receive({ set: { '1': { name: 'Alice', age: 30 } } })
      }>
        Add Contact
      </button>
      {Object.entries(contacts).map(([id, contact]) => (
        <div key={id}>{contact.name} - {contact.age}</div>
      ))}
    </div>
  );
}
```

### `useFunction(factory)` - Function Gadgets

```tsx
import { useFunction, fn } from 'port-graphs-react';

function Doubler() {
  const [result, doubler] = useFunction(() =>
    fn.map((x: number) => x * 2)
  );

  return (
    <div>
      <button onClick={() => doubler.call(5)}>
        Double 5
      </button>
      <div>Result: {result}</div>
    </div>
  );
}
```

## Wiring Patterns

### Bidirectional Sync

Sync two gadgets so they stay in sync:

```tsx
import { useLocalGadget, cells } from 'port-graphs-react';
import { useEffect } from 'react';

function SyncedInputs() {
  const [value1, cell1] = useLocalGadget(() => cells.ordinal('Hello'));
  const [value2, cell2] = useLocalGadget(() => cells.ordinal('Hello'));

  useEffect(() => {
    const cleanup = cell1.sync(cell2);
    return cleanup;
  }, [cell1, cell2]);

  return (
    <div>
      <input value={value1[1]}
        onChange={e => cell1.receive([value1[0] + 1, e.target.value])} />
      <input value={value2[1]}
        onChange={e => cell2.receive([value2[0] + 1, e.target.value])} />
    </div>
  );
}
```

### One-Way Provide

Provide values from one gadget to another:

```tsx
useEffect(() => {
  const cleanup = source.provide(target);
  return cleanup;
}, [source, target]);
```

### Function Fan-Out

Wire function outputs to multiple destinations:

```tsx
function Pipeline() {
  const [input, inputFunc] = useFunction(() => fn.map((x: number) => x * 2));
  const [result1, func1] = useFunction(() => fn.map((x: number) => x + 10));
  const [result2, func2] = useFunction(() => fn.map((x: number) => x - 5));

  useEffect(() => {
    return inputFunc.fanOut()
      .to(func1)
      .to(func2)
      .build();
  }, [inputFunc, func1, func2]);

  return (
    <div>
      <button onClick={() => inputFunc.call(5)}>Process 5</button>
      <div>Branch 1: {result1}</div>
      <div>Branch 2: {result2}</div>
    </div>
  );
}
```

## Module-Level vs Component-Local

**Module-Level** (shared across components):
```tsx
const sharedCounter = cells.max(0);

function ComponentA() {
  const [count] = useGadget(sharedCounter);
  return <div>{count}</div>;
}

function ComponentB() {
  const [count, counter] = useGadget(sharedCounter);
  return <button onClick={() => counter.receive(count + 1)}>+1</button>;
}
```

**Component-Local** (isolated to component):
```tsx
function Component() {
  const [count, counter] = useLocalGadget(() => cells.max(0));
  // This gadget is created and cleaned up with the component
}
```

## Sugar API Reference

### Cell Types
- `cells.max(initial)` - Monotonically increasing numbers
- `cells.min(initial)` - Monotonically decreasing numbers
- `cells.union(initial)` - Set union (growing)
- `cells.intersection(initial)` - Set intersection (shrinking)
- `cells.ordinal(initial)` - `[version, value]` tuples with causality

### Cell Methods
- `.receive(value)` - Send value to cell
- `.sync(target)` - Bidirectional sync with another cell
- `.provide(target)` - One-way provide to target
- `.whenChanged(fn)` - React to changes

### Table Operations
- `table.max()` - Table with max merge
- `table.union()` - Table with union merge
- `.receive({ set: { key: value } })` - Set entries
- `.receive({ delete: ['key1', 'key2'] })` - Delete entries

### Function Operations
- `fn.map(f)` - Map function over input
- `fn.filter(predicate)` - Filter with predicate
- `fn.partial(f, keys)` - Partial application
- `.call(input)` - Call function with input
- `.fanOut()` - Create fan-out builder

## Examples

See [src/examples](src/examples/) for complete working examples:
- [Counter.tsx](src/examples/Counter.tsx) - Basic reactive state
- [DerivedSum.tsx](src/examples/DerivedSum.tsx) - Multi-source derivations
- [SyncedInputs.tsx](src/examples/SyncedInputs.tsx) - Bidirectional sync
- [SharedState.tsx](src/examples/SharedState.tsx) - Module-level gadgets
- [Pipeline.tsx](src/examples/Pipeline.tsx) - Function composition

## Type Safety

All hooks maintain full type safety through TypeScript inference:

```tsx
// TypeScript infers everything
const [count, counter] = useLocalGadget(() => cells.max(0));
// count: number
// counter: SweetCell<number> & (full gadget type)

const [sum] = useDerive(
  { a: cellA, b: cellB },
  ({ a, b }) => a + b
);
// sum: number | undefined
```

## Why This Design?

**Q: Why return both value and gadget?**

A: Because you need both!
- **Value** for rendering UI
- **Gadget** for operations (`.receive()`), wiring (`.sync()`), and passing to other hooks (`useDerive()`)

**Q: Why not just return the value?**

A: Then you couldn't:
- Create derivations (requires gadget objects as sources)
- Wire gadgets together (requires methods like `.sync()`)
- Call gadget methods from event handlers
- Pass gadgets to child components

**Q: When should I use `useGadget` vs `useLocalGadget`?**

A:
- `useGadget` for existing gadgets (module-level, props, context)
- `useLocalGadget` for component-local state

## License

MIT
