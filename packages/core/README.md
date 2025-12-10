# @bassline/core

URI router and utilities for Bassline.

## Install

```bash
pnpm add @bassline/core
```

## Usage

```javascript
import { Bassline, routes } from '@bassline/core'

const bl = new Bassline()

// Define routes
bl.route('/users/:id', {
  get: ({ params }) => ({
    headers: { type: 'bl:///types/user' },
    body: { id: params.id, name: 'Alice' }
  }),
  put: ({ params, body }) => {
    // store.set(params.id, body)
    return { headers: {}, body }
  }
})

// Use resources
const user = await bl.get('bl:///users/123')
await bl.put('bl:///users/123', {}, { name: 'Bob' })
```

## Exports

### Bassline

Pattern-matching URI router.

```javascript
const bl = new Bassline()
bl.route(pattern, handlers)
bl.install(routerBuilder)
await bl.get(uri)
await bl.put(uri, headers, body)
```

### routes

Builder for hierarchical route definitions.

```javascript
const userRoutes = routes('/users', r => {
  r.get('/', () => ({ body: users }))
  r.get('/:id', ({ params }) => ({ body: users[params.id] }))
  r.put('/:id', ({ params, body }) => { users[params.id] = body })
})

bl.install(userRoutes)
```

### createLinkIndex

Bidirectional link tracking.

```javascript
import { createLinkIndex } from '@bassline/core'

const links = createLinkIndex()
links.install(bl)

// Index refs
links.index('bl:///doc/1', { refs: ['bl:///doc/2'] })

// Query
await bl.get('bl:///links/from/doc/1')  // what does doc/1 reference?
await bl.get('bl:///links/to/doc/2')    // what references doc/2?
```

### createPlumber

Message routing based on pattern rules.

```javascript
import { createPlumber } from '@bassline/core'

const plumber = createPlumber()
plumber.install(bl)

// Add routing rule
plumber.addRule('cells', {
  match: { headers: { type: 'bl:///types/cell' } },
  port: 'cell-updates'
})

// Listen on port
plumber.listen('cell-updates', (msg) => {
  console.log('Cell changed:', msg)
})
```

## Related

- [@bassline/cells](../cells) - Lattice-based cells
- [@bassline/propagators](../propagators) - Reactive propagators
- [@bassline/store-node](../store-node) - File and code stores
- [@bassline/server-node](../server-node) - HTTP and WebSocket servers
