# Bassline

A programming environment where everything is a resource.

## Overview

Resources are addressed by URIs, accessed via `get` and `put`, returning `{ headers, body }`.

- Types are resources - `headers.type` is a URI to a type definition
- Links are bidirectional - query what references what
- Cells are lattice-based values with monotonic merge semantics
- Propagators connect cells for reactive computation

## Core Concepts

### Resources

Everything is a resource with uniform access:

```javascript
const response = await bl.get('bl:///cells/counter')
// → { headers: { type: 'bl:///types/cell' }, body: { value: 42 } }

await bl.put('bl:///cells/counter', {}, { value: 43 })
```

### URIs as Universal Names

URIs address everything - data, types, code, queries:

```
bl:///data/cells/counter     # Stored data
bl:///types/cell             # Type definition
bl:///code/reducers          # Loaded JS module
bl:///links/to/types/cell    # Query: what references cell?
bl:///views/cell-value       # A view for cells
```

### Self-Describing Data

`headers.type` is a URI pointing to a type resource:

```javascript
// A cell resource
{
  headers: { type: 'bl:///types/cell' },
  body: { value: 42 }
}

// Dereference to learn about it
await bl.get('bl:///types/cell')
// → describes what a cell is, its schema, behaviors
```

### Bidirectional Links

Resources contain refs. The link index tracks these in both directions:

```javascript
// A view that links to the cell type
{
  body: {
    for: 'bl:///types/cell',  // creates a link
    handler: 'bl:///code/views#cellValue'
  }
}

// Find all views for cells (query backlinks)
await bl.get('bl:///links/to/types/cell')
// → includes this view, plus anything else linking to cell
```

## Implementation

### Bassline Router

Pattern-matching router that maps URIs to handlers:

```javascript
import { Bassline, routes } from '@bassline/core'

const bl = new Bassline()

bl.route('/cells/:name', {
  get: ({ params }) => ({
    headers: { type: 'bl:///types/cell' },
    body: { value: store.get(params.name) }
  }),
  put: ({ params, body }) => {
    store.set(params.name, body)
    return { headers: { type: 'bl:///types/cell' }, body }
  }
})
```

Handlers receive context: `{ params, query, headers, body, bl }`

### Route Patterns

```javascript
'/users/:id'      // Single segment parameter
'/files/:path*'   // Wildcard (matches rest of path)
```

### Router Builder

Hierarchical route definitions:

```javascript
const cellRoutes = routes('/cells/:name', r => {
  r.get('/', ({ params }) => ...)
  r.get('/value', ({ params }) => ...)
  r.put('/', ({ params, body }) => ...)
})

bl.install(cellRoutes)
```

### Link Index

Track and query refs:

```javascript
import { createLinkIndex } from '@bassline/core'

const links = createLinkIndex()
bl.install(links.routes)

// Index refs when storing
links.index('bl:///cells/counter', { type: { $ref: 'bl:///types/cell' } })

// Query forward refs
await bl.get('bl:///links/from/cells/counter')
// → what does counter reference?

// Query backlinks
await bl.get('bl:///links/to/types/cell')
// → what references cell type?
```

### File Store

JSON document persistence:

```javascript
import { createFileStore } from '@bassline/store-node'

bl.install(createFileStore('.data', '/data'))

await bl.put('bl:///data/doc', {}, { content: '...' })
await bl.get('bl:///data/doc')
await bl.get('bl:///data')  // list directory
```

### Code Store

Load JS modules into the system:

```javascript
import { createCodeStore } from '@bassline/store-node'

bl.install(createCodeStore(null, '/code'))

await bl.put('bl:///code/math', {}, { path: './math.js' })
const mod = await bl.get('bl:///code/math')
mod.body.add(1, 2)  // invoke exports
```

## Cells

Cells hold values with lattice semantics. Values can only go up (monotonic).

```javascript
import { createCellRoutes } from '@bassline/cells'

const cells = createCellRoutes()
cells.install(bl)

// Create a cell with a lattice
await bl.put('bl:///cells/counter', {}, { lattice: 'maxNumber' })

// Merge a value (lattice join)
await bl.put('bl:///cells/counter/value', {}, 5)
await bl.put('bl:///cells/counter/value', {}, 3)  // still 5, max wins
await bl.put('bl:///cells/counter/value', {}, 10) // now 10
```

Built-in lattices: `maxNumber`, `minNumber`, `setUnion`, `lww` (last-writer-wins).

## Propagators

Propagators connect cells. When inputs change, they compute and write to outputs.

```javascript
import { createPropagatorRoutes } from '@bassline/propagators'

const propagators = createPropagatorRoutes({ bl })
propagators.install(bl)

// Create a sum propagator: a + b → sum
await bl.put('bl:///propagators/add', {}, {
  inputs: ['bl:///cells/a', 'bl:///cells/b'],
  output: 'bl:///cells/sum',
  handler: 'sum'
})
```

Built-in handlers: `sum`, `product`, `passthrough`, `constant`.

## Package Structure

```
packages/core/           # Router, links, plumber
packages/cells/          # Lattice-based cells
packages/propagators/    # Reactive propagators
packages/store-node/     # File and code stores
packages/server-node/    # HTTP and WebSocket servers

apps/cli/                # Daemon and seed scripts
apps/editor/             # Web editor
```

## HTTP Daemon

```bash
BL_PORT=9111 BL_DATA=.data node apps/cli/src/daemon.js

curl "http://localhost:9111?uri=bl:///data/cells/counter"
curl -X PUT "http://localhost:9111?uri=bl:///data/cells/counter" \
  -H "Content-Type: application/json" -d '{"value": 42}'
```

## Dynamic Module System

Modules can be installed at runtime via `PUT bl:///install/:name`:

```javascript
await bl.put('bl:///install/cells', {}, {
  path: './packages/cells/src/upgrade.js',
  // Additional config passed to the module
})
```

### Upgrade Modules

Each module provides an upgrade file exporting a default install function:

```javascript
// packages/cells/src/upgrade.js
export default function installCells(bl, config = {}) {
  const cells = createCellRoutes({ /* callbacks */ })
  cells.install(bl)
  bl._cells = cells  // Register for other modules
}
```

Convention: `upgrade-*.js` or `upgrade.js` in each package.

### Module Patterns

**Registry**: Modules register themselves on `bl._*` for discovery:
```javascript
bl._links = links      // Link index
bl._plumber = plumber  // Message router
bl._cells = cells      // Cell manager
bl._propagators = propagators
```

**Lookup**: Dependent modules find prerequisites from `bl`:
```javascript
// In propagators upgrade.js
const propagators = createPropagatorRoutes({ bl })  // bl passed in
```

**Deferred Callbacks**: Use optional chaining for loose coupling:
```javascript
// Cells notify propagators if available
onCellChange: ({ uri }) => {
  bl._propagators?.onCellChange(uri)  // Safe if not installed
}
```

### Bootstrap

The standard bootstrap loads all modules in order:

```bash
BL_BOOTSTRAP=./apps/cli/src/bootstrap.js node apps/cli/src/daemon.js
```

Module dependency order:
1. `links` - bidirectional ref tracking
2. `plumber` - message routing
3. `file-store` - persistence
4. `http-server` - HTTP API
5. `ws-server` - WebSocket (uses plumber)
6. `propagators` - reactive computation
7. `cells` - lattice values (uses propagators, plumber)

## Running

```bash
pnpm install
pnpm test
```

## License

AGPLv3
