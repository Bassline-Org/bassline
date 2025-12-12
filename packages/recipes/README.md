# @bassline/recipes

Template-based composition for creating multiple coordinated resources.

## Install

```bash
pnpm add @bassline/recipes
```

## Usage

```javascript
import { Bassline } from '@bassline/core'
import { createRecipeRoutes } from '@bassline/recipes'

const bl = new Bassline()

const recipes = createRecipeRoutes({ bl })
recipes.install(bl)
```

## Concepts

**Recipes** are templates that define multiple resources to create together. One PUT to `/instances` creates cells, propagators, and other resources defined in the recipe.

**Instances** track what resources were created from a recipe, enabling clean deletion.

## Defining a Recipe

```javascript
await bl.put(
  'bl:///recipes/counter-dashboard',
  {},
  {
    description: 'Counter with formatted display',
    params: {
      name: { type: 'string', required: true },
      initial: { type: 'number', default: 0 },
    },
    resources: [
      {
        id: 'count',
        uri: 'bl:///cells/${name}',
        body: { lattice: 'counter' },
        init: '${initial}',
      },
      {
        id: 'display',
        uri: 'bl:///cells/${name}-display',
        body: { lattice: 'lww' },
      },
      {
        id: 'formatter',
        uri: 'bl:///propagators/${name}-format',
        body: {
          inputs: ['${ref.count}'],
          output: '${ref.display}',
          handler: 'format',
          handlerConfig: { template: 'Count: {0}' },
        },
      },
    ],
  }
)
```

## Template Substitution

- `${paramName}` - Substitutes parameter value
- `${ref.id}` - Substitutes created resource URI by local id

Resources are created in array order. Dependencies must come first.

## Instantiating a Recipe

```javascript
await bl.put(
  'bl:///instances/page-views',
  {},
  {
    recipe: 'bl:///recipes/counter-dashboard',
    params: { name: 'page-views', initial: 0 },
  }
)
```

This creates:

- `bl:///cells/page-views` (counter cell)
- `bl:///cells/page-views-display` (display cell)
- `bl:///propagators/page-views-format` (formatter)

## Querying Instances

```javascript
// Get instance info
const info = await bl.get('bl:///instances/page-views')
// → {
//   recipe: 'bl:///recipes/counter-dashboard',
//   params: { name: 'page-views', initial: 0 },
//   createdResources: [
//     { id: 'count', uri: 'bl:///cells/page-views' },
//     { id: 'display', uri: 'bl:///cells/page-views-display' },
//     { id: 'formatter', uri: 'bl:///propagators/page-views-format' }
//   ],
//   state: 'active',
//   createdAt: '2024-...'
// }
```

## Deleting Instances

```javascript
await bl.put('bl:///instances/page-views/delete', {}, {})
```

Deletes all created resources in reverse order (propagators before cells).

## Routes

| Route                     | Method | Description                   |
| ------------------------- | ------ | ----------------------------- |
| `/recipes`                | GET    | List all recipes              |
| `/recipes/:name`          | GET    | Get recipe definition         |
| `/recipes/:name`          | PUT    | Create/update recipe          |
| `/recipes/:name/delete`   | PUT    | Delete recipe                 |
| `/instances`              | GET    | List all instances            |
| `/instances/:name`        | GET    | Get instance info             |
| `/instances/:name`        | PUT    | Create instance from recipe   |
| `/instances/:name/delete` | PUT    | Delete instance and resources |

## Plumber Events

Events are dispatched when recipes and instances change:

- `bl:///types/recipe-saved` - Recipe created/updated
- `bl:///types/recipe-deleted` - Recipe deleted
- `bl:///types/instance-created` - Instance instantiated
- `bl:///types/instance-deleted` - Instance killed

Default ports: `recipe-changes`, `instance-changes`

```javascript
bl._plumber.listen('instance-changes', (msg) => {
  console.log('Instance event:', msg.headers.type, msg.uri)
})
```

## Dynamic Installation

Install via the daemon's module system:

```javascript
await bl.put(
  'bl:///install/recipes',
  {},
  {
    path: './packages/recipes/src/upgrade.js',
  }
)
// Registers: bl._recipes
// Requires: bl._plumber (optional)
```

## Related

- [@bassline/cells](../cells) - Lattice-based cells
- [@bassline/propagators](../propagators) - Reactive propagators
- [@bassline/monitors](../monitors) - URL polling gadget (similar pattern)
