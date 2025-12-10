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

A lattice defines how values merge. Each lattice provides:
- `bottom()` - the minimal element
- `join(a, b)` - combine two values (supremum)
- `lte(a, b)` - compare two values (partial order)

### Built-in Lattices

| Lattice | Bottom | Join | Description |
|---------|--------|------|-------------|
| `maxNumber` | `-Infinity` | `Math.max(a, b)` | Values only increase |
| `minNumber` | `Infinity` | `Math.min(a, b)` | Values only decrease |
| `setUnion` | `[]` | Union of arrays | Accumulates elements |
| `setIntersection` | `null` | Intersection | Constrains to common elements |
| `lww` | `{value: null, timestamp: 0}` | Latest timestamp wins | Last-writer-wins |
| `object` | `{}` | Shallow merge | Later values overwrite |
| `counter` | `0` | `a + b` | Increment-only (adds values) |
| `boolean` | `false` | `a \|\| b` | Once true, stays true |

### Examples

```javascript
// Set union - accumulates elements
await bl.put('bl:///cells/tags', {}, { lattice: 'setUnion' })
await bl.put('bl:///cells/tags/value', {}, ['a', 'b'])
await bl.put('bl:///cells/tags/value', {}, ['b', 'c'])
// value is now ['a', 'b', 'c']

// Counter - adds values together
await bl.put('bl:///cells/visits', {}, { lattice: 'counter' })
await bl.put('bl:///cells/visits/value', {}, 1)
await bl.put('bl:///cells/visits/value', {}, 1)
await bl.put('bl:///cells/visits/value', {}, 1)
// value is now 3

// LWW - latest timestamp wins
await bl.put('bl:///cells/status', {}, { lattice: 'lww' })
await bl.put('bl:///cells/status/value', {}, { value: 'online', timestamp: Date.now() })

// Boolean - once true, stays true
await bl.put('bl:///cells/seen', {}, { lattice: 'boolean' })
await bl.put('bl:///cells/seen/value', {}, true)
await bl.put('bl:///cells/seen/value', {}, false)  // still true

// Set intersection - constrains to common elements
await bl.put('bl:///cells/allowed', {}, { lattice: 'setIntersection' })
await bl.put('bl:///cells/allowed/value', {}, ['a', 'b', 'c'])
await bl.put('bl:///cells/allowed/value', {}, ['b', 'c', 'd'])
// value is now ['b', 'c']
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

## Dynamic Installation

Install via the daemon's module system:

```javascript
await bl.put('bl:///install/cells', {}, {
  path: './packages/cells/src/upgrade.js'
})
// Registers: bl._cells
// Requires: bl._propagators (optional), bl._plumber (optional)
```

## Related

- [@bassline/propagators](../propagators) - Connect cells reactively
- [@bassline/core](../core) - Router and utilities
