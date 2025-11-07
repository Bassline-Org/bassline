# @bassline/react-graph

Minimal React integration for Bassline's pattern-matching graph system.

## Philosophy

Everything is edges. Patterns watch for matches. Computation is incremental and reactive.

This package provides **3 primitives** that bridge Bassline's reactive graph to React's rendering model:
- `GraphProvider` - Provide graph instance via Context
- `useGraph()` - Access graph instance
- `useQuery(pattern)` - Reactive query hook (watches patterns, triggers re-renders)

That's it. No magic, no abstractions - just a direct mapping of `graph.watch()` to React.

## Installation

```bash
pnpm add @bassline/react-graph @bassline/parser react
```

## Quick Start

```jsx
import { GraphProvider, useGraph, useQuery } from '@bassline/react-graph';
import { Runtime } from '@bassline/parser/interactive';

// Create graph
const runtime = new Runtime();

function App() {
  return (
    <GraphProvider graph={runtime.graph}>
      <TodoList />
    </GraphProvider>
  );
}

function TodoList() {
  const graph = useGraph();

  // Reactive query - re-renders when pattern matches
  const todos = useQuery([["?id", "type", "todo", "*"]]);

  const handleAdd = () => {
    graph.add(`todo:${Date.now()}`, "type", "todo", null);
  };

  return (
    <div>
      <button onClick={handleAdd}>Add Todo</button>
      <ul>
        {todos.map(binding => (
          <li key={binding.get("?id")}>
            {binding.get("?id")}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## API Reference

### `<GraphProvider>`

Provides graph instance to React tree.

```jsx
import { Graph } from '@bassline/parser/graph';
import { Runtime } from '@bassline/parser/interactive';

const graph = new Graph();
// or
const runtime = new Runtime();

<GraphProvider graph={runtime.graph}>
  <App />
</GraphProvider>
```

### `useGraph()`

Access graph instance from context.

```jsx
function MyComponent() {
  const graph = useGraph();

  const handleClick = () => {
    graph.add("alice", "age", 30, null);
  };

  return <button onClick={handleClick}>Update</button>;
}
```

### `useQuery(pattern)`

Reactive query hook. Watches pattern and re-renders on matches.

**Simple pattern**:
```jsx
const people = useQuery([["?person", "type", "person", "*"]]);
```

**Multiple patterns** (join):
```jsx
const adults = useQuery([
  ["?person", "type", "person", "*"],
  ["?person", "age", "?age", "*"]
]);
```

**With NAC** (Negative Application Condition):
```jsx
const active = useQuery({
  patterns: [["?person", "type", "person", "*"]],
  nac: [["?person", "deleted", true, "*"]]
});
```

**Entity pattern** (all attributes of a single entity):
```jsx
const alice = useQuery([["alice", "?attr", "?value", "*"]]);

// Build attribute map
const attrs = new Map();
alice.forEach(binding => {
  attrs.set(binding.get("?attr"), binding.get("?value"));
});

const name = attrs.get("name");
const age = attrs.get("age");
```

## Patterns

### Lists

```jsx
function PeopleList() {
  const people = useQuery([["?id", "type", "person", "*"]]);

  return (
    <ul>
      {people.map(binding => (
        <PersonCard key={binding.get("?id")} id={binding.get("?id")} />
      ))}
    </ul>
  );
}
```

### Entity Details

```jsx
function PersonCard({ id }) {
  const attrs = useQuery([[id, "?attr", "?value", "*"]]);

  const attrMap = new Map();
  attrs.forEach(b => attrMap.set(b.get("?attr"), b.get("?value")));

  return (
    <div>
      <h2>{attrMap.get("name")}</h2>
      <p>Age: {attrMap.get("age")}</p>
    </div>
  );
}
```

### Mutations

```jsx
function AddPerson() {
  const graph = useGraph();
  const [name, setName] = useState("");

  const handleAdd = () => {
    const id = `person:${Date.now()}`;
    graph.batch(() => {
      graph.add(id, "type", "person", null);
      graph.add(id, "name", name, null);
    });
  };

  return (
    <div>
      <input value={name} onChange={e => setName(e.target.value)} />
      <button onClick={handleAdd}>Add</button>
    </div>
  );
}
```

### Reified Rules

Components automatically react to rule outputs!

```jsx
// Define rule
runtime.eval(`
  rule mark-adult
    where { ?person age ?age * }
    produce { ?person is-adult true * }
`);

// Component sees rule outputs
function AdultList() {
  const adults = useQuery([
    ["?person", "is-adult", true, "*"]
  ]);

  return <ul>{/* ... */}</ul>;
}
```

### Aggregations

```jsx
// Set up aggregation
runtime.eval(`
  insert { count:people AGGREGATE COUNT * }
  insert { count:people memberOf aggregation system }
`);

runtime.eval(`
  rule count-people
    where { ?person type person * }
    produce { count:people ITEM ?person * }
`);

// Component queries aggregation result
function PeopleCount() {
  const result = useQuery([
    ["count:people", "?key", "?value", "*"],
    ["NOT", "?newer", "REFINES", "?key", "*"]
  ]);

  // Find current (non-refined) value
  const current = result.find(b =>
    b.get("?key")?.startsWith("count:people:RESULT")
  );

  return <div>Total: {current?.get("?value") || 0}</div>;
}
```

## Examples

See [examples/todo-app.jsx](examples/todo-app.jsx) for a complete working example.

## Performance

- **Re-query strategy**: `useQuery` re-queries the entire pattern on every match. This is simple, correct, and handles all edge cases (NAC, deletions, etc.)
- **Optimization**: React 18 automatically batches updates, so multiple patterns matching won't cause excessive renders
- **Future**: Incremental updates can be added as an optimization if needed

## Design Philosophy

This package follows Bassline's core philosophy:

1. **Everything is edges** - Graph state, not component state
2. **Patterns watch for matches** - `useQuery` wraps `graph.watch()`
3. **Incremental and reactive** - Components auto-update
4. **Minimal primitives** - 3 exports, ~50 lines of code

**No abstractions**. Just a direct mapping of graph primitives to React hooks.

## Future

Potential additions (only if users request them):
- `<Group>` component (render prop wrapper)
- `<Entity>` component (syntactic sugar)
- `useMutations()` hook (mutation helpers)
- Graph-defined views (UI structure as edges)
- Incremental updates (optimization)

But for now - **keep it minimal**. The current API covers 90% of use cases.

## License

MIT
