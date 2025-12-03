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
│   ├── mirror/
│   │   ├── interface.js  # Mirror interface + BaseMirror class
│   │   ├── registry.js   # RefRegistry: resolves URIs to mirrors
│   │   ├── cell.js       # Cell: mutable value mirror
│   │   ├── fold.js       # Fold: computed mirror from sources
│   │   ├── remote.js     # RemoteMirror: WebSocket connection
│   │   └── index.js      # Public API + scheme handlers
│   ├── types.js          # Value types: Word, PatternVar, Wildcard, Ref
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
- **Ref** - URI reference to an external resource
- **string** - Case-sensitive literal
- **number** - Numeric value

```javascript
import { word, variable, WC, ref } from '@bassline/parser/types';

const w = word("alice");     // Word: ALICE
const v = variable("x");     // PatternVar: ?X
const wc = WC;               // Wildcard: *
const r = ref("local://counter"); // Ref: local://counter
```

### Refs and Mirrors

Refs are URI-based resource identifiers. Mirrors provide access to those resources.

```javascript
import {
  ref,
  createRegistry,
  Cell,
  reducers
} from '@bassline/parser/mirror';

// Create a registry with built-in scheme handlers
const registry = createRegistry();

// local:// - mutable cells
registry.lookup(ref('local://counter'));          // Creates/retrieves a Cell
registry.lookup(ref('local://x?initial=42'));     // Cell with initial value

// Read and write
const cell = registry.lookup(ref('local://counter'));
cell.write(10);
cell.read();  // 10

// fold:// - computed from sources
registry.getStore('local').set('a', new Cell(10));
registry.getStore('local').set('b', new Cell(20));
registry.resolve(ref('fold://sum?sources=local://a,local://b'));  // 30
registry.resolve(ref('fold://max?sources=local://a,local://b'));  // 20

// Folds recompute when sources change
const a = registry.lookup(ref('local://a'));
a.write(100);
registry.resolve(ref('fold://sum?sources=local://a,local://b'));  // 120

// Subscribe to changes
cell.subscribe(value => console.log('New value:', value));
```

**URI Schemes:**

| Scheme | Description | Example |
|--------|-------------|---------|
| `local://` | Mutable cells stored by path | `local://counter` |
| `fold://` | Computed from sources | `fold://sum?sources=local://a,local://b` |
| `ws://` | WebSocket connection | `ws://localhost:8080/sync` |
| `wss://` | Secure WebSocket | `wss://server.example.com/sync` |

**Built-in Reducers** (for fold://):
`sum`, `max`, `min`, `avg`, `count`, `first`, `last`, `concat`, `list`

**Refs in Quads:**

Refs can be used in any position in a quad:

```javascript
import { quad } from '@bassline/parser/algebra/quad';
import { word, ref } from '@bassline/parser/types';

// Ref as value (common case)
quad(word('config'), word('source'), ref('ws://remote:8080/data'));

// Ref as entity
quad(ref('local://alice'), word('age'), 30);
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
import { word, variable, WC, ref, isRef } from '@bassline/parser/types';

// Mirror system
import {
  Cell, cell,
  Fold, fold, reducers,
  RemoteMirror, remote,
  RefRegistry, getRegistry, createRegistry,
  installBuiltinSchemes,
  isMirror
} from '@bassline/parser/mirror';
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
