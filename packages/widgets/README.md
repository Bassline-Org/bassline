# @bassline/widgets

Widget registry and compiler for Bassline UI.

## Overview

Widgets are UI components stored as resources. This package provides:

- **Registry** - Storage for primitives and custom widget definitions
- **Compiler** - Compiles Hiccup-style definitions into render trees
- **Routes** - REST API for widget definitions at `bl:///widgets/*`
- **Instances** - UI instance management at `bl:///ui/*`

## Installation

Widgets are installed during bootstrap:

```javascript
// apps/cli/src/bootstrap.js
await bl.put(
  'bl:///install/widgets',
  {},
  {
    path: './packages/widgets/src/upgrade.js',
  }
)
```

## Widget Types

### Primitives

Platform-specific implementations registered by renderers (React, Solid, etc.):

- **Layout**: `box`, `stack`, `grid`, `scroll`, `center`
- **Atoms**: `text`, `heading`, `button`, `input`, `checkbox`, `select`, `badge`, `spinner`, `divider`

### Custom Widgets

Compositions defined using Hiccup syntax:

```javascript
// Create a custom widget
await bl.put(
  'bl:///widgets/save-button',
  {},
  {
    definition: ['button', { label: 'Save', variant: 'primary', onClick: 'save-clicked' }],
  }
)
```

## Hiccup Syntax

Widgets use array notation: `[widgetName, props?, ...children]`

```javascript
// Simple element
;['button', { label: 'Click me' }][
  // With children
  ('stack',
  { direction: 'vertical', gap: 16 },
  ['heading', { level: 1, content: 'Title' }],
  ['text', { content: 'Description' }],
  ['button', { label: 'Submit' }])
][
  // Props interpolation - $propName replaced with parent props
  ('button', { label: '$buttonLabel', onClick: '$onSubmit' })
][
  // Reference another widget by URI
  ('bl:///widgets/my-button', { label: 'Custom' })
]
```

## Widget Routes

```javascript
// List all widgets
await bl.get('bl:///widgets')
// → { headers: { type: 'directory' }, body: { entries: [...] } }

// Get widget info
await bl.get('bl:///widgets/button')

// Get widget definition
await bl.get('bl:///widgets/my-widget/definition')

// Create/update custom widget
await bl.put('bl:///widgets/my-widget', {}, {
  definition: ['stack', ...],
  props: { title: { type: 'string' } },
  description: 'My custom widget'
})

// Delete custom widget
await bl.put('bl:///widgets/my-widget/delete', {}, {})
```

## UI Instances

Instances are live widget resources with state management.

### Creating Instances

```javascript
// Create with inline definition
await bl.put('bl:///ui/my-app', {}, {
  definition: ['stack', { direction: 'vertical' },
    ['heading', { content: 'My App' }]
  ]
})

// Create referencing a widget
await bl.put('bl:///ui/sidebar', {}, {
  widget: 'bl:///widgets/nav-menu',
  widgetConfig: { items: [...] }
})
```

### Instance Sub-Resources

Each instance exposes:

| Sub-Resource | Method | Description           |
| ------------ | ------ | --------------------- |
| `/state`     | GET    | Get instance state    |
| `/state`     | PUT    | Update state (merges) |
| `/props`     | GET    | Get instance props    |
| `/ctl`       | PUT    | Send control commands |
| `/children`  | GET    | List child instances  |
| `/delete`    | PUT    | Delete the instance   |

### Control Commands

```javascript
// Reset state to empty
await bl.put('bl:///ui/form/ctl', {}, { command: 'reset' })

// Set specific state keys
await bl.put('bl:///ui/form/ctl', {}, { command: 'setState', name: 'Bob', count: 5 })

// UI commands (dispatched to renderer via plumber)
await bl.put('bl:///ui/input/ctl', {}, { command: 'focus' })
await bl.put('bl:///ui/input/ctl', {}, { command: 'blur' })
await bl.put('bl:///ui/element/ctl', {}, { command: 'scrollIntoView' })
```

## Registry API

Access via `bl.getModule('widgets')`:

```javascript
const widgets = await bl.getModule('widgets')

// Register a primitive (done by platform renderer)
widgets.registerPrimitive('button', {
  type: 'bl:///types/widgets/atom/button',
  props: { label: { type: 'string' } },
  render: (props) => <button>{props.label}</button>,
})

// Register a custom widget
widgets.registerCustom('bl:///widgets/my-button', {
  definition: ['button', { label: 'Custom', variant: 'primary' }],
})

// Get widget (async, with late binding)
const buttonDef = await widgets.get('bl:///widgets/button')

// Get widget (sync, returns null if not found)
const buttonSync = widgets.getSync('bl:///widgets/button')

// Check existence
widgets.has('bl:///widgets/button') // true
widgets.isPrimitive('bl:///widgets/button') // true

// List widgets
widgets.listAll() // ['bl:///widgets/button', ...]
widgets.listPrimitives() // primitive URIs
widgets.listCustom() // custom URIs
```

## Compiler API

```javascript
const widgets = await bl.getModule('widgets')

// Compile definition to render tree
const tree = widgets.compile([
  'stack',
  { gap: 8 },
  ['text', { content: 'Hello' }],
  ['button', { label: 'Click' }],
])
// → { type: 'primitive', widget: 'bl:///widgets/stack', props: { gap: 8 }, children: [...] }
```

### Render Tree Structure

```javascript
{
  type: 'primitive' | 'custom' | 'text' | 'error',
  widget: 'bl:///widgets/...',  // widget URI
  props: { ... },                // resolved props
  children: [ ... ],             // child render nodes
  slotChildren: [ ... ]          // extra children passed to custom widget
}
```

## Plumber Events

Instances dispatch events through plumber:

- `ui-instance-updated` - When instance is created/updated
- `ui-state-changed` - When instance state changes
- `ui-instance-deleted` - When instance is deleted
- `ui-control` - UI control commands (focus, blur, etc.)

```javascript
// Listen for state changes
bl._plumber.addRule('track-state', {
  match: { port: 'ui-state-changed' },
  to: 'state-tracker',
})
```

## Dynamic Installation

```javascript
import installWidgets from '@bassline/widgets'

const bl = new Bassline()
installWidgets(bl)

// Widgets module now available
const widgets = await bl.getModule('widgets')
```
