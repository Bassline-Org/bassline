---
name: bassline
description: Work with Bassline: a programming environment for reflexive distributed systems. Use Bassline when you want to make p2p connections with a simple API, build propagation networks, use a TCL with state serialization or manage agents in distributed settings.
license: AGPL-3.0
compatibility: Requires @bassline packages installed in the project
---

# Bassline

Everything in Bassline is a **resource** with two operations:

```javascript
await resource.get(headers) // → { headers, body }
await resource.put(headers, body) // → { headers, body }
```

## Working with URIs

Access any resource by path:

```javascript
// Read a value
const result = await resource.get({ path: '/cells/counter/value' })
// { headers: { type: '/types/cell-value' }, body: 42 }

// Write a value
const result = await resource.put({ path: '/store/config' }, { theme: 'dark' })
// { headers: {}, body: { theme: 'dark' } }
```

Paths route segment by segment:

- `/cells/counter/value` → `cells` → `counter` → `value`
- `/store/users/alice` → `store` → `users` → `alice`

## Response Format

Every operation returns `{ headers, body }`:

```javascript
// Success
{ headers: {}, body: { name: 'Alice' } }
{ headers: { type: '/types/cell' }, body: { lattice: 'maxNumber', value: 5 } }

// Errors - check headers.condition
{ headers: { condition: 'not-found' }, body: null }
{ headers: { condition: 'error', message: 'Something went wrong' }, body: null }
```

Always check for conditions:

```javascript
const result = await kit.get({ path: '/cells/counter/value' })

if (result.headers.condition === 'not-found') {
  // Resource doesn't exist
}
if (result.headers.condition === 'error') {
  console.error(result.headers.message)
}
```

## The Kit Rule

Resources are isolated - they access everything through `h.kit`:

```javascript
const worker = resource({
  put: async (h, task) => {
    // Read config via kit
    const { body: config } = await h.kit.get({ path: '/config' })

    // Write results via kit
    await h.kit.put({ path: '/results/latest' }, result)

    return { headers: {}, body: { done: true } }
  },
})
```

**Why kit?** The caller controls what world the resource sees. Same resource, but different kit = different capabilities.

## Creating Resources

### Basic Resource

```javascript
import { resource } from '@bassline/core'

let count = 0

const counter = resource({
  get: async h => ({ headers: {}, body: count }),
  put: async (h, b) => {
    count = b
    return { headers: {}, body: count }
  },
})
```

### Routing by Path

```javascript
import { routes } from '@bassline/core'

const app = routes({
  cells: cellsResource,
  store: storeResource,
  fn: fnResource,
  unknown: fallbackResource, // catches unmatched paths
})
```

### Capturing Path Parameters

```javascript
import { bind } from '@bassline/core'

// Captures segment into h.params.id
const users = bind(
  'id',
  resource({
    get: async h => {
      const userId = h.params.id // 'alice' from '/alice/profile'
      // ...
    },
  })
)
```

## Quick Reference

| Resource | Create | Read | Write |
| --- | --- | --- | --- |
| Cell | `PUT /cells/name` `{ lattice: 'maxNumber' }` | `GET /cells/name/value` | `PUT /cells/name/value` `<value>` |
| Store | (auto-created) | `GET /store/path/to/key` | `PUT /store/path/to/key` `<value>` |
| Propagator | `PUT /propagators/name` `{ inputs, output, fn }` | `GET /propagators/name` | `PUT /propagators/name/run` |
| Function | `PUT /fn/name` `<function>` | `GET /fn/name` | - |

## Packages

Bassline is split into focused packages. See the reference files for detailed usage:

| Package              | Purpose                                          | Reference     |
| -------------------- | ------------------------------------------------ | ------------- |
| `@bassline/core`     | Resources, types, stores, propagators, functions | `core.md`     |
| `@bassline/blit`     | SQLite-backed persistent applications            | `blit.md`     |
| `@bassline/tcl`      | TCL scripting for boot scripts and automation    | `tcl.md`      |
| `@bassline/database` | SQLite database connections and queries          | `database.md` |
| `@bassline/services` | Claude API integration and agentic loops         | `services.md` |
| `@bassline/trust`    | Trust computation and capability gating          | `trust.md`    |

### When to Use Each

- **Building state that merges** → cells with lattices (`core.md`)
- **Storing key/value data** → store (`core.md`)
- **Reactive computation** → propagators (`core.md`)
- **Persisting an application** → blits (`blit.md`)
- **Writing boot/init scripts** → TCL (`tcl.md`)
- **Direct SQL access** → database (`database.md`)
- **LLM-powered features** → services (`services.md`)
- **Peer trust/capabilities** → trust (`trust.md`)

---
name: bassline
description: Work with Bassline - a programming environment where everything is a resource. Create resources with get/put, use cells for state, stores for data, blits for persistence, TCL for scripting, and integrate with Claude for agentic workflows.
license: AGPL-3.0
compatibility: Requires @bassline packages installed in the project
---

# Bassline

Everything in Bassline is a **resource** with two operations:

```javascript
await resource.get(headers) // → { headers, body }
await resource.put(headers, body) // → { headers, body }
```

## Working with URIs

Access any resource by path:

```javascript
// Read a value
const result = await resource.get({ path: '/cells/counter/value' })
// { headers: { type: '/types/cell-value' }, body: 42 }

// Write a value
const result = await resource.put({ path: '/store/config' }, { theme: 'dark' })
// { headers: {}, body: { theme: 'dark' } }
```

Paths route segment by segment:

- `/cells/counter/value` → `cells` → `counter` → `value`
- `/store/users/alice` → `store` → `users` → `alice`

## Response Format

Every operation returns `{ headers, body }`:

```javascript
// Success
{ headers: {}, body: { name: 'Alice' } }
{ headers: { type: '/types/cell' }, body: { lattice: 'maxNumber', value: 5 } }

// Errors - check headers.condition
{ headers: { condition: 'not-found' }, body: null }
{ headers: { condition: 'error', message: 'Something went wrong' }, body: null }
```

Always check for conditions:

```javascript
const result = await kit.get({ path: '/cells/counter/value' })

if (result.headers.condition === 'not-found') {
  // Resource doesn't exist
}
if (result.headers.condition === 'error') {
  console.error(result.headers.message)
}
```

## The Kit Rule

Resources are isolated - they access everything through `h.kit`:

```javascript
const worker = resource({
  put: async (h, task) => {
    // Read config via kit
    const { body: config } = await h.kit.get({ path: '/config' })

    // Write results via kit
    await h.kit.put({ path: '/results/latest' }, result)

    return { headers: {}, body: { done: true } }
  },
})
```

**Why kit?** The caller controls what world the resource sees. Same resource, different kit = different capabilities.

## Creating Resources

### Basic Resource

```javascript
import { resource } from '@bassline/core'

let count = 0

const counter = resource({
  get: async h => ({ headers: {}, body: count }),
  put: async (h, b) => {
    count = b
    return { headers: {}, body: count }
  },
})
```

### Routing by Path

```javascript
import { routes } from '@bassline/core'

const app = routes({
  cells: cellsResource,
  store: storeResource,
  fn: fnResource,
  unknown: fallbackResource, // catches unmatched paths
})
```

### Capturing Path Parameters

```javascript
import { bind } from '@bassline/core'

// Captures segment into h.params.id
const users = bind(
  'id',
  resource({
    get: async h => {
      const userId = h.params.id // 'alice' from '/alice/profile'
      // ...
    },
  })
)
```

## Quick Reference

| Resource | Create | Read | Write |
| --- | --- | --- | --- |
| Cell | `PUT /cells/name` `{ lattice: 'maxNumber' }` | `GET /cells/name/value` | `PUT /cells/name/value` `<value>` |
| Store | (auto-created) | `GET /store/path/to/key` | `PUT /store/path/to/key` `<value>` |
| Propagator | `PUT /propagators/name` `{ inputs, output, fn }` | `GET /propagators/name` | `PUT /propagators/name/run` |
| Function | `PUT /fn/name` `<function>` | `GET /fn/name` | - |

## Packages

Bassline is split into focused packages. See the reference files for detailed usage:

| Package              | Purpose                                          | Reference     |
| -------------------- | ------------------------------------------------ | ------------- |
| `@bassline/core`     | Resources, cells, stores, propagators, functions | `core.md`     |
| `@bassline/blit`     | SQLite-backed persistent applications            | `blit.md`     |
| `@bassline/tcl`      | TCL scripting for boot scripts and automation    | `tcl.md`      |
| `@bassline/database` | SQLite database connections and queries          | `database.md` |
| `@bassline/services` | Claude API integration and agentic loops         | `services.md` |
| `@bassline/trust`    | Trust computation and capability gating          | `trust.md`    |

### When to Use Each

- **Building state that merges** → cells with lattices (`core.md`)
- **Storing key/value data** → store (`core.md`)
- **Reactive computation** → propagators (`core.md`)
- **Persisting an application** → blits (`blit.md`)
- **Writing boot/init scripts** → TCL (`tcl.md`)
- **Direct SQL access** → database (`database.md`)
- **LLM-powered features** → services (`services.md`)
- **Peer trust/capabilities** → trust (`trust.md`)
