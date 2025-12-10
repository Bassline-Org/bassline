# @bassline/cells

Lattice-based cells for Bassline. Values merge monotonically using lattice join.

## Install

```bash
pnpm add @bassline/cells
```

## Usage

```javascript
import { Bassline } from '@bassline/core'
import { createCellRoutes } from '@bassline/cells'

const bl = new Bassline()
const cells = createCellRoutes()
cells.install(bl)

// Create a cell
await bl.put('bl:///cells/counter', {}, { lattice: 'maxNumber' })

// Merge values (lattice join)
await bl.put('bl:///cells/counter/value', {}, 5)
await bl.put('bl:///cells/counter/value', {}, 3)  // still 5
await bl.put('bl:///cells/counter/value', {}, 10) // now 10

// Read value
const result = await bl.get('bl:///cells/counter/value')
// { headers: { type: 'bl:///types/cell-value' }, body: 10 }
```

## Lattices

Built-in lattices:

- `maxNumber` - maximum of numbers
- `minNumber` - minimum of numbers
- `setUnion` - union of arrays
- `lww` - last-writer-wins (by timestamp)

```javascript
// Set union example
await bl.put('bl:///cells/tags', {}, { lattice: 'setUnion' })
await bl.put('bl:///cells/tags/value', {}, ['a', 'b'])
await bl.put('bl:///cells/tags/value', {}, ['b', 'c'])
// value is now ['a', 'b', 'c']
```

## Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/cells` | GET | List all cells |
| `/cells/:name` | GET | Get cell info |
| `/cells/:name` | PUT | Create/configure cell |
| `/cells/:name/value` | GET | Get current value |
| `/cells/:name/value` | PUT | Merge value |
| `/cells/:name/reset` | PUT | Reset to bottom |

## Related

- [@bassline/propagators](../propagators) - Connect cells reactively
- [@bassline/core](../core) - Router and utilities
