# Bassline

A reflective distributed programming environment built on linked resources.

## What Is Bassline?

Bassline is an environment where **everything is a resource** that can be inspected, linked, and queried. Programs don't just manipulate data - they can examine and modify themselves, their types, their views, and their relationships.

The core abstraction is simple: resources addressed by URIs, accessed via `get` and `put`, returning `{ headers, body }`. But this minimal foundation supports rich semantics:

- **Types as resources** - `headers.type` is a URI you can dereference to learn about the type
- **Bidirectional links** - query what a resource references, and what references it
- **Views as queries** - find views by querying links to a type
- **Code as resources** - modules live in the system, can be loaded and invoked
- **Late binding** - refs resolve when needed, enabling dynamic composition

## The Vision: Hyper-programming

Bassline aims to be a **hyper-programming environment** where development happens inside the system:

- The editor is a resource
- Types are resources that describe structure and behavior
- Views are resources that link to the types they render
- Finding views means querying links, not hardcoding
- Everything is inspectable, everything is linked

Inspired by Smalltalk's live objects, Glamorous Toolkit's moldable development, and the web's linked data model.

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

This decouples views from types - add new views without modifying the type.

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

## Reference

```
packages/core/src/
├── bassline.js      # Router with pattern matching
├── router.js        # RouterBuilder for hierarchical routes
├── links.js         # Bidirectional link index
└── index.js

packages/store-node/src/
├── file-store.js    # JSON file persistence
├── code-store.js    # JS module loader
└── index.js

apps/cli/src/
└── daemon.js        # HTTP server
```

## HTTP Daemon

```bash
BL_PORT=9111 BL_DATA=.data node apps/cli/src/daemon.js

curl "http://localhost:9111?uri=bl:///data/cells/counter"
curl -X PUT "http://localhost:9111?uri=bl:///data/cells/counter" \
  -H "Content-Type: application/json" -d '{"value": 42}'
```

## Running

```bash
pnpm install
pnpm test
```

## License

AGPLv3
