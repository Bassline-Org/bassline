# CLAUDE.md - Bassline

## Overview

Bassline is a pattern-matching graph system for distributed applications. The core idea: all data is quads, patterns watch for matches, computation is incremental and reactive.

## Why JavaScript

- Highly dynamic runtime (pattern compilation, incremental matching)
- Static types don't add value for this use case
- Ship source directly, no build step
- Power comes from runtime flexibility

## Architecture

```
packages/parser/
├── src/
│   ├── algebra/
│   │   ├── graph.js      # Graph: set of quads with add/remove
│   │   ├── quad.js       # Quad: (entity, attribute, value, context)
│   │   ├── pattern.js    # Pattern matching and rewriting
│   │   ├── watch.js      # WatchedGraph: reactive pattern matching
│   │   └── instrument.js # Instrumentation hooks
│   ├── types.js          # Value types: Word, PatternVar, Wildcard
│   ├── control.js        # High-level control interface
│   └── pattern-parser.js # Pattern language parser
│
├── extensions/
│   ├── io-compute.js            # Compute operations framework
│   ├── io-compute-builtin.js    # Built-in operations (ADD, MULTIPLY, etc.)
│   ├── io-effects.js            # Effects framework
│   ├── io-effects-builtin.js    # Browser effects (LOG, HTTP_GET, etc.)
│   ├── io-effects-node.js       # Node.js effects (filesystem)
│   ├── io-effects-persistence.js # Persistence (BACKUP, LOAD, SYNC)
│   ├── io-effects-connections.js # WebSocket connections
│   └── aggregation/             # Aggregation operations
│
└── test/
    └── *.test.js
```

## Core Concepts

### Value Types

All values in the graph are typed:

- **Word** - Case-insensitive identifier (interned as symbol)
- **PatternVar** - Variable that matches and binds any value
- **Wildcard** - Matches any value without binding
- **string** - Case-sensitive literal
- **number** - Numeric value

```javascript
import { word, variable, WC } from '@bassline/parser/types';

const w = word("alice");     // Word: ALICE
const v = variable("x");     // PatternVar: ?X
const wc = WC;               // Wildcard: *
```

### Quads

A quad is `(entity, attribute, value, context)`. The context groups related facts.

```javascript
import { quad } from '@bassline/parser/algebra/quad';
import { word as w } from '@bassline/parser/types';

quad(w("alice"), w("age"), 30, w("facts"));
```

### Graph

A graph is a set of quads with add/remove/query operations.

```javascript
import { Graph } from '@bassline/parser/graph';

const g = new Graph();
g.add(quad(w("alice"), w("age"), 30, w("facts")));
```

### Patterns

Patterns match against quads using variables and wildcards.

```javascript
import { pattern, patternQuad } from '@bassline/parser/algebra/pattern';
import { variable as v, WC } from '@bassline/parser/types';

const p = pattern(
  patternQuad(v("person"), w("age"), v("age"), WC)
);

const matches = matchGraph(graph, p);
// Returns Match objects with bindings
```

### WatchedGraph

Extends Graph with reactive pattern matching. When quads are added, matching patterns fire automatically.

```javascript
import { WatchedGraph } from '@bassline/parser/watch';

const g = new WatchedGraph();

// Register a rule: pattern + production function
g.watch({
  pattern: pattern(patternQuad(v("p"), w("age"), v("a"), WC)),
  production: (match) => {
    // Return new quads to add
    return [quad(match.get("p"), w("adult"), w("true"), w("derived"))];
  }
});

// Adding quads triggers matching rules
g.add(quad(w("alice"), w("age"), 30, w("facts")));
// → Automatically adds: alice adult true derived
```

### NAC (Negative Application Conditions)

Patterns can specify conditions that must NOT match:

```javascript
const p = pattern(
  patternQuad(v("p"), w("age"), v("a"), WC)
).setNAC(
  patternQuad(v("p"), w("deleted"), w("true"), WC)
);
// Only matches people who are NOT deleted
```

## Performance

WatchedGraph uses **selective activation indexes** for O(1) pattern matching:

- Patterns are indexed by their literal values (entity, attribute, value, context)
- When a quad is added, only patterns that could possibly match are checked
- This avoids the naive O(patterns × quads) approach

## Extensions

### IO Compute

Request-response style computation via quads:

```javascript
import { installBuiltinCompute } from '@bassline/parser/io-compute';

installBuiltinCompute(graph);

// Set up operands
graph.add(quad(w("calc1"), w("X"), 10, w("input")));
graph.add(quad(w("calc1"), w("Y"), 20, w("input")));

// Request computation
graph.add(quad(w("calc1"), w("handle"), w("ADD"), w("input")));

// Result appears in output context
// calc1 RESULT 30 output
```

### IO Effects

Side effects (logging, HTTP, filesystem):

```javascript
import { installBuiltinEffects } from '@bassline/parser/io-effects';

installBuiltinEffects(graph);

graph.add(quad(w("log1"), w("MESSAGE"), "Hello", w("input")));
graph.add(quad(w("log1"), w("handle"), w("LOG"), w("input")));
```

### Persistence

Snapshot and incremental sync:

```javascript
import { installAllPersistence } from '@bassline/parser/io-effects-persistence';

installAllPersistence(graph);

// Backup
graph.add(quad(w("backup1"), w("TARGET"), "file:///path/to/backup.json", w("input")));
graph.add(quad(w("backup1"), w("handle"), w("BACKUP"), w("input")));
```

### WebSocket Connections

Sync quads between graphs over WebSocket:

```javascript
import { installConnectionEffects } from '@bassline/parser/connections';

installConnectionEffects(graph);

// Server
graph.add(quad(w("server1"), w("PORT"), 8080, w("input")));
graph.add(quad(w("server1"), w("BIND_CONTEXT"), w("shared"), w("input")));
graph.add(quad(w("server1"), w("handle"), w("LISTEN"), w("input")));

// Client
graph.add(quad(w("conn1"), w("URL"), "ws://localhost:8080", w("input")));
graph.add(quad(w("conn1"), w("BIND_CONTEXT"), w("shared"), w("input")));
graph.add(quad(w("conn1"), w("handle"), w("CONNECT"), w("input")));

// Quads added to "shared" context auto-sync
```

## Package Exports

```javascript
import { Graph } from '@bassline/parser/graph';
import { WatchedGraph } from '@bassline/parser/watch';
import { quad } from '@bassline/parser/algebra/quad';
import { pattern, patternQuad, matchGraph, rewrite } from '@bassline/parser/algebra/pattern';
import { word, variable, WC } from '@bassline/parser/types';
```

## Design Principles

1. **Append-only** - Quads accumulate, deletions are tombstones
2. **Incremental** - Patterns fire as quads arrive
3. **Reactive** - Rules maintain invariants automatically
4. **Queryable** - All state is quads, all quads are queryable
5. **O(1) matching** - Selective activation via indexing

## Running Tests

```bash
pnpm install
pnpm test
```

## License

AGPLv3
