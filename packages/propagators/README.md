# @bassline/propagators

Reactive propagators for Bassline. Connect cells and compute derived values.

## Install

```bash
pnpm add @bassline/propagators
```

## Usage

```javascript
import { Bassline } from '@bassline/core'
import { createCellRoutes } from '@bassline/cells'
import { createPropagatorRoutes } from '@bassline/propagators'

const bl = new Bassline()

const propagators = createPropagatorRoutes({ bl })
const cells = createCellRoutes({
  onCellChange: ({ uri }) => propagators.onCellChange(uri)
})

cells.install(bl)
propagators.install(bl)

// Create cells
await bl.put('bl:///cells/a', {}, { lattice: 'maxNumber' })
await bl.put('bl:///cells/b', {}, { lattice: 'maxNumber' })
await bl.put('bl:///cells/sum', {}, { lattice: 'maxNumber' })

// Create propagator: a + b → sum
await bl.put('bl:///propagators/add', {}, {
  inputs: ['bl:///cells/a', 'bl:///cells/b'],
  output: 'bl:///cells/sum',
  handler: 'sum'
})

// Set values
await bl.put('bl:///cells/a/value', {}, 5)
await bl.put('bl:///cells/b/value', {}, 3)

// sum is now 8
const result = await bl.get('bl:///cells/sum/value')
```

## Handlers

Handlers are provided by `@bassline/handlers`. See [packages/handlers/README.md](../handlers/README.md) for the full list of 110 built-in handlers.

Propagators access handlers via `bl._handlers.get(name, config)`.

### Examples

```javascript
// Transform: coerce strings to numbers
await bl.put('bl:///propagators/parse', {}, {
  inputs: ['bl:///cells/raw'],
  output: 'bl:///cells/num',
  handler: 'coerce',
  handlerConfig: { to: 'number' }
})

// Compose: extract value then negate
await bl.put('bl:///propagators/negate-lww', {}, {
  inputs: ['bl:///cells/lww-cell'],
  output: 'bl:///cells/negated',
  handler: 'compose',
  handlerConfig: {
    steps: ['pick', 'negate'],
    pick: { key: 'value' }
  }
})

// Group by key
await bl.put('bl:///propagators/by-category', {}, {
  inputs: ['bl:///cells/items'],
  output: 'bl:///cells/grouped',
  handler: 'groupBy',
  handlerConfig: { key: 'category' }
})
```

## Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/propagators` | GET | List all propagators |
| `/propagators/:name` | GET | Get propagator info |
| `/propagators/:name` | PUT | Create propagator |

## Dynamic Installation

Install via the daemon's module system:

```javascript
// Handlers must be installed first
await bl.put('bl:///install/handlers', {}, {
  path: './packages/handlers/src/upgrade.js'
})

await bl.put('bl:///install/propagators', {}, {
  path: './packages/propagators/src/upgrade.js'
})
// Registers: bl._propagators
// Requires: bl._handlers, bl._plumber (optional)
```

## Related

- [@bassline/handlers](../handlers) - Handler registry and combinators (required)
- [@bassline/cells](../cells) - Lattice-based cells
- [@bassline/core](../core) - Router and utilities
