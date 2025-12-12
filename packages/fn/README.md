# @bassline/fn

Function registry and combinators for Bassline propagators.

## Overview

Functions are pure transformations used by propagators to compute derived values. This package provides:

- **Registry** - Storage and lookup for functions by URI
- **Compiler** - Compiles Hiccup-style definitions into executable functions
- **110 Built-in Functions** - Organized by domain
- **Routes** - REST API for function management

## Installation

Functions are automatically installed before propagators in bootstrap:

```javascript
// apps/cli/src/bootstrap.js
await bl.put(
  'bl:///install/fn',
  {},
  {
    path: './packages/fn/src/upgrade.js',
  }
)
```

## Usage

Functions are accessed via `bl.getModule('fn')`:

```javascript
// Get a function
const fnModule = await bl.getModule('fn')
const sumFn = fnModule.get('bl:///fn/sum')
const result = sumFn(1, 2, 3) // → 6

// Get with config
const multiplyBy2 = fnModule.get('bl:///fn/multiply', { value: 2 })
multiplyBy2(5) // → 10

// Compile a Hiccup-style definition
const double = fnModule.compile([
  'bl:///fn/pipe',
  'bl:///fn/identity',
  ['bl:///fn/multiply', { value: 2 }],
])
double(5) // → 10
```

## Built-in Functions (110)

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

Functions can be defined using array syntax:

```javascript
// Simple fn reference
;['bl:///fn/sum'][
  // Fn with config
  ('bl:///fn/multiply', { value: 2 })
][
  // Composition (pipe)
  ('bl:///fn/pipe', 'bl:///fn/identity', ['bl:///fn/multiply', { value: 2 }])
][
  // Fork: compute average as sum/length
  ('bl:///fn/fork', 'bl:///fn/divide', 'bl:///fn/sum', 'bl:///fn/length')
][
  // Converge: normalize array
  ('bl:///fn/converge',
  'bl:///fn/map',
  ['bl:///fn/identity', ['bl:///fn/fork', 'bl:///fn/divide', 'bl:///fn/sum', 'bl:///fn/length']])
]
```

## Custom Functions

Create custom functions via PUT:

```javascript
// Via HTTP
await bl.put(
  'bl:///fn/double',
  {},
  {
    definition: ['bl:///fn/pipe', 'bl:///fn/identity', ['bl:///fn/multiply', { value: 2 }]],
    description: 'Double a number',
  }
)

// Via registry (programmatic)
const fnModule = await bl.getModule('fn')
fnModule.registerCustom('bl:///fn/triple', {
  definition: ['bl:///fn/multiply', { value: 3 }],
  description: 'Triple a number',
})
```

## API

| Route                  | Method | Description        |
| ---------------------- | ------ | ------------------ |
| `/fn`                  | GET    | List all functions |
| `/fn/:name`            | GET    | Get fn info        |
| `/fn/:name/definition` | GET    | Get fn definition  |
| `/fn/:name`            | PUT    | Create custom fn   |
| `/fn/:name/delete`     | PUT    | Delete custom fn   |

## Architecture

```
packages/fn/
├── src/
│   ├── index.js           # Public exports
│   ├── registry.js        # Function storage
│   ├── compiler.js        # Hiccup compiler
│   ├── routes.js          # REST routes
│   ├── upgrade.js         # Install module
│   ├── combinators.js     # Combinator implementations
│   └── handlers/          # Function implementations
│       ├── math.js
│       ├── logic.js
│       ├── collections.js
│       ├── string.js
│       ├── type.js
│       └── control.js
```

## Related

- [@bassline/propagators](../propagators) - Uses functions for reactive computation
- [@bassline/cells](../cells) - Lattice-based cells that propagators connect
