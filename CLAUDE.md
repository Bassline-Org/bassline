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
    body: { value: store.get(params.name) },
  }),
  put: ({ params, body }) => {
    store.set(params.name, body)
    return { headers: { type: 'bl:///types/cell' }, body }
  },
})
```

Handlers receive context: `{ params, query, headers, body, bl }`

### Route Patterns

```javascript
'/users/:id' // Single segment parameter
'/files/:path*' // Wildcard (matches rest of path)
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
await bl.get('bl:///data') // list directory
```

### Code Store

Load JS modules into the system:

```javascript
import { createCodeStore } from '@bassline/store-node'

bl.install(createCodeStore(null, '/code'))

await bl.put('bl:///code/math', {}, { path: './math.js' })
const mod = await bl.get('bl:///code/math')
mod.body.add(1, 2) // invoke exports
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
await bl.put('bl:///cells/counter/value', {}, 3) // still 5, max wins
await bl.put('bl:///cells/counter/value', {}, 10) // now 10
```

Built-in lattices:

- `maxNumber` - values only go up
- `minNumber` - values only go down
- `setUnion` - accumulates set elements
- `setIntersection` - constrains to common elements (empty = contradiction)
- `lww` - last-writer-wins by timestamp
- `object` - shallow merge objects
- `counter` - increment-only (adds values)
- `boolean` - once true, stays true

## Propagators

Propagators connect cells. When inputs change, they compute and write to outputs.

```javascript
import { createPropagatorRoutes } from '@bassline/propagators'

const propagators = createPropagatorRoutes({ bl })
propagators.install(bl)

// Create a sum propagator: a + b → sum
await bl.put(
  'bl:///propagators/add',
  {},
  {
    inputs: ['bl:///cells/a', 'bl:///cells/b'],
    output: 'bl:///cells/sum',
    fn: 'bl:///fn/sum',
  }
)
```

Functions are provided by `@bassline/fn` (110 built-in). See [packages/fn/README.md](packages/fn/README.md) for the full list.

Common functions:

- **Reducers**: `sum`, `product`, `min`, `max`, `average`
- **Structural**: `pair`, `zip`, `unzip`, `pick`
- **Transformers**: `map`, `format`, `coerce`
- **Predicates**: `filter`, `when`, `ifElse`, `cond`
- **Combinators**: `pipe`, `fork`, `hook`, `converge`

Example with config:

```javascript
// Apply a fn to each element of a collection
await bl.put(
  'bl:///propagators/coerce-all',
  {},
  {
    inputs: ['bl:///cells/strings'],
    output: 'bl:///cells/numbers',
    fn: 'bl:///fn/map',
    fnConfig: { fn: 'bl:///fn/coerce', fnConfig: { to: 'number' } },
  }
)

// Structural: combine two cells into object
await bl.put(
  'bl:///propagators/combine',
  {},
  {
    inputs: ['bl:///cells/x', 'bl:///cells/y'],
    output: 'bl:///cells/point',
    fn: 'bl:///fn/zip',
    fnConfig: { keys: ['x', 'y'] },
  }
)

// Conditional: filter values greater than 0
await bl.put(
  'bl:///propagators/positive-only',
  {},
  {
    inputs: ['bl:///cells/value'],
    output: 'bl:///cells/positive',
    fn: 'bl:///fn/filter',
    fnConfig: { fn: 'bl:///fn/gt', fnConfig: { value: 0 } },
  }
)

// String: replace pattern with regex
await bl.put(
  'bl:///propagators/clean',
  {},
  {
    inputs: ['bl:///cells/raw'],
    output: 'bl:///cells/clean',
    fn: 'bl:///fn/replace',
    fnConfig: { pattern: '\\s+', flags: 'g', replacement: ' ' },
  }
)

// Array reducer: group by key
await bl.put(
  'bl:///propagators/by-category',
  {},
  {
    inputs: ['bl:///cells/items'],
    output: 'bl:///cells/grouped',
    fn: 'bl:///fn/groupBy',
    fnConfig: { key: 'category' },
  }
)

// Working with LWW cells: compose to extract inner value first
// LWW stores {value, timestamp}, so use pick/get to unwrap
await bl.put(
  'bl:///propagators/negate-lww',
  {},
  {
    inputs: ['bl:///cells/num'],
    output: 'bl:///cells/negated',
    fn: 'bl:///fn/compose',
    fnConfig: {
      steps: ['bl:///fn/pick', 'bl:///fn/negate'],
      'bl:///fn/pick': { key: 'value' },
    },
  }
)
```

## Plumber

The plumber is a rule-based message router. It watches PUT operations and dispatches messages to named ports based on pattern matching.

### How it works

1. Routes install a "tap" on PUT operations
2. When a PUT completes, the response is wrapped in a message: `{ uri, headers, body }`
3. Rules match messages using regex patterns
4. Matching messages are dispatched to ports
5. Listeners on ports receive the messages

### Adding Rules

```javascript
// Match all cell value changes
bl._plumber.addRule('cell-changes', {
  match: { headers: { type: 'bl:///types/cell-value', changed: true } },
  port: 'cell-updates',
})

// Match specific URI prefix
bl._plumber.addRule('user-data', {
  match: { uri: '^bl:///data/users/.*' },
  port: 'user-changes',
})
```

### Listening to Ports

```javascript
bl._plumber.listen('cell-updates', (msg) => {
  console.log('Cell changed:', msg.uri)
  console.log('New value:', msg.body)
})
```

### Pattern Matching

- String values are treated as regex: `{ uri: '^bl:///cells/.*' }`
- Objects match recursively: `{ headers: { type: 'cell' } }`
- `null` or `undefined` values are wildcards (match anything)
- All pattern keys must match for a rule to fire

### Managing Rules

```javascript
// Via API
await bl.get('bl:///plumb/rules')           // List all rules
await bl.get('bl:///plumb/rules/my-rule')   // Get rule config
await bl.put('bl:///plumb/rules/my-rule', {}, { match: {...}, port: '...' })
```

### Use Cases

- Propagators use plumber to react to cell changes
- WebSocket server broadcasts changes to clients
- Activity logging and debugging
- Custom reactive behaviors

## Timers

Timers dispatch tick events through the plumber at configurable intervals.

```javascript
// Create and start a timer
await bl.put('bl:///timers/heartbeat', {}, { interval: 1000, enabled: true })

// Check timer status
await bl.get('bl:///timers/heartbeat')
// → { interval: 1000, enabled: true, running: true, tickCount: 42 }

// Stop timer
await bl.put('bl:///timers/heartbeat/stop', {}, {})

// Restart timer
await bl.put('bl:///timers/heartbeat/start', {}, {})
```

Each tick dispatches through plumber:

```javascript
{
  uri: 'bl:///timers/heartbeat',
  headers: { type: 'bl:///types/timer-tick' },
  body: { timer: 'heartbeat', tick: 42, time: '2024-...' }
}
```

Wire timers to cells via plumber rules:

```javascript
// Count timer ticks
await bl.put('bl:///cells/ticks', {}, { lattice: 'counter' })

bl._plumber.addRule('heartbeat-counter', {
  match: { headers: { type: 'bl:///types/timer-tick' }, body: { timer: 'heartbeat' } },
  port: 'heartbeat-ticks',
})

bl._plumber.listen('heartbeat-ticks', () => {
  bl.put('bl:///cells/ticks/value', {}, 1) // increment
})
```

## Fetch

Fetch makes HTTP requests with async responses dispatched through plumber.

```javascript
// Make a GET request
await bl.put(
  'bl:///fetch/request',
  {},
  {
    url: 'https://api.example.com/data',
    method: 'GET',
    headers: { Authorization: 'Bearer ...' },
  }
)

// POST with body
await bl.put(
  'bl:///fetch/request',
  {},
  {
    url: 'https://api.example.com/create',
    method: 'POST',
    body: { name: 'test' },
  }
)

// Auto-write response to a cell
await bl.put(
  'bl:///fetch/request',
  {},
  {
    url: 'https://api.example.com/status',
    responseCell: 'bl:///cells/status',
  }
)
```

Responses dispatch through plumber:

```javascript
// Success
{
  uri: 'bl:///fetch/req-123',
  headers: { type: 'bl:///types/fetch-response', status: 200 },
  body: { requestId: 'req-123', url: '...', status: 200, headers: {...}, body: {...} }
}

// Error
{
  uri: 'bl:///fetch/req-123',
  headers: { type: 'bl:///types/fetch-error' },
  body: { requestId: 'req-123', url: '...', error: 'Connection refused' }
}
```

List and inspect requests:

```javascript
await bl.get('bl:///fetch') // List recent requests
await bl.get('bl:///fetch/req-123') // Get specific request result
```

## Monitors

Monitors compose Timer + Fetch + Cell to create automated URL polling pipelines. One PUT creates everything needed to poll a URL at an interval and store the result.

```javascript
// Create a monitor - automatically sets up timer, fetch, and cell
await bl.put(
  'bl:///monitors/github-status',
  {},
  {
    url: 'https://www.githubstatus.com/api/v2/status.json',
    interval: 60000, // poll every 60s
    enabled: true, // auto-start
    extract: 'status.indicator', // optional: extract nested field
    method: 'GET', // HTTP method (default: GET)
    headers: {}, // custom headers
  }
)

// Check monitor status and latest value
await bl.get('bl:///monitors/github-status')
// → { url, interval, enabled, running, lastFetch, lastValue, fetchCount, cell: 'bl:///cells/monitor-github-status' }

// Control the monitor
await bl.put('bl:///monitors/github-status/start', {}, {}) // start polling
await bl.put('bl:///monitors/github-status/stop', {}, {}) // stop polling
await bl.put('bl:///monitors/github-status/fetch', {}, {}) // trigger immediate fetch

// List all monitors
await bl.get('bl:///monitors')
```

Each monitor:

- Creates a backing cell at `bl:///cells/monitor-{name}`
- Creates a timer at `bl:///timers/monitor-{name}`
- Dispatches `monitor-update` events through plumber on each fetch
- Supports optional field extraction with dot notation (`extract: 'data.value'`)

Use cases:

- Dashboard status indicators
- External API monitoring
- Data synchronization from remote services
- Real-time feeds

## Package Structure

```
packages/core/           # Router, pattern matching, install system
packages/plumber/        # Rule-based message routing
packages/links/          # Bidirectional ref tracking
packages/types/          # Built-in type definitions
packages/cells/          # Lattice-based cells
packages/fn/             # Function registry and combinators
packages/propagators/    # Reactive propagators (uses fn)
packages/timers/         # Time-based event dispatch
packages/fetch/          # HTTP requests
packages/monitors/       # URL polling (Timer + Fetch + Cell)
packages/dashboard/      # Activity tracking
packages/trust/          # Local trust computation and capability gating
packages/services/       # External service integrations (Claude API)
packages/store-node/     # File and code stores
packages/server-node/    # HTTP and WebSocket servers
packages/remote-browser/ # WebSocket client for browsers
packages/react/          # React bindings

apps/cli/                # Daemon, MCP server, seed scripts
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
await bl.put(
  'bl:///install/cells',
  {},
  {
    path: './packages/cells/src/upgrade.js',
    // Additional config passed to the module
  }
)
```

### Upgrade Modules

Each module provides an upgrade file exporting a default install function:

```javascript
// packages/cells/src/upgrade.js
export default function installCells(bl, config = {}) {
  const cells = createCellRoutes({
    /* callbacks */
  })
  cells.install(bl)
  bl._cells = cells // Register for other modules
}
```

Convention: `upgrade-*.js` or `upgrade.js` in each package.

### Module Patterns

**Registry**: Modules register themselves on `bl._*` for discovery:

```javascript
bl._links = links // Link index
bl._plumber = plumber // Message router
bl._cells = cells // Cell manager
bl._propagators = propagators
```

**Lookup**: Dependent modules find prerequisites from `bl`:

```javascript
// In propagators upgrade.js
const propagators = createPropagatorRoutes({ bl }) // bl passed in
```

**Deferred Callbacks**: Use optional chaining for loose coupling:

```javascript
// Cells notify propagators if available
onCellChange: ({ uri }) => {
  bl._propagators?.onCellChange(uri) // Safe if not installed
}
```

### Bootstrap

The standard bootstrap loads all modules in order:

```bash
BL_BOOTSTRAP=./apps/cli/src/bootstrap.js node apps/cli/src/daemon.js
```

Module dependency order:

1. `index` - root resource listing
2. `types` - built-in type definitions
3. `links` - bidirectional ref tracking
4. `plumber` - message routing
5. `file-store` - persistence
6. `http-server` - HTTP API
7. `ws-server` - WebSocket (uses plumber)
8. `fn` - function registry and combinators
9. `propagators` - reactive computation (uses fn)
10. `cells` - lattice values (uses propagators, plumber)
11. `dashboard` - activity tracking (uses plumber)
12. `timers` - time-based events (uses plumber)
13. `fetch` - HTTP requests (uses plumber)
14. `monitors` - URL polling (uses timers, cells, plumber)
15. `recipes` - template-based resource composition
16. `claude` - Claude API (optional, requires ANTHROPIC_API_KEY)

## MCP Server

The MCP (Model Context Protocol) server exposes Bassline resources to Claude Code.

Setup:

```bash
pnpm setup:mcp
# Creates .mcp.json from .mcp.json.example with correct paths
```

Or configure manually in Claude Code settings:

```json
{
  "mcpServers": {
    "bassline": {
      "command": "node",
      "args": ["/path/to/bassline/apps/cli/src/mcp-stdio.js"],
      "env": { "BL_URL": "http://localhost:9111" }
    }
  }
}
```

Available tools:

- `bassline_get` - GET a resource by URI
- `bassline_put` - PUT a resource with body
- `bassline_list` - List resources at a path
- `bassline_links` - Query forward or back links

Requires a running daemon:

```bash
pnpm dev  # Starts daemon on port 9111
```

## Running

```bash
pnpm install
pnpm test
```

## License

AGPLv3
