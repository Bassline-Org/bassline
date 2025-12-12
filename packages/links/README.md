# @bassline/links

Bidirectional reference tracking for Bassline.

## Overview

The link index tracks references between resources in both directions:

- **Forward Links** - What does this resource reference? (`bl:///links/from/*`)
- **Backlinks** - What references this resource? (`bl:///links/to/*`)

Links are automatically indexed on every PUT operation by scanning for `bl://` URIs and `$ref` markers.

## Installation

Links are installed early in bootstrap (after plumber):

```javascript
await bl.put(
  'bl:///install/links',
  {},
  {
    path: './packages/links/src/upgrade.js',
  }
)
```

## Routes

| Route                        | Method | Description                                 |
| ---------------------------- | ------ | ------------------------------------------- |
| `/links`                     | GET    | List query endpoints                        |
| `/links/from`                | GET    | List all resources with outgoing refs       |
| `/links/to`                  | GET    | List all resources with incoming refs       |
| `/links/from/:uri*`          | GET    | Get forward refs (what does this point to?) |
| `/links/to/:uri*`            | GET    | Get backlinks (what points to this?)        |
| `/links/query`               | GET    | Flexible query with regex patterns          |
| `/links/on-resource-removed` | PUT    | Clean up links for removed resource         |

## Querying Links

### Forward Links

What does a resource reference?

```javascript
await bl.get('bl:///links/from/cells/counter')
// → {
//   headers: { type: 'bl:///types/link-set' },
//   body: {
//     source: 'bl:///cells/counter',
//     direction: 'from',
//     refs: ['bl:///types/cell']
//   }
// }
```

### Backlinks

What references a resource?

```javascript
await bl.get('bl:///links/to/types/cell')
// → {
//   headers: { type: 'bl:///types/link-set' },
//   body: {
//     target: 'bl:///types/cell',
//     direction: 'to',
//     refs: ['bl:///cells/counter', 'bl:///cells/score', ...]
//   }
// }
```

### List All Sources/Targets

```javascript
// All resources with outgoing refs
await bl.get('bl:///links/from')
// → { body: { entries: [{ uri: 'bl:///cells/counter', refCount: 2 }, ...] } }

// All resources with incoming refs
await bl.get('bl:///links/to')
// → { body: { entries: [{ uri: 'bl:///types/cell', refCount: 15 }, ...] } }
```

### Pattern Query

Query with regex patterns in headers:

```javascript
// Find all links from cells to types
await bl.get('bl:///links/query', {
  from: '^bl:///cells/.*',
  to: '^bl:///types/.*',
})
// → {
//   body: {
//     links: [
//       { from: 'bl:///cells/counter', to: 'bl:///types/cell' },
//       { from: 'bl:///cells/score', to: 'bl:///types/cell' },
//       ...
//     ],
//     count: 42
//   }
// }
```

## Automatic Indexing

Links are automatically indexed on every PUT. The indexer scans for:

1. **String URIs** - Any string starting with `bl://`
2. **$ref Markers** - Objects with a `$ref` property

```javascript
// All of these create indexed links:
await bl.put(
  'bl:///widgets/button',
  {},
  {
    type: 'bl:///types/widget', // String URI
    handler: { $ref: 'bl:///fn/onClick' }, // $ref marker
    styles: 'bl:///themes/default/button', // String URI
  }
)

// Query forward refs
await bl.get('bl:///links/from/widgets/button')
// → refs: ['bl:///types/widget', 'bl:///fn/onClick', 'bl:///themes/default/button']

// Query backlinks
await bl.get('bl:///links/to/types/widget')
// → refs: ['bl:///widgets/button', ...]
```

## Use Cases

### Find All Views for a Type

```javascript
// Views link to types via their 'for' field
await bl.get('bl:///links/to/types/cell')
// Returns all views registered for cells
```

### Find What Uses a Function

```javascript
// Find propagators using a specific fn
await bl.get('bl:///links/to/fn/sum')
// Returns all propagators referencing bl:///fn/sum
```

### Dependency Graph

```javascript
// Build a dependency graph
const from = await bl.get('bl:///links/from')
const graph = {}
for (const entry of from.body.entries) {
  const refs = await bl.get(`bl:///links/from/${entry.uri.slice(6)}`)
  graph[entry.uri] = refs.body.refs
}
```

## API

### collectRefs

Extract all refs from a value:

```javascript
import { collectRefs } from '@bassline/links'

const refs = collectRefs({
  type: 'bl:///types/cell',
  nested: {
    handler: { $ref: 'bl:///fn/sum' },
  },
  list: ['bl:///cells/a', 'bl:///cells/b'],
})
// → ['bl:///types/cell', 'bl:///fn/sum', 'bl:///cells/a', 'bl:///cells/b']
```

### createLinkIndex

Create a link index programmatically:

```javascript
import { createLinkIndex } from '@bassline/links'

const links = createLinkIndex()

// Install routes and tap
links.install(bl)

// Manual indexing
links.index('bl:///my/resource', { ref: 'bl:///types/foo' })

// Query programmatically
links.getFrom('bl:///my/resource') // → ['bl:///types/foo']
links.getTo('bl:///types/foo') // → ['bl:///my/resource']

// Remove all links for a resource
links.remove('bl:///my/resource')
```

## Plumber Integration

Links sets up a plumber rule to clean up refs when resources are removed:

```javascript
// When resource-removed fires, links are cleaned up
bl._plumber.addRule('links-cleanup', {
  match: { port: 'resource-removed' },
  to: 'bl:///links/on-resource-removed',
})
```

## Exports

```javascript
export { createLinkIndex, collectRefs } from './links.js'
export { default as installLinks } from './upgrade.js'
```
