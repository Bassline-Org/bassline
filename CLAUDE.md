# Bassline

A programming environment where everything is a resource.

## The Core Idea

Everything is a resource with two operations:

```javascript
{
  get: async (headers) => ({ headers, body }),
  put: async (headers, body) => ({ headers, body })
}
```

That's it. Cells, stores, functions, applications - all resources. Same interface.

## The Kit Rule

**Resources are isolated.** They can only access:

1. **Down** - Things below them via their own routes
2. **Out** - Everything else via `h.kit` (passed in headers)

```javascript
// BAD - direct JS API access
cells.create('counter', { lattice: 'maxNumber' })

// GOOD - via kit
await h.kit.put({ path: '/cells/counter' }, { lattice: 'maxNumber' })
```

Kit is a resource with an `unknown` handler. The caller controls what world the resource sees.

## Core Primitives

~35 lines in `packages/core/src/resource.js`:

- `resource({ get, put })` - Create a resource
- `routes({ segment: resource, ... })` - Route by path segment
- `bind(name, resource)` - Capture path segment as parameter
- `splitPath(path)` - Split "/a/b/c" into segment and rest

## Blits

A **blit** is a self-contained application stored as a SQLite file:

```
myapp.blit (SQLite)
├── _boot    → init.tcl (startup script)
├── _cells   → cell state (lattice, value)
├── _store   → key/value data
└── _fn      → stored functions
```

Load a blit, it configures itself:

```javascript
import { createBlits } from '@bassline/blit'

const blits = createBlits()
await blits.put({ path: '/myapp' }, { path: './myapp.blit' })

// Access blit contents
await blits.get({ path: '/myapp/cells/counter/value' })
await blits.put({ path: '/myapp/store/config' }, { theme: 'dark' })
```

Boot scripts use TCL:

```tcl
# init.tcl - runs on first load
cell create counter -lattice maxNumber
cell set counter 0
store set config {name "My App" version "1.0"}
```

## Resource Kinds

### Cell

Lattice-based state. Values merge monotonically.

```javascript
await kit.put({ path: '/cells/counter' }, { lattice: 'maxNumber' })
await kit.put({ path: '/cells/counter/value' }, 5)
await kit.put({ path: '/cells/counter/value' }, 3) // still 5, max wins
```

Lattices: `maxNumber`, `minNumber`, `setUnion`, `lww`, `boolean`, `object`

### Store

Key/value storage. Memory, file, or SQLite-backed.

```javascript
await kit.put({ path: '/store/users/alice' }, { name: 'Alice' })
const user = await kit.get({ path: '/store/users/alice' })
```

### Propagator

Reactive computation. When inputs change, recomputes output.

```javascript
await kit.put(
  { path: '/propagators/sum' },
  {
    inputs: ['/cells/a', '/cells/b'],
    output: '/cells/total',
    fn: '/fn/sum',
  }
)
```

## Packages

```
packages/
  core/       # Resource primitives (resource, routes, bind)
              # + cells, propagators, plumber, fn, timers, store
  tcl/        # TCL-inspired scripting language
  blit/       # Frozen resources (SQLite-backed applications)
  node/       # HTTP/WebSocket servers, file store
  remote/     # WebSocket client for distributed access
  database/   # SQLite connection wrapper
  services/   # External integrations (Claude API, MCP)
  trust/      # Trust computation and capability gating

apps/
  tui/        # Terminal UI (React + Ink)
```

## Building Resources

```javascript
import { resource, routes, bind } from '@bassline/core'

// Simple resource
const counter = resource({
  get: async () => ({ headers: {}, body: count }),
  put: async (h, b) => ({ headers: {}, body: (count += b) }),
})

// Routing
const app = routes({
  cells: cellsResource,
  users: bind('id', userResource), // captures :id
  unknown: fallbackResource,
})

// Using kit
const worker = resource({
  put: async (h, task) => {
    const config = await h.kit.get({ path: '/config' })
    await h.kit.put({ path: '/results' }, result)
    return { headers: {}, body: { done: true } }
  },
})
```

## Running

```bash
pnpm install
pnpm test
```

## License

AGPLv3
