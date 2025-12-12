# @bassline/handlers

Handler registry and combinators for Bassline propagators.

## Overview

Handlers are pure functions that transform data. They're used by propagators to compute derived values. This package provides:

- **Registry** - Storage and lookup for handlers
- **Compiler** - Compiles Hiccup-style definitions into executable functions
- **110 Built-in Handlers** - Organized by domain
- **Routes** - REST API for handler management

## Installation

Handlers are automatically installed before propagators in bootstrap:

```javascript
// apps/cli/src/bootstrap.js
await bl.put(
  'bl:///install/handlers',
  {},
  {
    path: './packages/handlers/src/upgrade.js',
  }
)
```

## Usage

Handlers are registered on `bl._handlers`:

```javascript
// Get a handler
const sumHandler = bl._handlers.get('sum')
const result = sumHandler(1, 2, 3) // → 6

// Get with config
const multiplyBy2 = bl._handlers.get('multiply', { value: 2 })
multiplyBy2(5) // → 10

// Compile a Hiccup-style definition
const double = bl._handlers.compile(['pipe', 'identity', ['multiply', { value: 2 }]])
double(5) // → 10
```

## Built-in Handlers (110)

### Reducers

`sum`, `product`, `min`, `max`, `average`, `concat`, `first`, `last`

### Binary Operations

`add`, `subtract`, `multiply`, `divide`, `modulo`, `power`

### Arithmetic (Unary)

`negate`, `abs`, `round`, `floor`, `ceil`

### Comparison

`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `deepEq`

Config: `{ value }` for comparing against a constant

### Logic

`and`, `or`, `not`, `xor`

### String

`split`, `join`, `trim`, `uppercase`, `lowercase`, `strSlice`, `replace`, `match`, `startsWith`, `endsWith`, `includes`

### Array

`length`, `at`, `head`, `tail`, `init`, `reverse`, `sort`, `sortBy`, `unique`, `flatten`, `compact`, `take`, `drop`, `chunk`, `arraySum`, `arrayProduct`, `arrayAverage`, `arrayMin`, `arrayMax`

### Array Reducers

`sumBy`, `countBy`, `groupBy`, `indexBy`, `minBy`, `maxBy`, `fold`, `scan`

### Object

`keys`, `values`, `entries`, `fromEntries`, `get`, `has`, `omit`, `defaults`, `merge`

### Type Checking

`isNull`, `isNumber`, `isString`, `isArray`, `isObject`, `typeOf`

### Conditional

`filter`, `when`, `ifElse`, `cond`

### Structural

`pair`, `zip`, `unzip`, `pick`, `map`

### Utility

`identity`, `passthrough`, `constant`, `always`, `tap`, `defaultTo`, `format`, `coerce`

### Composition

`compose`

### Combinators (APL/J Style)

**Unary**

- `pipe` - Left-to-right composition: `pipe(f,g)(x) = g(f(x))`
- `sequence` - Same as pipe

**Binary**

- `hook` - `hook(f,g)(x) = f(x, g(x))`
- `both` - `both(f,g)(x,y) = [f(x,y), g(x,y)]`
- `flip` - `flip(f)(x,y) = f(y,x)`

**Ternary**

- `fork` - `fork(f,g,h)(x) = f(g(x), h(x))`

**Variadic**

- `converge` - `converge(f, [g,h,i])(x) = f(g(x), h(x), i(x))`

**Special**

- `K` - Constant combinator: `K(c)(x) = c`
- `duplicate` - Apply arg twice: `W(f)(x) = f(x,x)`

## Hiccup-Style Definitions

Handlers can be defined using array syntax:

```javascript
// Simple handler reference
;['sum'][
  // Handler with config
  ('multiply', { value: 2 })
][
  // Composition (pipe)
  ('pipe', 'identity', ['multiply', { value: 2 }])
][
  // Fork: compute average as sum/length
  ('fork', 'divide', 'sum', 'length')
][
  // Converge: normalize array
  ('converge', 'map', ['identity', ['fork', 'divide', 'sum', 'length']])
]
```

## Custom Handlers

Create custom handlers via PUT:

```javascript
// Via HTTP
await bl.put(
  'bl:///handlers/double',
  {},
  {
    definition: ['pipe', 'identity', ['multiply', { value: 2 }]],
    description: 'Double a number',
  }
)

// Via registry (programmatic)
bl._handlers.registerCustom('triple', {
  definition: ['multiply', { value: 3 }],
  description: 'Triple a number',
})
```

## API

| Route                        | Method | Description            |
| ---------------------------- | ------ | ---------------------- |
| `/handlers`                  | GET    | List all handlers      |
| `/handlers/:name`            | GET    | Get handler info       |
| `/handlers/:name/definition` | GET    | Get handler definition |
| `/handlers/:name`            | PUT    | Create custom handler  |
| `/handlers/:name/delete`     | PUT    | Delete custom handler  |

## Architecture

```
packages/handlers/
├── src/
│   ├── index.js           # Public exports
│   ├── registry.js        # Handler storage
│   ├── compiler.js        # Hiccup compiler
│   ├── routes.js          # REST routes
│   ├── upgrade.js         # Install module
│   ├── handlers/          # Handler implementations
│   │   ├── reducers.js
│   │   ├── binary-ops.js
│   │   ├── arithmetic.js
│   │   ├── comparison.js
│   │   ├── logic.js
│   │   ├── string.js
│   │   ├── array.js
│   │   ├── array-reducers.js
│   │   ├── object.js
│   │   ├── type.js
│   │   ├── conditional.js
│   │   ├── structural.js
│   │   ├── utility.js
│   │   └── composition.js
│   └── combinators/       # Combinator implementations
│       ├── unary.js
│       ├── binary.js
│       ├── ternary.js
│       ├── variadic.js
│       └── special.js
```

## Related

- [@bassline/propagators](../propagators) - Uses handlers for reactive computation
- [@bassline/cells](../cells) - Lattice-based cells that propagators connect
