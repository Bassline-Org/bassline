# @bassline/core

Resource primitives and utilities for Bassline.

## Install

```bash
pnpm add @bassline/core
```

## Core Primitives

```javascript
import { resource, routes, bind } from '@bassline/core'

// A resource has get and put
const counter = resource({
  get: async h => ({ headers: {}, body: count }),
  put: async (h, body) => ({ headers: {}, body: (count += body) }),
})

// Routes dispatch by path segment
const app = routes({
  counter,
  users: bind('id', userResource), // captures :id param
  unknown: fallbackResource, // handles unmatched paths
})

// Use it
const result = await app.get({ path: '/counter' })
await app.put({ path: '/users/alice' }, { name: 'Alice' })
```

## Exports

### Resource Primitives

```javascript
import { resource, routes, bind, splitPath, notFound } from '@bassline/core'

// Create a resource
const myResource = resource({
  get: async headers => ({ headers: {}, body: 'hello' }),
  put: async (headers, body) => ({ headers: {}, body }),
})

// Compose with routing
const app = routes({
  '': myResource, // handles root path
  items: itemsResource, // handles /items/*
  unknown: fallbackResource, // handles unmatched
})

// Bind path parameters
const userRoutes = bind(
  'id',
  resource({
    get: async h => ({ headers: {}, body: { id: h.params.id } }),
  })
)
```

### Cells

Lattice-based state that merges monotonically.

```javascript
import { createCells, lattices } from '@bassline/core'

const cells = createCells()

// Create a cell with maxNumber lattice
await cells.put({ path: '/counter' }, { lattice: 'maxNumber' })

// Set value - merges with lattice
await cells.put({ path: '/counter/value' }, 5)
await cells.put({ path: '/counter/value' }, 3) // still 5, max wins

const result = await cells.get({ path: '/counter/value' })
// → { headers: {}, body: 5 }
```

Available lattices: `maxNumber`, `minNumber`, `setUnion`, `lww` (last-writer-wins)

### Propagators

Reactive computation between cells.

```javascript
import { createPropagators } from '@bassline/core'

const propagators = createPropagators()

// Create a propagator that sums two cells
await propagators.put(
  { path: '/sum', kit },
  {
    inputs: ['/cells/a', '/cells/b'],
    output: '/cells/total',
    fn: '/fn/sum',
  }
)

// When /cells/a or /cells/b change, /cells/total is recomputed
```

### Plumber

Message routing based on pattern matching.

```javascript
import { createPlumber } from '@bassline/core'

const plumber = createPlumber()

// Add a routing rule
await plumber.put(
  { path: '/rules/log-errors' },
  {
    match: { headers: { level: 'error' } },
    to: '/cells/errors',
  }
)

// Send a message
await plumber.put({ path: '/send', kit }, { level: 'error', msg: 'Oops' })
// Message routed to /cells/errors via kit
```

### Functions

Registry for named functions.

```javascript
import { createFn, builtins } from '@bassline/core'

const fn = createFn()

// Register a function
await fn.put({ path: '/double' }, { fn: x => x * 2 })

// Get and call
const result = await fn.get({ path: '/double' })
result.body.fn(21) // → 42

// Builtins available: sum, product, max, min, count, first, last, identity
```

### Timers

Time-based events.

```javascript
import { createTimers } from '@bassline/core'

const timers = createTimers()

// Create a timer that fires every second
await timers.put(
  { path: '/heartbeat', kit },
  {
    interval: 1000,
    to: '/cells/heartbeat',
  }
)

// Stop a timer
await timers.put({ path: '/heartbeat/stop' }, {})
```

### Memory Store

In-memory key-value storage with directory semantics.

```javascript
import { createMemoryStore } from '@bassline/core'

const store = createMemoryStore({ initial: 'data' })

await store.put({ path: '/users/alice' }, { name: 'Alice' })
const user = await store.get({ path: '/users/alice' })
// → { headers: {}, body: { name: 'Alice' } }

// Directory listing
const users = await store.get({ path: '/users' })
// → { headers: { type: 'directory' }, body: ['alice'] }
```

## The Kit Pattern

Resources access the outside world through `h.kit`:

```javascript
const worker = resource({
  put: async (h, task) => {
    // Access external resources via kit
    const config = await h.kit.get({ path: '/config' })
    await h.kit.put({ path: '/results' }, processTask(task, config.body))
    return { headers: {}, body: { done: true } }
  },
})
```

Kit is just a resource passed in headers. The caller controls what it routes to.

## Related

- [@bassline/node](../node) - HTTP/WebSocket servers, file store
- [@bassline/remote](../remote) - WebSocket client
- [@bassline/database](../database) - SQLite
- [@bassline/trust](../trust) - Capability-based trust
