# @bassline/tmp

Ephemeral state and temporary functions for Bassline.

## Overview

Provides in-memory storage that doesn't persist across restarts:

- **State** - Temporary key-value storage at `bl:///tmp/state/*`
- **Functions** - Runtime function bindings at `bl:///tmp/fn/*`

Useful for UI state, session data, and transient computations.

## Installation

Installed during bootstrap after propagators:

```javascript
await bl.put(
  'bl:///install/tmp',
  {},
  {
    path: './packages/tmp/src/upgrade.js',
  }
)
```

## Ephemeral State

Store temporary values in memory.

### Routes

| Route                      | Method | Description         |
| -------------------------- | ------ | ------------------- |
| `/tmp/state`               | GET    | List all state keys |
| `/tmp/state/:name*`        | GET    | Get state value     |
| `/tmp/state/:name*`        | PUT    | Set state value     |
| `/tmp/state/:name*/delete` | PUT    | Delete state        |

### Usage

```javascript
// Set state
await bl.put('bl:///tmp/state/ui/sidebar', {}, { expanded: true })

// Get state
await bl.get('bl:///tmp/state/ui/sidebar')
// → { headers: { type: 'tmp-state' }, body: { expanded: true } }

// Nested paths
await bl.put('bl:///tmp/state/user/preferences/theme', {}, 'dark')

// List all state
await bl.get('bl:///tmp/state')
// → { body: { entries: [{ name: 'ui/sidebar', uri: '...' }, ...] } }

// Delete state
await bl.put('bl:///tmp/state/ui/sidebar/delete', {}, {})
```

### Plumber Events

State changes dispatch through plumber:

- `resource-created` - New state key created
- `resource-updated` - Existing state updated
- `resource-removed` - State deleted

## Temporary Functions

Bind functions at runtime without persisting definitions.

### Routes

| Route                   | Method | Description                  |
| ----------------------- | ------ | ---------------------------- |
| `/tmp/fn`               | GET    | List all temporary functions |
| `/tmp/fn/:name*`        | GET    | Get function metadata        |
| `/tmp/fn/:name*`        | PUT    | Create temporary function    |
| `/tmp/fn/:name*/delete` | PUT    | Delete function              |

### Usage

```javascript
// Create a temp function referencing a built-in
await bl.put(
  'bl:///tmp/fn/double',
  {},
  {
    definition: 'bl:///fn/multiply',
    config: { value: 2 },
  }
)

// Or using hiccup-style composition
await bl.put(
  'bl:///tmp/fn/addThenDouble',
  {},
  {
    definition: [
      'bl:///fn/pipe',
      ['bl:///fn/add', { value: 10 }],
      ['bl:///fn/multiply', { value: 2 }],
    ],
  }
)

// List functions
await bl.get('bl:///tmp/fn')

// Get function info
await bl.get('bl:///tmp/fn/double')

// Delete function
await bl.put('bl:///tmp/fn/double/delete', {}, {})
```

### Using Temp Functions in Propagators

```javascript
// Create a temp function
await bl.put(
  'bl:///tmp/fn/formatPrice',
  {},
  {
    definition: [
      'bl:///fn/pipe',
      ['bl:///fn/multiply', { value: 100 }],
      ['bl:///fn/format', { template: '$%.2f' }],
    ],
  }
)

// Use in propagator
await bl.put(
  'bl:///propagators/price-formatter',
  {},
  {
    inputs: ['bl:///cells/price'],
    output: 'bl:///cells/formatted-price',
    fn: 'bl:///tmp/fn/formatPrice',
  }
)
```

## Module API

Access via `bl.getModule('tmp')`:

```javascript
const tmp = await bl.getModule('tmp')

// State operations
tmp.state.getState('ui/sidebar')
tmp.state.setState('ui/sidebar', { expanded: true })
tmp.state.deleteState('ui/sidebar')
tmp.state.listStates()

// Function operations
tmp.fn.getFunction('myFn')
tmp.fn.setFunction('myFn', { definition: '...' })
tmp.fn.deleteFunction('myFn')
tmp.fn.listFunctions()
```

## Use Cases

- **UI State** - Sidebar expanded, modal open, selected tab
- **Session Data** - Current user, auth tokens, preferences
- **Computation Cache** - Intermediate results, derived values
- **Dev/Debug** - Temporary values during development
