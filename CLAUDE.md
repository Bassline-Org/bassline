# Bassline

A programming environment where everything is a resource.

## Critical Design Rule

**THE KIT RULE**: Resources are isolated. They can only access:

1. **Down** - Things below them via their own routes
2. **Out** - Everything else via `h.kit` (passed in headers)

**NEVER** use direct JavaScript API calls to reach other parts of the system.

```javascript
// BAD - direct JS API access
cells.create('activity', { lattice: 'setUnion' })
plumber.addRule('log-all', { match: {}, to: activity })

// GOOD - via kit
await h.kit.put({ path: '/cells/activity' }, { lattice: 'setUnion' })
await h.kit.put({ path: '/plumber/rules/log-all' }, { match: {}, to: '/cells/activity' })
```

Kit is a superpower because it's a resource with an `unknown` handler, enabling:
- Lazy loading modules on first access
- Dynamic routing based on capability/context
- Transparent proxying to remote resources
- Logging/auditing all external access
- Capability gating on trust/permissions

The caller controls what world the resource sees.

## Core Primitives

~35 lines total in `packages/core/src/resource.js`:

```javascript
const notFound = async () => ({ headers: { status: 404 }, body: null })

const resource = ({ get = notFound, put = notFound } = {}) => ({ get, put })

const splitPath = path => {
  const [segment, ...rest] = (path ?? '/').split('/').filter(Boolean)
  return [segment, rest.length ? '/' + rest.join('/') : '/']
}

function routes(map) {
  const dispatch = async (method, headers, body) => {
    const [segment, remaining] = splitPath(headers.path)
    const target = map[segment] ?? map.unknown
    if (!target) return notFound()
    return target[method]?.({ ...headers, path: remaining, segment }, body) ?? notFound()
  }

  return resource({
    get: h => dispatch('get', h),
    put: (h, b) => dispatch('put', h, b),
  })
}

const bind = (name, target) => {
  const next = h => {
    const [segment, remaining] = splitPath(h.path)
    return { ...h, path: remaining, params: { ...h.params, [name]: segment } }
  }
  return resource({
    get: h => target.get(next(h)),
    put: (h, b) => target.put(next(h), b),
  })
}

export { resource, routes, bind, splitPath }
```

## Resource Interface

Every resource has the same interface:

```javascript
{
  get: async (headers) => ({ headers, body }),
  put: async (headers, body) => ({ headers, body })
}
```

- `headers.path` - remaining path to route
- `headers.params` - accumulated path parameters (from `bind`)
- `headers.kit` - resource for accessing the outside world
- Response always returns `{ headers, body }`

## Resource Kinds

Patterns for thinking about resources based on their behavior:

### Cell
Lattice-based accumulation. Values merge monotonically (only go "up").
```javascript
await kit.put({ path: '/cells/counter' }, { lattice: 'maxNumber' })
await kit.put({ path: '/cells/counter/value' }, 5)
await kit.put({ path: '/cells/counter/value' }, 3)  // still 5, max wins
```

### Propagator
Reactive computation between cells. When inputs change, recomputes and writes output.
```javascript
await kit.put({ path: '/propagators/sum' }, {
  inputs: ['/cells/a', '/cells/b'],
  output: '/cells/total',
  fn: '/fn/sum'
})
```

### Oracle
Read-only, answers questions. Databases, function registries, type definitions.
```javascript
const result = await kit.get({ path: '/fn/sum' })        // function lookup
const rows = await kit.get({ path: '/db/users?id=123' }) // query
```

### Scout
Autonomous discovery. Finds things and reports via kit.
```javascript
// A scout that polls a URL and reports changes
await kit.put({ path: '/scouts/github-status' }, {
  url: 'https://api.github.com/status',
  interval: 60000,
  reportTo: '/cells/github-status'
})
```

## Basslines

A bassline is a compound resource that describes and routes to other resources - like a directory or namespace.

Basslines are decoupled from the resources they expose. They can:
- Wire resources together via kit (not direct references)
- Be defined separately from the resources they describe
- Be generated or configured dynamically

```javascript
// A bassline that routes via kit - completely decoupled
const createBassline = (resourcePaths) => routes({
  '': resource({
    get: async () => ({
      headers: { type: '/types/bassline' },
      body: { resources: resourcePaths }
    })
  }),
  unknown: resource({
    get: async (h) => h.kit.get({ path: '/' + h.segment + h.path }),
    put: async (h, b) => h.kit.put({ path: '/' + h.segment + h.path }, b),
  })
})

// The bassline delegates to kit - caller controls what world it sees
const app = createBassline({
  '/cells': { description: 'Lattice-based cells' },
  '/propagators': { description: 'Reactive computation' },
})
```

## Building Resources

```javascript
// Simple resource
const counter = resource({
  get: async () => ({ headers: {}, body: count }),
  put: async (h, b) => ({ headers: {}, body: (count += b) }),
})

// Routing to sub-resources
const app = routes({
  cells: cellsResource,
  propagators: propagatorsResource,
  users: bind('id', userResource),  // captures :id param
  unknown: fallbackResource,         // handles unmatched paths
})

// Using kit for external access
const worker = resource({
  put: async (h, task) => {
    // Access external resources via kit
    const config = await h.kit.get({ path: '/config' })
    const result = doWork(task, config.body)
    await h.kit.put({ path: '/results' }, result)
    return { headers: {}, body: { done: true } }
  }
})
```

## Package Structure (Target)

```
packages/core/           # Resource primitives + consolidated runtime
packages/database/       # SQLite (heavy optional dependency)
packages/node/           # Node.js platform (file store, HTTP/WS server)
packages/remote/         # Browser WebSocket client
packages/react/          # React bindings

apps/cli/                # Daemon, MCP server
apps/editor/             # Web editor
```

## Running

```bash
pnpm install
pnpm test
pnpm dev  # Start daemon on port 9111
```

## License

AGPLv3
