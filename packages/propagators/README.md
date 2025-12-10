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

Built-in handlers:

- `sum` - add all inputs
- `product` - multiply all inputs
- `passthrough` - pass first input through
- `constant` - output a constant value

## Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/propagators` | GET | List all propagators |
| `/propagators/:name` | GET | Get propagator info |
| `/propagators/:name` | PUT | Create propagator |

## Related

- [@bassline/cells](../cells) - Lattice-based cells
- [@bassline/core](../core) - Router and utilities
