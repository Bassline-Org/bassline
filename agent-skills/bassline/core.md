# Bassline Core Reference

In-depth usage guide for all @bassline/core resources.

---

## Cells

Cells store state that **merges monotonically** using lattices. Multiple writes don't overwrite - they merge according to the lattice rules.

### Creating a Cell

```javascript
await kit.put({ path: '/cells/counter' }, { lattice: 'maxNumber' })
```

You must specify a lattice type. The cell is initialized with the lattice's default value.

### Reading and Writing Values

```javascript
// Write a value (merges with existing)
await kit.put({ path: '/cells/counter/value' }, 5)

// Read current value
const { body } = await kit.get({ path: '/cells/counter/value' })
```

### Lattice Types

#### maxNumber

Keeps the maximum value. Use for high scores, versions, timestamps.

```javascript
await kit.put({ path: '/cells/highscore' }, { lattice: 'maxNumber' })
await kit.put({ path: '/cells/highscore/value' }, 100)
await kit.put({ path: '/cells/highscore/value' }, 50) // still 100
await kit.put({ path: '/cells/highscore/value' }, 200) // now 200
```

#### minNumber

Keeps the minimum value. Use for earliest timestamp, lowest price.

```javascript
await kit.put({ path: '/cells/earliest' }, { lattice: 'minNumber' })
await kit.put({ path: '/cells/earliest/value' }, 500)
await kit.put({ path: '/cells/earliest/value' }, 100) // now 100
await kit.put({ path: '/cells/earliest/value' }, 300) // still 100
```

#### setUnion

Union of arrays. Use for collecting tags, seen IDs, accumulated items.

```javascript
await kit.put({ path: '/cells/tags' }, { lattice: 'setUnion' })
await kit.put({ path: '/cells/tags/value' }, ['red', 'blue'])
await kit.put({ path: '/cells/tags/value' }, ['blue', 'green'])
// Result: ['red', 'blue', 'green']
```

#### boolean

Once true, stays true. Use for flags like "seen", "completed", "error occurred".

```javascript
await kit.put({ path: '/cells/hasError' }, { lattice: 'boolean' })
await kit.put({ path: '/cells/hasError/value' }, false)
await kit.put({ path: '/cells/hasError/value' }, true) // now true
await kit.put({ path: '/cells/hasError/value' }, false) // still true
```

#### object

Shallow merge of objects. Use for accumulating config, metadata, partial updates.

```javascript
await kit.put({ path: '/cells/config' }, { lattice: 'object' })
await kit.put({ path: '/cells/config/value' }, { theme: 'dark' })
await kit.put({ path: '/cells/config/value' }, { fontSize: 14 })
// Result: { theme: 'dark', fontSize: 14 }

// Later values override earlier for same key
await kit.put({ path: '/cells/config/value' }, { theme: 'light' })
// Result: { theme: 'light', fontSize: 14 }
```

#### lww (Last Writer Wins)

Keeps the most recent value by timestamp. Use when you need true overwrites.

```javascript
await kit.put({ path: '/cells/status' }, { lattice: 'lww' })

// Write with automatic timestamp
await kit.put({ path: '/cells/status/value' }, { value: 'pending' })
await kit.put({ path: '/cells/status/value' }, { value: 'complete' })
// Result: { value: 'complete', timestamp: <latest> }

// Or provide explicit timestamp
await kit.put({ path: '/cells/status/value' }, { value: 'old', timestamp: 1000 })
await kit.put({ path: '/cells/status/value' }, { value: 'new', timestamp: 2000 })
// 'new' wins because timestamp is higher
```

### Listing All Cells

```javascript
const { body } = await kit.get({ path: '/cells' })
// {
//   name: 'cells',
//   description: 'Lattice-based state accumulation',
//   lattices: ['maxNumber', 'minNumber', 'setUnion', 'lww', 'boolean', 'object'],
//   resources: { '/counter': {}, '/highscore': {} }
// }
```

### Getting Cell Config

```javascript
const { body } = await kit.get({ path: '/cells/counter' })
// { lattice: 'maxNumber', value: 42 }
```

---

## Store

Stores provide simple key/value storage with path-based access.

### Writing Data

```javascript
// Store any JSON-serializable value
await kit.put(
  { path: '/store/users/alice' },
  {
    name: 'Alice',
    role: 'admin',
    createdAt: Date.now(),
  }
)

// Nested paths auto-create parent structure
await kit.put({ path: '/store/config/theme/colors/primary' }, '#007bff')
```

### Reading Data

```javascript
// Get a specific value
const { body } = await kit.get({ path: '/store/users/alice' })
// { name: 'Alice', role: 'admin', createdAt: 1703376000000 }

// Get nested value
const { body: color } = await kit.get({ path: '/store/config/theme/colors/primary' })
// '#007bff'
```

### Listing Keys

When you GET a path that contains children (not a leaf value), you get the keys:

```javascript
await kit.put({ path: '/store/users/alice' }, { name: 'Alice' })
await kit.put({ path: '/store/users/bob' }, { name: 'Bob' })

const { body: keys } = await kit.get({ path: '/store/users' })
// ['alice', 'bob']
```

### Checking if Key Exists

```javascript
const result = await kit.get({ path: '/store/users/charlie' })
if (result.headers.condition === 'not-found') {
  // Key doesn't exist
}
```

### Overwriting vs Merging

Store PUT **overwrites** the value entirely (unlike cells which merge):

```javascript
await kit.put({ path: '/store/user' }, { name: 'Alice', age: 30 })
await kit.put({ path: '/store/user' }, { name: 'Alice' })
// Result: { name: 'Alice' } - age is gone
```

---

## Propagators

Propagators define reactive computations: when you run them, they read inputs, apply a function, and write to an output.

### Creating a Propagator

```javascript
await kit.put(
  { path: '/propagators/total' },
  {
    inputs: ['price', 'quantity'], // Names for semantic paths
    output: '/cells/total/value', // Where to write result
    fn: '/fn/product', // Function to apply
  }
)
```

### Running a Propagator

```javascript
await kit.put({ path: '/propagators/total/run' }, null)
```

When run, the propagator:

1. Reads each input via kit at `/inputs/<name>`
2. Gets the function via kit at `/fn`
3. Calls the function with input values
4. Writes result via kit to `/output`

### Setting Up the Kit

Propagators use **semantic paths** - you wire them up via kit:

```javascript
const cells = createCells()
const fn = createFn()

// Create cells for inputs and output
await cells.put({ path: '/price' }, { lattice: 'maxNumber' })
await cells.put({ path: '/quantity' }, { lattice: 'maxNumber' })
await cells.put({ path: '/total' }, { lattice: 'maxNumber' })

// Set values
await cells.put({ path: '/price/value' }, 10)
await cells.put({ path: '/quantity/value' }, 5)

// Create kit that maps semantic paths to actual resources
const kit = resource({
  get: async h => {
    if (h.path.startsWith('/inputs/')) {
      const name = h.path.split('/')[2] // 'price' or 'quantity'
      return cells.get({ path: `/${name}/value` })
    }
    if (h.path === '/fn') {
      return fn.get({ path: '/product' })
    }
    return { headers: { condition: 'not-found' }, body: null }
  },
  put: async (h, b) => {
    if (h.path === '/output') {
      return cells.put({ path: '/total/value' }, b)
    }
    return { headers: { condition: 'not-found' }, body: null }
  },
})

// Run with kit
await propagators.put({ path: '/total/run', kit }, null)
// /cells/total/value is now 50
```

### Chaining Propagators

Build computation graphs by having one propagator's output feed another's input:

```javascript
// subtotal = price * quantity
await kit.put(
  { path: '/propagators/subtotal' },
  {
    inputs: ['price', 'quantity'],
    output: '/cells/subtotal/value',
    fn: '/fn/product',
  }
)

// total = subtotal + shipping
await kit.put(
  { path: '/propagators/total' },
  {
    inputs: ['subtotal', 'shipping'],
    output: '/cells/total/value',
    fn: '/fn/sum',
  }
)

// Run in order
await kit.put({ path: '/propagators/subtotal/run' }, null)
await kit.put({ path: '/propagators/total/run' }, null)
```

---

## Functions (fn)

The fn resource provides a registry of functions for use with propagators.

### Getting a Built-in Function

```javascript
const { body: sumFn } = await kit.get({ path: '/fn/sum' })
const result = sumFn(1, 2, 3) // 6
```

### Registering a Custom Function

```javascript
await kit.put({ path: '/fn/double' }, x => x * 2)
await kit.put({ path: '/fn/greet' }, name => `Hello, ${name}!`)
await kit.put({ path: '/fn/clamp' }, (val, min, max) => Math.max(min, Math.min(max, val)))
```

### Built-in Functions Reference

#### Arithmetic

| Function   | Usage                  | Example                   |
| ---------- | ---------------------- | ------------------------- |
| `sum`      | Sum all arguments      | `sum(1, 2, 3)` → `6`      |
| `product`  | Multiply all arguments | `product(2, 3, 4)` → `24` |
| `subtract` | a - b                  | `subtract(10, 3)` → `7`   |
| `divide`   | a / b                  | `divide(10, 2)` → `5`     |
| `negate`   | -a                     | `negate(5)` → `-5`        |
| `abs`      | Absolute value         | `abs(-5)` → `5`           |
| `mod`      | a % b                  | `mod(10, 3)` → `1`        |

#### Comparison

| Function | Usage         | Example              |
| -------- | ------------- | -------------------- |
| `min`    | Minimum value | `min(3, 1, 4)` → `1` |
| `max`    | Maximum value | `max(3, 1, 4)` → `4` |
| `gt`     | a > b         | `gt(5, 3)` → `true`  |
| `lt`     | a < b         | `lt(5, 3)` → `false` |
| `gte`    | a >= b        | `gte(5, 5)` → `true` |
| `lte`    | a <= b        | `lte(5, 5)` → `true` |
| `eq`     | a === b       | `eq(5, 5)` → `true`  |
| `neq`    | a !== b       | `neq(5, 3)` → `true` |

#### Logic

| Function | Usage      | Example                    |
| -------- | ---------- | -------------------------- |
| `and`    | All truthy | `and(true, true)` → `true` |
| `or`     | Any truthy | `or(false, true)` → `true` |
| `not`    | Negate     | `not(true)` → `false`      |

#### Arrays

| Function  | Usage             | Example                        |
| --------- | ----------------- | ------------------------------ |
| `first`   | First element     | `first([1,2,3])` → `1`         |
| `last`    | Last element      | `last([1,2,3])` → `3`          |
| `length`  | Array length      | `length([1,2,3])` → `3`        |
| `concat`  | Combine arrays    | `concat([1], [2])` → `[1,2]`   |
| `reverse` | Reverse array     | `reverse([1,2,3])` → `[3,2,1]` |
| `sort`    | Sort array        | `sort([3,1,2])` → `[1,2,3]`    |
| `unique`  | Remove duplicates | `unique([1,1,2])` → `[1,2]`    |
| `flatten` | Flatten nested    | `flatten([[1],[2]])` → `[1,2]` |

#### Objects

| Function  | Usage           | Example                             |
| --------- | --------------- | ----------------------------------- |
| `get`     | Get property    | `get({a:1}, 'a')` → `1`             |
| `set`     | Set property    | `set({a:1}, 'b', 2)` → `{a:1,b:2}`  |
| `keys`    | Object keys     | `keys({a:1,b:2})` → `['a','b']`     |
| `values`  | Object values   | `values({a:1,b:2})` → `[1,2]`       |
| `entries` | Key-value pairs | `entries({a:1})` → `[['a',1]]`      |
| `merge`   | Merge objects   | `merge({a:1}, {b:2})` → `{a:1,b:2}` |
| `pick`    | Select keys     | `pick({a:1,b:2}, 'a')` → `{a:1}`    |
| `omit`    | Exclude keys    | `omit({a:1,b:2}, 'a')` → `{b:2}`    |

#### Strings

| Function  | Usage           | Example                              |
| --------- | --------------- | ------------------------------------ |
| `upper`   | Uppercase       | `upper('hi')` → `'HI'`               |
| `lower`   | Lowercase       | `lower('HI')` → `'hi'`               |
| `trim`    | Trim whitespace | `trim(' hi ')` → `'hi'`              |
| `split`   | Split string    | `split('a,b', ',')` → `['a','b']`    |
| `join`    | Join array      | `join(['a','b'], ',')` → `'a,b'`     |
| `replace` | Replace pattern | `replace('hi', 'i', 'ey')` → `'hey'` |

#### Type Coercion

| Function  | Usage          | Example                      |
| --------- | -------------- | ---------------------------- |
| `number`  | To number      | `number('42')` → `42`        |
| `string`  | To string      | `string(42)` → `'42'`        |
| `boolean` | To boolean     | `boolean(1)` → `true`        |
| `json`    | To JSON string | `json({a:1})` → `'{"a":1}'`  |
| `parse`   | Parse JSON     | `parse('{"a":1}')` → `{a:1}` |

#### Higher-Order (return functions)

| Function  | Usage                 | Example                               |
| --------- | --------------------- | ------------------------------------- |
| `map`     | Transform each        | `map(x => x*2)([1,2])` → `[2,4]`      |
| `filter`  | Keep matching         | `filter(x => x>1)([1,2,3])` → `[2,3]` |
| `reduce`  | Accumulate            | `reduce((a,b)=>a+b, 0)([1,2])` → `3`  |
| `pipe`    | Left-to-right compose | `pipe(f, g)(x)` = `g(f(x))`           |
| `compose` | Right-to-left compose | `compose(f, g)(x)` = `f(g(x))`        |

#### Utilities

| Function   | Usage           | Example                                       |
| ---------- | --------------- | --------------------------------------------- |
| `identity` | Return input    | `identity(5)` → `5`                           |
| `constant` | Return function | `constant(5)()` → `5`                         |
| `pair`     | Create tuple    | `pair(1, 2)` → `[1, 2]`                       |
| `zip`      | Zip arrays      | `zip([1,2], ['a','b'])` → `[[1,'a'],[2,'b']]` |

---

## Common Patterns

### Initialize State on Startup

```javascript
// Create cells with initial values
await kit.put({ path: '/cells/counter' }, { lattice: 'maxNumber' })
await kit.put({ path: '/cells/counter/value' }, 0)

await kit.put({ path: '/cells/todos' }, { lattice: 'setUnion' })
await kit.put({ path: '/cells/todos/value' }, [])
```

### Accumulate Events

```javascript
// Use setUnion to collect events without losing any
await kit.put({ path: '/cells/events' }, { lattice: 'setUnion' })

// Each event adds to the set
await kit.put({ path: '/cells/events/value' }, [{ type: 'click', ts: 1 }])
await kit.put({ path: '/cells/events/value' }, [{ type: 'submit', ts: 2 }])
// Result: [{ type: 'click', ts: 1 }, { type: 'submit', ts: 2 }]
```

### Track Latest with History

```javascript
// LWW for current value
await kit.put({ path: '/cells/current' }, { lattice: 'lww' })

// setUnion for history
await kit.put({ path: '/cells/history' }, { lattice: 'setUnion' })

// Update both
const value = { status: 'active', timestamp: Date.now() }
await kit.put({ path: '/cells/current/value' }, value)
await kit.put({ path: '/cells/history/value' }, [value])
```

### Feature Flags

```javascript
// Boolean cells for flags - once enabled, stay enabled
await kit.put({ path: '/cells/features/darkMode' }, { lattice: 'boolean' })
await kit.put({ path: '/cells/features/betaUser' }, { lattice: 'boolean' })

// Enable a feature
await kit.put({ path: '/cells/features/darkMode/value' }, true)
```

### Computed Values with Propagators

```javascript
// Set up cells
await kit.put({ path: '/cells/items' }, { lattice: 'setUnion' })
await kit.put({ path: '/cells/count' }, { lattice: 'maxNumber' })

// Propagator to compute count from items
await kit.put(
  { path: '/propagators/countItems' },
  {
    inputs: ['items'],
    output: '/cells/count/value',
    fn: '/fn/length',
  }
)

// When items change, run the propagator
await kit.put({ path: '/cells/items/value' }, ['a', 'b', 'c'])
await kit.put({ path: '/propagators/countItems/run' }, null)
// /cells/count/value is now 3
```

### Building a CRUD Resource

```javascript
import { resource, routes, bind } from '@bassline/core'
import { createMemoryStore } from '@bassline/core/store'

const createCRUD = name => {
  const store = createMemoryStore()

  return routes({
    '': resource({
      get: async () => {
        const { body: keys } = await store.get({ path: '/' })
        return { headers: {}, body: { [name]: keys || [] } }
      },
    }),
    unknown: bind(
      'id',
      resource({
        get: async h => store.get({ path: `/${h.params.id}` }),
        put: async (h, b) => store.put({ path: `/${h.params.id}` }, b),
      })
    ),
  })
}

const users = createCRUD('users')

await users.put({ path: '/alice' }, { name: 'Alice' })
await users.put({ path: '/bob' }, { name: 'Bob' })
const { body } = await users.get({ path: '/' })
// { users: ['alice', 'bob'] }
```

### Wiring Resources Together with Kit

```javascript
const cells = createCells()
const store = createMemoryStore()
const fn = createFn()

// Create a kit that routes to the right resources
const kit = routes({
  cells: cells,
  store: store,
  fn: fn,
})

// Now use kit paths
await kit.put({ path: '/cells/counter' }, { lattice: 'maxNumber' })
await kit.put({ path: '/store/config' }, { debug: true })
const { body } = await kit.get({ path: '/fn/sum' })
```
