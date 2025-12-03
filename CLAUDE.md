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
│   │   └── watch.js      # WatchedGraph: reactive pattern matching
│   ├── mirror/
│   │   ├── interface.js  # Mirror interface + BaseMirror class
│   │   ├── registry.js   # RefRegistry: resolves URIs to mirrors
│   │   ├── cell.js       # Cell: mutable value mirror
│   │   ├── fold.js       # Fold: computed mirror from sources
│   │   ├── remote.js     # RemoteMirror: WebSocket connection
│   │   ├── action.js     # ActionMirror: fire-and-forget triggers
│   │   └── index.js      # Public API + bl:// type handlers
│   ├── types.js          # Value types: Word, PatternVar, Wildcard, Ref
│   └── pattern-parser.js # Pattern language parser
│
├── archive/
│   └── reified-rules.js  # Archived: graph-native rule storage
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
const r = ref("bl:///cell/counter"); // Ref: bl:///cell/counter
```

### Refs and Mirrors

Refs are URI-based resource identifiers. Mirrors provide access to those resources.

**URI Format:** `bl:///[type]/[path]?[query]`

Types are extensible via `registry.registerType()`.

```javascript
import {
  ref,
  createRegistry,
  Cell,
  registerAction
} from '@bassline/parser/mirror';

// Create a registry with built-in type handlers
const registry = createRegistry();

// bl:///cell/ - mutable cells
registry.lookup(ref('bl:///cell/counter'));          // Creates/retrieves a Cell
registry.lookup(ref('bl:///cell/x?initial=42'));     // Cell with initial value

// Read and write
const cell = registry.lookup(ref('bl:///cell/counter'));
cell.write(10);
cell.read();  // 10

// bl:///fold/ - computed from sources
const a = registry.lookup(ref('bl:///cell/a?initial=10'));
const b = registry.lookup(ref('bl:///cell/b?initial=20'));
registry.resolve(ref('bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b'));  // 30
registry.resolve(ref('bl:///fold/max?sources=bl:///cell/a,bl:///cell/b'));  // 20

// Folds recompute when sources change
a.write(100);
registry.resolve(ref('bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b'));  // 120

// Subscribe to changes
cell.subscribe(value => console.log('New value:', value));

// bl:///action/ - fire-and-forget triggers
registerAction(registry, 'log', (params, graph) => {
  console.log(`[${params.level || 'info'}] ${params.message}`);
});
// Trigger via standalone ref insertion (see below)

// bl:///remote/ - named peer connections
registry.lookup(ref('bl:///remote/peer1?address=ws://localhost:8080'));
```

**Built-in Types:**

| Type | Description | Example |
|------|-------------|---------|
| `/cell/` | Mutable cells | `bl:///cell/counter?initial=0` |
| `/fold/` | Computed from sources | `bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b` |
| `/action/` | Fire-and-forget triggers | `bl:///action/log?message=hello` |
| `/remote/` | Named peer connections | `bl:///remote/peer1?address=ws://...` |

**Built-in Reducers** (for bl:///fold/):
`sum`, `max`, `min`, `avg`, `count`, `first`, `last`, `concat`, `list`

**Standard Schemes:**

The registry also supports standard `ws://` and `wss://` URI schemes for WebSocket connections.

**Refs in Quads:**

Refs are allowed in **value** and **context** slots only (not entity/attribute):

```javascript
import { quad } from '@bassline/parser/algebra/quad';
import { word, ref } from '@bassline/parser/types';

// Ref as value (data source reference)
quad(word('config'), word('source'), ref('bl:///cell/data'));

// Ref as context (grouping by remote peer)
quad(word('alice'), word('age'), 30, ref('bl:///remote/peer1'));

// NOT allowed - throws error:
// quad(ref('bl:///cell/x'), word('age'), 30);  // Entity cannot be a Ref
// quad(word('x'), ref('bl:///cell/attr'), 30); // Attribute cannot be a Ref
```

**Standalone Ref Triggers:**

Refs can be inserted directly into the graph to trigger actions:

```javascript
import { WatchedGraph } from '@bassline/parser/algebra/watch';
import { createRegistry, registerAction, ref } from '@bassline/parser/mirror';

const graph = new WatchedGraph();
const registry = createRegistry();
graph.setRegistry(registry);

// Register an action
registerAction(registry, 'notify', (params, graph) => {
  console.log('Notification:', params.message);
  // Actions can insert quads into the graph
  graph.add(quad(word('notification'), word('sent'), Date.now()));
});

// Trigger by inserting standalone ref (not stored in graph)
graph.add(ref('bl:///action/notify?message=Task+complete'));
```

**Middleware Interception:**

Mirrors can intercept quad insertion via `onInsert()`:

```javascript
import { BaseMirror } from '@bassline/parser/mirror';

class LoggingMirror extends BaseMirror {
  onInsert(quad, graph) {
    console.log('Quad being inserted:', quad);
    return true;  // Allow insert (return false to block)
  }
}

// When a quad contains a ref to this mirror in value/context slot,
// onInsert is called before the quad is added to the graph.
```

**Custom Types:**

```javascript
registry.registerType('mytype', (subpath, ref, registry) => {
  // Return a mirror for bl:///mytype/[subpath]
  return new Cell(`custom:${subpath}`);
});
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

## Package Exports

```javascript
import { Graph } from '@bassline/parser/graph';
import { WatchedGraph } from '@bassline/parser/watch';
import { quad } from '@bassline/parser/algebra/quad';
import { pattern, patternQuad, matchGraph, rewrite } from '@bassline/parser/algebra/pattern';
import { word, variable, WC, ref, isRef, Ref } from '@bassline/parser/types';

// Mirror system
import {
  // Interface
  isMirror, BaseMirror,
  // Registry
  RefRegistry, getRegistry, setRegistry, resetRegistry, createRegistry,
  // Mirror types
  Cell, cell,
  Fold, fold, reducers,
  RemoteMirror, remote,
  ActionMirror, action, registerAction,
  // Type handlers
  cellTypeHandler, foldTypeHandler, remoteTypeHandler, actionTypeHandler,
  // Scheme setup
  installBuiltinTypes, installBlScheme, installWsSchemes
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
