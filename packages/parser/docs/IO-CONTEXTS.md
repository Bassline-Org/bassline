# IO Contexts - Graph-Native IO Pattern

**Status**: ✅ Fully Implemented
**Date Implemented**: 2025-11-06
**Version**: 1.0

## Overview

IO Contexts is a **graph-native pattern for side effects and computation** using system contexts (`input`/`output`) to coordinate execution. Effects, compute operations, and all future IO-like operations use this uniform pattern.

**Key Insight**: Separate data definition from execution using contexts as coordination layers.

## The Pattern

### Request → Execute → Response

```javascript
// 1. Setup: Define context with data (no execution yet)
graph.add("req1", "MESSAGE", "Hello World", null);

// 2. Trigger: Request execution via input context
graph.add("req1", "handle", "LOG", "input");

// 3. Execute: Watcher fires, performs side effect

// 4. Complete: Results written to output context
// graph.add("LOG", "handled", "req1", "output");  // Completion marker
// graph.add("req1", "LOGGED", "TRUE", "output");   // Result data
```

### Key Properties

1. **Explicit Activation**: Data setup separate from execution
   - Prepare contexts without triggering
   - Inspect pending work before execution
   - Better debugging and testing

2. **Introspectable**: Everything is queryable
   - Pending: `[?ctx handle ?effect input]`
   - Completed: `[?effect handled ?ctx output]`
   - Active: `[?effect TYPE EFFECT system]`

3. **Composable**: Chain operations via watchers
   - Watch `output` context to trigger next operation
   - Natural pipelines: A → B → C
   - Fan-out, fan-in, conditional routing

4. **Uniform**: Same pattern for all IO operations
   - Effects: side-effecting operations (LOG, HTTP_GET, WRITE_FILE)
   - Compute: pure computations (ADD, SQRT, GT)
   - Future: rules, patterns, streaming, etc.

## Implementation

### Built-in Effects (8 total)

**Browser-compatible (5 effects)**:
- `LOG`, `ERROR`, `WARN` - Console operations
- `HTTP_GET`, `HTTP_POST` - Fetch-based HTTP

**Node.js-specific (3 effects)**:
- `READ_FILE`, `WRITE_FILE`, `APPEND_FILE` - Filesystem operations

### Built-in Compute (18 total)

**Binary operations (6 ops)**:
- `ADD`, `SUBTRACT`, `MULTIPLY`, `DIVIDE`, `MOD`, `POW`

**Unary operations (6 ops)**:
- `SQRT`, `ABS`, `FLOOR`, `CEIL`, `ROUND`, `NEGATE`

**Comparison operations (6 ops)**:
- `GT`, `LT`, `GTE`, `LTE`, `EQ`, `NEQ`

## Usage Examples

### Console Logging

```javascript
import { installBuiltinEffects, isHandled, getOutput } from '@bassline/parser/io-effects';

installBuiltinEffects(graph);

// Setup and trigger
graph.add("req1", "MESSAGE", "Hello World", null);
graph.add("req1", "handle", "LOG", "input");

// Check completion
isHandled(graph, "LOG", "req1");  // true

// Get output
getOutput(graph, "req1", "LOGGED");  // "TRUE"
```

### HTTP Request

```javascript
// Setup
graph.add("req2", "URL", "https://api.example.com/data", null);
graph.add("req2", "handle", "HTTP_GET", "input");

// Query results
graph.query(["req2", "STATUS", "?status", "output"]);  // 200
graph.query(["req2", "DATA", "?data", "output"]);      // JSON response
graph.query(["req2", "OK", "?ok", "output"]);          // "TRUE"
```

### Filesystem Operations

```javascript
import { installNodeEffects } from '@bassline/parser/io-effects';

installNodeEffects(graph);

// Write file
graph.add("req3", "PATH", "/tmp/test.txt", null);
graph.add("req3", "CONTENT", "Hello from Bassline", null);
graph.add("req3", "handle", "WRITE_FILE", "input");

// Check success
graph.query(["req3", "SUCCESS", "?s", "output"]);  // "TRUE"
graph.query(["req3", "BYTES", "?b", "output"]);    // 18
```

### Compute Operations

```javascript
import { installBuiltinCompute, getComputeResult, isComputed } from '@bassline/parser/io-compute';

installBuiltinCompute(graph);

// Binary operation
graph.add("calc1", "X", 10, null);
graph.add("calc1", "Y", 20, null);
graph.add("calc1", "handle", "ADD", "input");

// Get result
getComputeResult(graph, "calc1");  // 30
isComputed(graph, "ADD", "calc1");  // true

// Unary operation
graph.add("calc2", "VALUE", 16, null);
graph.add("calc2", "handle", "SQRT", "input");
getComputeResult(graph, "calc2");  // 4

// Comparison
graph.add("comp1", "LEFT", 5, null);
graph.add("comp1", "RIGHT", 3, null);
graph.add("comp1", "handle", "GT", "input");
getComputeResult(graph, "comp1");  // true
```

### Chaining Operations

Watch `output` context to trigger next operation:

```javascript
// Chain: FETCH → PARSE
graph.watch([["HTTP_GET", "handled", "?ctx", "output"]], (bindings) => {
  const ctx = bindings.get("?ctx");
  const data = getOutput(graph, ctx, "DATA");

  // Create new context for parsing
  const parseCtx = `${ctx}:parse`;
  graph.add(parseCtx, "DATA", data, null);
  graph.add(parseCtx, "handle", "PARSE", "input");
});

// Chain: ADD → MULTIPLY
graph.watch([["ADD", "handled", "?ctx", "output"]], (bindings) => {
  const ctx = bindings.get("?ctx");
  const sum = getComputeResult(graph, ctx);

  // Create new context for multiply
  const multCtx = `${ctx}:mult`;
  graph.add(multCtx, "X", sum, null);
  graph.add(multCtx, "Y", 2, null);
  graph.add(multCtx, "handle", "MULTIPLY", "input");
});
```

## Custom Operations

### Custom Effect

```javascript
import { installIOEffect } from '@bassline/parser/io-effects';

installIOEffect(graph, "NOTIFY", async (graph, ctx) => {
  // Query inputs from context
  const messageQ = graph.query([ctx, "MESSAGE", "?m", "*"]);
  const message = messageQ[0]?.get("?m");

  // Perform side effect
  await sendNotification(message);

  // Return outputs (written to output context automatically)
  return {
    SENT: "TRUE",
    TIMESTAMP: Date.now()
  };
}, {
  category: "notification",
  doc: "Send notification. Input: MESSAGE"
});

// Use it
graph.add("notify1", "MESSAGE", "Task complete", null);
graph.add("notify1", "handle", "NOTIFY", "input");
```

### Custom Compute Operation

```javascript
import { installIOCompute } from '@bassline/parser/io-compute';

installIOCompute(graph, "DOUBLE", (x) => x * 2, {
  arity: "unary",
  operationType: "arithmetic",
  doc: "Double a number. Input: VALUE"
});

// Use it
graph.add("calc3", "VALUE", 5, null);
graph.add("calc3", "handle", "DOUBLE", "input");
getComputeResult(graph, "calc3");  // 10
```

## Architecture

### Files

```
extensions/
├── io-effects.js            # Effects framework
├── io-effects-builtin.js    # Browser effects (5)
├── io-effects-node.js       # Node.js effects (3)
├── io-compute.js            # Compute framework
└── io-compute-builtin.js    # Compute operations (18)
```

### Watcher Pattern

```javascript
// Effects watch for handle requests in input context
graph.watch([["?ctx", "handle", "LOG", "input"]], async (bindings) => {
  const ctx = bindings.get("?ctx");

  // Query context for inputs
  const messageQ = graph.query([ctx, "MESSAGE", "?m", "*"]);
  const message = messageQ[0]?.get("?m");

  // Execute effect
  console.log(message);

  // Write completion marker LAST (so watchers see complete data)
  graph.add(ctx, "LOGGED", "TRUE", "output");
  graph.add("LOG", "handled", ctx, "output");
});
```

### Critical Rule: Completion Markers Last

**Always write completion marker AFTER all result data**:

```javascript
// ❌ WRONG - completion before data
graph.add("LOG", "handled", ctx, "output");     // Marker first
graph.add(ctx, "LOGGED", "TRUE", "output");     // Data second

// ✅ CORRECT - data before completion
graph.add(ctx, "LOGGED", "TRUE", "output");     // Data first
graph.add("LOG", "handled", ctx, "output");     // Marker last
```

**Why**: Chain watchers fire on completion marker. If marker comes first, they see incomplete data.

## Helper Functions

All frameworks provide query helpers:

### Effects

```javascript
// Check if effect handled a context
isHandled(graph, "LOG", "req1");  // boolean

// Get output attribute
getOutput(graph, "req1", "LOGGED");  // value

// Find all contexts handled by effect
getHandledContexts(graph, "LOG");  // ["req1", "req2", ...]

// List all active effects
getActiveEffects(graph);  // ["LOG", "HTTP_GET", ...]
```

### Compute

```javascript
// Get computation result
getComputeResult(graph, "calc1");  // number

// Check if computed
isComputed(graph, "ADD", "calc1");  // boolean

// Find all contexts computed by operation
getComputedContexts(graph, "ADD");  // ["calc1", "calc2", ...]

// List all active operations
getActiveOperations(graph);  // ["ADD", "SQRT", "GT", ...]
```

## Performance

**Excellent** - No overhead:
- Watchers use O(1) selective activation
- Context queries are standard graph queries
- No special indexing needed
- All 160 tests pass in ~500ms

## Design Principles

1. **Separation of Concerns**: Data setup ≠ execution
2. **Everything is Edges**: No special state, fully queryable
3. **Watchers are Enough**: No special orchestration
4. **Completion Markers Last**: General reactive principle
5. **Uniform Interface**: All IO operations use same pattern

## Benefits vs OLD Pattern

**OLD pattern (immediate activation)**:
```javascript
graph.add("E1", "EFFECT", "LOG");
graph.add("E1", "INPUT", "Hello");  // Fires immediately
```

Problems:
- Can't inspect pending work
- Can't prepare without executing
- Hard to chain operations
- Implicit execution model

**NEW pattern (IO contexts)**:
```javascript
graph.add("req1", "MESSAGE", "Hello", null);    // Setup
graph.add("req1", "handle", "LOG", "input");    // Trigger
```

Benefits:
- ✅ Explicit control (setup ≠ execution)
- ✅ Introspectable (query pending/complete)
- ✅ Composable (chain via watchers)
- ✅ Testable (prepare contexts, assert outputs)

## Migration Completed

**All operations migrated** from OLD immediate-activation pattern to NEW IO contexts pattern:
- ✅ 5 browser effects
- ✅ 3 Node.js effects
- ✅ 18 compute operations
- ✅ All tests passing (160 tests)
- ✅ Documentation updated
- ✅ OLD code deleted

## Important: Not All Operations Use IO Contexts

The IO contexts pattern is designed for **one-shot request/response operations**. However, some graph operations require **continuous reactivity** and use a different pattern:

### One-Shot Pattern: IO Contexts (handle/handled)

**Use for**: Effects and Compute operations that execute once per request

```javascript
// Setup → Trigger → Execute once → Complete
graph.add("calc1", "X", 10, null);
graph.add("calc1", "Y", 20, null);
graph.add("calc1", "handle", "ADD", "input");  // Executes once
// Result: calc1 RESULT 30 output
```

**Operations using this pattern**:
- Effects: LOG, HTTP_GET, WRITE_FILE, etc. (8 effects)
- Compute: ADD, SQRT, GT, etc. (18 operations)

### Continuous Reactive Pattern: Reified Activation (memberOf)

**Use for**: Operations that need to continuously react to new data

```javascript
// Define → Activate → Continuously react to new items
graph.add("AGG1", "AGGREGATE", "SUM", null);
graph.add("AGG1", "ITEM", 10, null);
graph.add("AGG1", "memberOf", "aggregation", "system");  // Activates continuous watcher

// After activation, automatically reacts to new items:
graph.add("AGG1", "ITEM", 20, null);  // Triggers recomputation!
// Result continuously updates via refinement
```

**Operations using this pattern**:
- **Rules**: Continuously watch for pattern matches, fire on new data
- **Aggregations**: Continuously accumulate values, update results incrementally

**Key differences**:

| Aspect | IO Contexts | Reified Activation |
|--------|-------------|-------------------|
| Execution | One-shot | Continuous |
| Trigger | `handle` edge | `memberOf` edge |
| Context | `input`/`output` | `system` |
| Re-execution | New handle request | Automatically on new data |
| Use case | Effects, compute | Rules, aggregations |

## Future Extensions

The IO contexts pattern may generalize to:
- **Patterns**: Named pattern definitions with explicit activation
- **Streaming**: Multi-step operations with progress tracking
- **Workflows**: Complex orchestration via watchers
- **Distributed**: Contexts can flow across nodes

Note: Rules and aggregations already use the reified activation pattern, not IO contexts.

## References

- **Prototype Doc**: [archive/IO-CONTEXTS-PROTOTYPE.md](archive/IO-CONTEXTS-PROTOTYPE.md) - Original design exploration
- **CLAUDE.md**: Usage examples in main project docs
- **Test Suite**: `test/io-contexts.test.js` - 18 tests demonstrating pattern
- **Implementation**: See files listed in Architecture section

---

**Conclusion**: IO Contexts is the **standard pattern for all IO-like operations** in Bassline. Use it for effects, compute, and any future extensions requiring coordination between data and execution.
