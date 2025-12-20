# Bassline Patterns

Guidelines for building under the resource model.

## Core Principles: The Narrow Waist

The resource model is a **common narrow waist** - a uniform interface
abstraction for communicating with anything.

### The Interface

```
URI  →  names things
get  →  read a resource
put  →  write to a resource
{ headers, body }  →  response shape
```

Every resource follows this pattern:

```javascript
// Reading
const response = await bl.get('bl:///cells/counter')
// → { headers: { type: 'bl:///types/cell' }, body: { value: 42 } }

// Writing
await bl.put('bl:///cells/counter/value', {}, 10)
// → { headers: { type: 'bl:///types/cell-value', changed: true }, body: 10 }
```

### Self-Describing via Type Headers

`headers.type` is a URI pointing to a type resource:

```javascript
{
  headers: { type: 'bl:///types/cell' },
  body: { lattice: 'maxNumber', value: 42 }
}
```

You can dereference `bl:///types/cell` to learn about cells.

### Directory Listings

Resources that contain other resources return an `entries` array:

```javascript
// GET bl:///cells
{
  headers: { type: 'bl:///types/directory' },
  body: {
    entries: [
      { name: 'counter', type: 'cell', uri: 'bl:///cells/counter' },
      { name: 'total', type: 'cell', uri: 'bl:///cells/total' }
    ]
  }
}
```

### Bidirectional Links

Resources reference each other via URIs. The link index tracks refs in both
directions:

```javascript
// Forward: what does this reference?
await bl.get('bl:///links/from/cells/counter')

// Backward: what references this?
await bl.get('bl:///links/to/types/cell')
```

## Implementation Layer: Runtime Resolution

Below the resource abstraction, the Bassline instance serves as a **runtime
object resolver** for things that can't be communicated through the resource
interface.

### The `bl._moduleName` Pattern

Modules register themselves on the Bassline instance:

```javascript
// In upgrade.js
export default function installCells(bl, config = {}) {
  const cells = createCellRoutes({ ... })
  cells.install(bl)
  bl._cells = cells  // Register for runtime resolution
}
```

Other modules find them via late-binding:

```javascript
// In another module
bl._propagators?.onCellChange(uri)
bl._handlers.get('sum')
bl._plumber.dispatch(message)
```

### When to Use Each Layer

| Need                | Use                      |
| ------------------- | ------------------------ |
| Store/retrieve data | `bl.get()` / `bl.put()`  |
| Call a function     | `bl._module.method()`    |
| Get a handler       | `bl._handlers.get(name)` |
| Reference in data   | URI string               |

The distinction is **abstraction layer** (resource model for communication) vs
**implementation layer** (runtime resolution for actual objects).

## Route Patterns

### `resource()` vs `routes()`

Use `resource()` for **mountable, location-agnostic** routes:

```javascript
const cellResource = resource((r) => {
  r.get('/', () => ({ headers: {}, body: listCells() }))
  r.get('/:name', ({ params }) => ({ headers: {}, body: getCell(params.name) }))
})

// Mount anywhere
bl.mount('/cells', cellResource)
bl.mount('/v2/cells', cellResource)
bl.mount('/ns/:ns/cells', cellResource) // Inherits params.ns
```

Use `routes()` for **fixed-prefix hierarchies**:

```javascript
const cellRoutes = routes('/cells/:name', (r) => {
  r.get('/', ({ params }) => ({ ... }))
  r.get('/value', ({ params }) => ({ ... }))
})

bl.install(cellRoutes)  // Always at /cells/:name
```

### Scope for Nested Routes

`scope()` creates hierarchical routes with parameter inheritance:

```javascript
const cellResource = resource((r) => {
  r.get('/', () => ({ ... }))

  r.scope('/:name', (r) => {
    // params.name available here
    r.get('/', ({ params }) => getCell(params.name))
    r.get('/value', ({ params }) => getValue(params.name))
    r.put('/value', ({ params, body }) => setValue(params.name, body))
  })
})
```

### Response Conventions

```javascript
// Found
return { headers: { type: 'bl:///types/...' }, body: data }

// Not found
return null

// Created/updated with metadata
return { headers: { type: '...', changed: true }, body: result }
```

## Module Patterns

### Factory + Install Pattern

Modules are factory functions returning an object with `.install()`:

```javascript
export function createCellRoutes(options = {}) {
  const { onCellChange, onCellKill } = options

  // Private state
  const store = new Map()

  // Private functions
  function getCell(name) { return store.get(name) }
  function createCell(name, config) { ... }

  // Public routes
  const cellResource = resource((r) => {
    r.get('/', () => ({ ... }))
    r.get('/:name', ({ params }) => ({ ... }))
  })

  // Install function
  function install(bl, { prefix = '/cells' } = {}) {
    bl.mount(prefix, cellResource)
  }

  // Return public API
  return {
    routes: cellResource,
    install,
    getCell,
    createCell,
    listCells: () => [...store.keys()],
    _store: store,  // For testing
  }
}
```

### Upgrade Files

Each package has an `upgrade.js` that wires into Bassline:

```javascript
// packages/cells/src/upgrade.js
export default function installCells(bl, config = {}) {
  const cells = createCellRoutes({
    onCellChange: ({ uri }) => {
      bl._propagators?.onCellChange(uri)
    },
    onCellKill: ({ uri }) => {
      bl._plumber?.dispatch({
        uri,
        headers: { type: 'bl:///types/resource-removed' },
        body: { uri },
      })
    },
  })

  cells.install(bl)
  bl._cells = cells
}
```

### Module Registration

Convention: `bl._moduleName` for runtime discovery:

```javascript
bl._cells = cells
bl._propagators = propagators
bl._handlers = handlers
bl._plumber = plumber
bl._links = links
```

## State & Reactivity Patterns

### Lattice Semantics

Cells use lattices for monotonic state. Values only move "up":

```javascript
// Lattice interface
{
  bottom: () => initialValue,
  join: (a, b) => combinedValue,  // Commutative, associative
  lte: (a, b) => boolean,         // Partial order
}

// Usage
const lattice = getLattice('maxNumber')
const result = lattice.join(oldValue, newValue)
const changed = !lattice.lte(result, oldValue)
```

Built-in lattices: `maxNumber`, `minNumber`, `setUnion`, `setIntersection`,
`lww`, `object`, `counter`, `boolean`.

### Callback Wiring

Modules emit events via callbacks passed at construction:

```javascript
const cells = createCellRoutes({
  onCellChange: ({ uri, cell }) => { ... },
  onCellKill: ({ uri }) => { ... },
  onContradiction: ({ uri, previousValue, incomingValue }) => { ... },
})
```

Use optional chaining for loose coupling:

```javascript
onCellChange: ({ uri }) => {
  bl._propagators?.onCellChange(uri) // Safe if not installed
}
```

### Plumber Integration

The plumber routes messages by pattern matching:

```javascript
// Add a rule
bl._plumber.addRule('cell-changes', {
  match: { headers: { type: 'bl:///types/cell-value', changed: true } },
  port: 'cell-updates',
})

// Listen to a port
bl._plumber.listen('cell-updates', (msg) => {
  console.log('Cell changed:', msg.uri)
})

// Dispatch a message
bl._plumber.dispatch({
  uri: 'bl:///cells/counter',
  headers: { type: 'bl:///types/cell-value' },
  body: 42,
})
```

### Propagator Pattern

Propagators watch cells and fire on change:

```javascript
// Create propagator
await bl.put(
  'bl:///propagators/sum',
  {},
  {
    inputs: ['bl:///cells/a', 'bl:///cells/b'],
    output: 'bl:///cells/total',
    handler: 'sum',
  }
)

// Flow: cell changes → onCellChange → propagator fires → output cell updates
```

## Error Handling

### Routes Return Null for Not Found

```javascript
r.get('/:name', ({ params }) => {
  const cell = getCell(params.name)
  if (!cell) return null  // 404
  return { headers: { ... }, body: cell }
})
```

### Internal Functions Throw

```javascript
function createCell(name, config) {
  const lattice = getLattice(config.lattice)
  if (!lattice) {
    throw new Error(`Unknown lattice: ${config.lattice}`)
  }
  // ...
}
```

### Contradictions

Lattices can detect contradictions (incompatible values):

```javascript
// In lattice
if (result.length === 0 && a.length > 0 && b.length > 0) {
  throw new Contradiction(a, b)
}

// Handled via callback
onContradiction: ({ uri, previousValue, incomingValue, result }) => {
  bl._plumber?.dispatch({
    uri,
    headers: { type: 'bl:///types/contradiction' },
    body: { previousValue, incomingValue, result },
  })
}
```

## Anti-Patterns to Avoid

### Inconsistent Naming

Bad:

```javascript
deleteMonitor(name) // Some modules
killCell(name) // Other modules
removeHandler(name) // Yet others
```

Good - use `kill` consistently:

```javascript
killCell(name)
killPropagator(name)
killMonitor(name)
```

### Non-URI Type Headers

Bad:

```javascript
{
  headers: {
    type: 'directory'
  }
}
{
  headers: {
    type: 'cell'
  }
}
```

Good - always use full URIs:

```javascript
{
  headers: {
    type: 'bl:///types/directory'
  }
}
{
  headers: {
    type: 'bl:///types/cell'
  }
}
```

### Bypassing the Resource Model for Data

Bad - directly accessing stores for data:

```javascript
const value = cells._store.get(name).value
```

Good - go through the resource interface:

```javascript
const result = await bl.get(`bl:///cells/${name}/value`)
const value = result.body
```

(Note: `bl._module.method()` is fine for runtime objects like functions)
