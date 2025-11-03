# Effects Extension

Browser-compatible side-effecting operations for the Bassline pattern matching engine.

## Overview

The effects extension enables real-world I/O operations while maintaining the pattern-matching model. Effects are triggered by patterns and write their results back to the graph as edges.

**Key Design:**
- Pattern-triggered execution (same as compute operations)
- Self-describing via `TYPE EFFECT!` convention
- Async-transparent (sync and async effects handled uniformly)
- Results written to graph when complete

## Installation

Effects are installed automatically when you create a Runtime:

```javascript
import { Runtime } from "@bassline/parser";

const rt = new Runtime();
// Core effects (LOG, ERROR, WARN, HTTP_GET, HTTP_POST) are now available
```

Or manually on a graph:

```javascript
import { Graph } from "@bassline/parser";
import { installEffects } from "@bassline/parser/extensions/effects";

const graph = new Graph();
installEffects(graph);
```

## Core Effects (Browser-Compatible)

### I/O Effects

**LOG** - Log message to console
```javascript
rt.eval('fact [log1 { EFFECT LOG INPUT "Hello, world!" }]');
rt.eval('query [log1 RESULT ?r]');
// → { logged: true, message: "Hello, world!" }
```

**ERROR** - Log error to console
```javascript
rt.eval('fact [err1 { EFFECT ERROR INPUT "Something went wrong" }]');
```

**WARN** - Log warning to console
```javascript
rt.eval('fact [warn1 { EFFECT WARN INPUT "Deprecated feature" }]');
```

### HTTP Effects

**HTTP_GET** - Fetch JSON from URL (async)
```javascript
rt.eval('fact [req1 { EFFECT HTTP_GET INPUT "https://api.example.com/data" }]');

// Query result when ready (async)
setTimeout(() => {
  rt.eval('query [req1 RESULT ?r]');
  // → { status: 200, data: {...} }

  rt.eval('query [req1 STATUS ?s]');
  // → "SUCCESS" or "ERROR"
}, 1000);
```

**HTTP_POST** - POST JSON to URL (async)
```javascript
const input = {
  url: "https://api.example.com/create",
  body: { name: "Alice", age: 30 },
  headers: { "X-Custom": "value" }
};

rt.eval(`fact [post1 { EFFECT HTTP_POST INPUT ${JSON.stringify(input)} }]`);
```

## Node.js Effects (Opt-In)

For filesystem operations, install the Node.js effects extension:

```javascript
import { Runtime } from "@bassline/parser";
import { installNodeEffects } from "@bassline/parser/extensions/effects-node";

const rt = new Runtime();
installNodeEffects(rt.graph);  // Opt-in for filesystem
```

See [effects-node/README.md](../effects-node/README.md) for details.

## Usage Patterns

### Basic Effect Execution

```javascript
// Execute effect
rt.eval('fact [eff1 { EFFECT LOG INPUT "message" }]');

// Query result
rt.eval('query [eff1 RESULT ?r]');

// Query status
rt.eval('query [eff1 STATUS ?s]');  // "SUCCESS" or "ERROR"
```

### Error Handling

```javascript
// If effect fails, ERROR and STATUS are written
rt.eval('fact [bad1 { EFFECT HTTP_GET INPUT "invalid-url" }]');

setTimeout(() => {
  rt.eval('query [bad1 ERROR ?e]');   // → error message
  rt.eval('query [bad1 STATUS ?s]');  // → "ERROR"
}, 100);
```

### Chaining Effects with Rules

```javascript
// Rule: when data is validated, log it
rt.eval('rule LOG_VALIDATED [?d validated true] [?d value ?v] -> [?d log-effect LOG-1]');
rt.eval('rule EXEC_LOG [?d log-effect ?id] [?d value ?v] -> [?id EFFECT LOG] [?id INPUT ?v]');

// Trigger the rule
rt.eval('fact [data1 validated true] [data1 value "Important data"]');
// Logs: "Important data"
```

### Effects with NAC (Negative Application Conditions)

```javascript
// Rule: log only non-deleted items
rt.eval('rule LOG_ACTIVE [?item status active not ?item deleted true] -> [log1 EFFECT LOG] [log1 INPUT "Active item"]');

rt.eval('fact [item1 status active]');  // Logs "Active item"
rt.eval('fact [item2 status active] [item2 deleted true]');  // Does NOT log
```

## Self-Description

All effects are queryable:

```javascript
// List all effects
rt.eval('query [?e TYPE EFFECT!]');
// → [LOG, ERROR, WARN, HTTP_GET, HTTP_POST]

// Get documentation
rt.eval('query [LOG DOCS ?d]');
// → ["Log message to console"]

// Query by category
rt.eval('query [?e CATEGORY "io"]');
// → [LOG, ERROR, WARN]

rt.eval('query [?e CATEGORY "http"]');
// → [HTTP_GET, HTTP_POST]
```

## Architecture

Effects follow the same pattern as compute operations:

1. **Pattern matching** - Effect executes when `[?E EFFECT ?NAME]` and `[?E INPUT ?data]` both exist
2. **Watcher callback** - Async callback executes the effect
3. **Result writing** - When done, writes `[?E RESULT ?output]` and `[?E STATUS "SUCCESS"]`

**Key insight:** Async effects naturally write results to the log whenever they complete. The graph remains append-only and time-travel compatible.

## Browser Compatibility

All core effects work in both Node.js and browsers:
- ✅ `LOG`, `ERROR`, `WARN` - Use console APIs (universal)
- ✅ `HTTP_GET`, `HTTP_POST` - Use fetch API (universal)
- ❌ Filesystem effects - Node.js only (see effects-node)

## Examples

See:
- [examples/test-effects-core.js](../../examples/test-effects-core.js) - Browser-compatible examples
- [examples/test-effects.js](../../examples/test-effects.js) - Full suite with Node.js effects
