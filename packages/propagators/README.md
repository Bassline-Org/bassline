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

Handlers are registered as factories that receive a config object and return a function.

### Built-in Handlers

**Basic**
- `sum` - add all inputs
- `product` - multiply all inputs
- `passthrough` - pass first input through
- `constant` - output a constant value (config: `{ value }`)

**Reducers**
- `min`, `max` - minimum/maximum of inputs
- `average` - average of inputs
- `concat` - concatenate arrays or strings
- `first`, `last` - first/last non-null input

**Structural**
- `pair` - combine inputs into array
- `zip` - combine inputs into object (config: `{ keys: [...] }`)
- `unzip` - extract key from object (config: `{ key }`)

**Transformers**
- `map` - apply handler to collection (config: `{ handler, config }`)
- `pick` - extract key (config: `{ key }`)
- `format` - template string (config: `{ template: 'Hello {0}' }`)
- `coerce` - type conversion (config: `{ to: 'number'|'string'|'boolean'|'json' }`)

**Predicates**
- `filter` - skip propagation if predicate fails (config: `{ handler, config }`)
- `when` - same as filter

**Composition**
- `compose` - chain handlers (config: `{ steps: ['handler1', 'handler2'], handler1: {...} }`)

**Arithmetic**
- `negate`, `abs`, `round`, `floor`, `ceil` - single input
- `subtract`, `divide`, `modulo`, `power` - two inputs

**Comparison** (config: `{ value }` for single input)
- `eq`, `neq`, `gt`, `gte`, `lt`, `lte`

**Logic**
- `and`, `or` - all/any inputs truthy
- `not` - negate single input
- `xor` - exclusive or of two inputs

**String**
- `split` (config: `{ delimiter }`)
- `join` (config: `{ delimiter }`)
- `trim`, `uppercase`, `lowercase`
- `strSlice` (config: `{ start, end }`)
- `replace` (config: `{ pattern, flags, replacement }`)
- `match` (config: `{ pattern, flags }`)
- `startsWith` (config: `{ prefix }`)
- `endsWith` (config: `{ suffix }`)
- `includes` (config: `{ substring }`)

**Array**
- `length`, `head`, `tail`, `init`, `reverse`
- `at` (config: `{ index }`)
- `sort` (config: `{ descending }`)
- `sortBy` (config: `{ key, descending }`)
- `unique`, `flatten`, `compact`
- `take`, `drop` (config: `{ count }`)
- `chunk` (config: `{ size }`)

**Array Reducers**
- `sumBy` (config: `{ key }`)
- `countBy`, `groupBy`, `indexBy` (config: `{ key }`)
- `minBy`, `maxBy` (config: `{ key }`)

**Object**
- `keys`, `values`, `entries`, `fromEntries`
- `get` (config: `{ path: 'a.b.c' }`)
- `has` (config: `{ path }`)
- `omit` (config: `{ keys: [...] }`)
- `defaults` (config: `{ defaults: {...} }`)
- `merge` - shallow merge all inputs

**Type Checking**
- `isNull`, `isNumber`, `isString`, `isArray`, `isObject`, `typeOf`

**Conditional**
- `ifElse` (config: `{ predicate: {handler, config}, then: {handler, config}, else: {handler, config} }`)
- `cond` (config: `{ cases: [{when: {...}, then: {...}}], default: {...} }`)

**Utility**
- `identity` - return input unchanged
- `always` (config: `{ value }`)
- `tap` - log and pass through (config: `{ label }`)
- `defaultTo` (config: `{ value }`)

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
await bl.put('bl:///install/propagators', {}, {
  path: './packages/propagators/src/upgrade.js',
  handlers: {
    // Optional custom handlers
    myHandler: (inputs) => inputs[0] * 2
  }
})
// Registers: bl._propagators
// Requires: bl._plumber (optional)
```

## Related

- [@bassline/cells](../cells) - Lattice-based cells
- [@bassline/core](../core) - Router and utilities
