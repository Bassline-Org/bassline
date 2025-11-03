# Core Model: Patterns ARE Gadgets

## The Fundamental Insight

Pattern matching isn't an alternative to gadgets - **it IS gadgets**, expressed through a more uniform and powerful model.

## What is a Gadget?

A gadget in the traditional sense:

```javascript
// Traditional gadget
const maxGadget = {
  state: 0,
  receive(input) {
    if (input > this.state) {
      this.state = input;
      this.emit("changed", input);
    }
  },
  current() { return this.state; }
};
```

## What is a Pattern?

A pattern with a watcher:

```javascript
// Pattern-based "gadget"
graph.watch([["max", "item", "?value"]], (bindings) => {
  const value = bindings.get("?value");
  const current = getMaxValue(graph);

  if (value > current) {
    // Store new state as edges
    graph.add("max", `result:v${version++}`, value);
  }
});
```

## They Are The Same Thing

| Gadget Concept | Pattern Equivalent |
|----------------|-------------------|
| `receive(input)` | Edge matching pattern triggers watcher |
| `state` | Edges in the graph |
| `step(state, input)` | Watcher callback function |
| `emit(effect)` | Adding edges to graph |
| `current()` | Query graph for current edges |
| `tap(callback)` | Watch patterns on emitted edges |

## Why Patterns Are Better

### 1. State is Visible

**Gadget**: State hidden in closure/symbol
```javascript
gadget.state; // Can't access
```

**Pattern**: State is queryable edges
```javascript
graph.query([["max", "result:v10", "?value"]]); // Get current max
```

### 2. Composition is Natural

**Gadget**: Method calls and wiring
```javascript
gadget1.tap(value => gadget2.receive(value));
```

**Pattern**: Patterns trigger patterns
```javascript
// Adding edges automatically triggers matching patterns
graph.add("sensor", "reading", 105);  // Triggers temperature pattern
// Which adds: ("sensor", "alert", "high")  // Triggers alert pattern
// Which adds: ("notification", "send", true)  // Triggers notification pattern
```

### 3. History is Built-In

**Gadget**: No history unless you build it
```javascript
// Lost forever once overwritten
gadget.state = newValue;
```

**Pattern**: Append-only log preserves everything
```javascript
// All versions preserved via refinement
graph.query([["max", "?version", "?value"]]);
// Returns: v1→5, v2→10, v3→8 (rejected), v4→15
```

### 4. Distribution is Trivial

**Gadget**: Complex serialization needed
```javascript
// How do you sync gadget.state across nodes?
```

**Pattern**: Just sync edges
```javascript
// Edges are data - sync them anywhere
remoteGraph.add(...edge);  // Pattern runs on remote node
```

## The Refinement Pattern

Updates in an append-only system via versioning:

```javascript
// Incremental aggregation with refinement
graph.watch([["sum", "item", "?value"]], (bindings) => {
  const value = bindings.get("?value");

  // Get current sum (latest version)
  const current = getCurrentSum(graph) || 0;

  // Compute new sum
  const newSum = current + value;
  const version = getNextVersion(graph, "sum");

  // Add versioned result
  graph.add("sum", `result:v${version}`, newSum);

  // Mark refinement relationship
  if (version > 1) {
    graph.add(`v${version}`, "refines", `v${version-1}`);
  }
});

// Query helpers
function getCurrentSum(graph) {
  const versions = graph.query([["sum", "?ver", "?val"]])
    .filter(b => b.get("?ver").startsWith("result:v"));

  if (versions.length === 0) return null;

  // Get latest version
  const latest = versions.sort((a, b) => {
    const vA = parseInt(a.get("?ver").slice(8));
    const vB = parseInt(b.get("?ver").slice(8));
    return vB - vA;
  })[0];

  return latest.get("?val");
}
```

## Pattern Cascades = Composition

```javascript
// Level 1: Raw data
graph.watch([["?sensor", "reading", "?value"]], (b) => {
  const value = b.get("?value");
  if (value > 100) {
    graph.add(b.get("?sensor"), "status", "warning");
  }
});

// Level 2: Derived state
graph.watch([["?sensor", "status", "warning"]], (b) => {
  graph.add(b.get("?sensor"), "needs-check", true);
});

// Level 3: Actions
graph.watch([["?sensor", "needs-check", true]], (b) => {
  graph.add("maintenance", "schedule", b.get("?sensor"));
});

// This cascade IS function composition!
```

## Everything is a Pattern

### Counter
```javascript
graph.watch([["counter", "increment", "?"]], () => {
  const current = getCurrentCount(graph) || 0;
  graph.add("counter", `value:v${version++}`, current + 1);
});
```

### State Machine
```javascript
graph.watch([
  ["?entity", "state", "?current"],
  ["?entity", "event", "?event"]
], (b) => {
  const next = transitionTable[b.get("?current")][b.get("?event")];
  if (next) {
    graph.add(b.get("?entity"), `state:v${version++}`, next);
  }
});
```

### Aggregation
```javascript
graph.watch([["?group", "member", "?item"]], (b) => {
  const members = graph.query([
    [b.get("?group"), "member", "?m"]
  ]);
  graph.add(b.get("?group"), `count:v${version++}`, members.length);
});
```

## The Model Unifies Everything

Traditional systems separate:
- Computation (functions)
- State (databases)
- Communication (message passing)
- Composition (dependency injection)

Pattern matching unifies all as:
- **Patterns over edges**
- **Watchers for incremental computation**
- **Edge propagation for effects**

## Query as Computation

Queries aren't just data retrieval - they define computation spaces:

```javascript
// Create a computation space
const activeUsers = graph.queryAsGraph([
  ["?user", "status", "active"]
]);

// Run computation in that space
activeUsers.watch([["?user", "?action", "?"]], (b) => {
  // This only processes active user actions
  // 100x faster than checking all users
});
```

## Why This Matters

1. **One model for everything** - Learn patterns, build anything
2. **Introspectable by default** - All state is queryable
3. **Distributed by design** - Edges flow between nodes naturally
4. **Performance built-in** - O(1) indexing, incremental updates
5. **Correctness through simplicity** - Fewer concepts, fewer bugs

## The Future

This model suggests that all computation can be expressed as:
- Pattern matching (recognition)
- Edge addition (action)
- Cascading patterns (composition)

Everything else - databases, message queues, state machines, aggregations - emerges from these three primitives.