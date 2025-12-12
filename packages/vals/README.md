# @bassline/vals

Shareable resource compositions for Bassline.

## Overview

Vals are shareable, forkable resource definitions - compositions of Bassline primitives (handlers, propagators, cells, recipes) that can be shared, versioned, and instantiated.

## Installation

Installed during bootstrap after recipes:

```javascript
await bl.put(
  'bl:///install/vals',
  {},
  {
    path: './packages/vals/src/upgrade.js',
  }
)
```

## Val Types

| Type           | Description                                      |
| -------------- | ------------------------------------------------ |
| `propagator`   | Reactive computation (inputs → handler → output) |
| `recipe`       | Template that creates multiple resources         |
| `handler`      | Reusable handler composition                     |
| `cell`         | Shared data container definition                 |
| `plumber-rule` | Message routing rule                             |

## Routes

| Route                            | Method | Description            |
| -------------------------------- | ------ | ---------------------- |
| `/vals`                          | GET    | List all vals          |
| `/vals/:owner`                   | GET    | List user's vals       |
| `/vals/:owner/:name`             | GET    | Get val definition     |
| `/vals/:owner/:name`             | PUT    | Create/update val      |
| `/vals/:owner/:name/delete`      | PUT    | Delete val             |
| `/vals/:owner/:name/versions`    | GET    | Version history        |
| `/vals/:owner/:name/fork`        | PUT    | Fork val               |
| `/vals/:owner/:name/instantiate` | PUT    | Instantiate recipe val |

## Creating Vals

### Propagator Val

```javascript
await bl.put(
  'bl:///vals/user/double-sum',
  {},
  {
    valType: 'propagator',
    description: 'Adds two numbers and doubles result',
    definition: {
      inputs: ['a', 'b'], // Symbolic input names
      handler: ['bl:///fn/pipe', 'bl:///fn/sum', ['bl:///fn/multiply', { value: 2 }]],
      output: 'result',
    },
  }
)
```

### Recipe Val

```javascript
await bl.put(
  'bl:///vals/user/counter-widget',
  {},
  {
    valType: 'recipe',
    description: 'Counter with increment/decrement',
    definition: {
      params: ['initial'],
      resources: [
        { type: 'cell', name: 'count', config: { lattice: 'maxNumber', value: '$initial' } },
        {
          type: 'propagator',
          name: 'display',
          config: { inputs: ['$count'], fn: 'bl:///fn/format' },
        },
      ],
    },
  }
)
```

### Handler Val

```javascript
await bl.put(
  'bl:///vals/user/price-formatter',
  {},
  {
    valType: 'handler',
    description: 'Format price with currency',
    definition: [
      'bl:///fn/pipe',
      ['bl:///fn/divide', { value: 100 }],
      ['bl:///fn/format', { template: '$%.2f' }],
    ],
  }
)
```

## Forking Vals

Create your own copy of a val:

```javascript
await bl.put(
  'bl:///vals/me/my-counter',
  {},
  {
    fork: 'bl:///vals/user/counter-widget',
    description: 'My customized counter',
  }
)
```

## Instantiating Vals

Create live resources from a recipe val:

```javascript
await bl.put(
  'bl:///vals/user/counter-widget/instantiate',
  {},
  {
    name: 'main-counter',
    params: { initial: 0 },
  }
)
// Creates cells and propagators based on the recipe
```

## Version History

```javascript
// Get version history
await bl.get('bl:///vals/user/double-sum/versions')
// → { entries: [{ version: 1, timestamp: '...' }, { version: 2, timestamp: '...' }] }

// Get specific version
await bl.get('bl:///vals/user/double-sum?version=1')
```

## Listing Vals

```javascript
// All vals
await bl.get('bl:///vals')
// → { entries: [{ owner: 'user', name: 'double-sum', uri: '...' }, ...] }

// User's vals
await bl.get('bl:///vals/user')
// → { entries: [{ name: 'double-sum', uri: '...' }, ...] }
```

## Module API

```javascript
const vals = await bl.getModule('vals')

vals.createVal('owner', 'name', definition)
vals.getVal('owner', 'name')
vals.deleteVal('owner', 'name')
vals.listVals()
vals.listOwnerVals('owner')
vals.forkVal('owner', 'name', newOwner, newName)
```
