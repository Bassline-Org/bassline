# @bassline/ui-web

React-based widget renderer for Bassline.

## Overview

This package provides React implementations of widget primitives and renderers:

- **Layout Primitives** - Box, Stack, Grid, Scroll, Center
- **Atom Primitives** - Text, Heading, Button, Input, Checkbox, Select, etc.
- **WidgetRenderer** - Renders Hiccup definitions using registered primitives
- **RootRenderer** - Subscribes to `bl:///ui/root` for top-level rendering

## Installation

```bash
pnpm add @bassline/ui-web
```

## Setup

Register primitives with the widget registry:

```javascript
import { setupUIWeb } from '@bassline/ui-web'

// After Bassline is initialized with widgets module
const { registry, compile } = await setupUIWeb(bl)
```

Or register primitives manually:

```javascript
import { registerWebPrimitives } from '@bassline/ui-web'

const widgets = await bl.getModule('widgets')
registerWebPrimitives(widgets.registry)
```

## Layout Primitives

### Box

Basic container element.

```javascript
;[
  'box',
  { style: { padding: 16, background: '#f0f0f0' }, className: 'my-box' },
  ['text', { content: 'Content' }],
]
```

### Stack

Flexbox layout with direction and spacing.

| Prop        | Type                         | Default      | Description          |
| ----------- | ---------------------------- | ------------ | -------------------- |
| `direction` | `'horizontal' \| 'vertical'` | `'vertical'` | Flex direction       |
| `gap`       | `number`                     | `0`          | Gap between children |
| `align`     | `string`                     | -            | align-items          |
| `justify`   | `string`                     | -            | justify-content      |

```javascript
;[
  'stack',
  { direction: 'horizontal', gap: 8 },
  ['button', { label: 'Save' }],
  ['button', { label: 'Cancel' }],
]
```

### Grid

CSS Grid layout.

| Prop      | Type     | Description           |
| --------- | -------- | --------------------- |
| `columns` | `string` | grid-template-columns |
| `rows`    | `string` | grid-template-rows    |
| `gap`     | `number` | grid-gap              |

```javascript
;[
  'grid',
  { columns: '1fr 1fr 1fr', gap: 16 },
  ['box', {}, ['text', { content: 'Cell 1' }]],
  ['box', {}, ['text', { content: 'Cell 2' }]],
  ['box', {}, ['text', { content: 'Cell 3' }]],
]
```

### Scroll

Scrollable container.

| Prop        | Type                                   | Default      | Description      |
| ----------- | -------------------------------------- | ------------ | ---------------- |
| `direction` | `'horizontal' \| 'vertical' \| 'both'` | `'vertical'` | Scroll direction |
| `maxHeight` | `string \| number`                     | -            | Maximum height   |

### Center

Centers children both horizontally and vertically.

```javascript
;['center', {}, ['spinner', {}]]
```

## Atom Primitives

### Text

Text content display.

| Prop      | Type                                       | Default  | Description     |
| --------- | ------------------------------------------ | -------- | --------------- |
| `content` | `string`                                   | -        | Text to display |
| `variant` | `'body' \| 'caption' \| 'label' \| 'code'` | `'body'` | Text style      |

### Heading

Heading elements (h1-h6).

| Prop      | Type     | Default | Description   |
| --------- | -------- | ------- | ------------- |
| `level`   | `1-6`    | `1`     | Heading level |
| `content` | `string` | -       | Heading text  |

### Button

Clickable button with event dispatch.

| Prop       | Type                                            | Default     | Description                   |
| ---------- | ----------------------------------------------- | ----------- | ----------------------------- |
| `label`    | `string`                                        | -           | Button text                   |
| `variant`  | `'default' \| 'primary' \| 'danger' \| 'ghost'` | `'default'` | Button style                  |
| `disabled` | `boolean`                                       | `false`     | Disabled state                |
| `onClick`  | `string`                                        | -           | Plumber port for click events |

```javascript
;['button', { label: 'Submit', variant: 'primary', onClick: 'form-submit' }]
```

### Input

Text input with change events.

| Prop          | Type      | Default  | Description              |
| ------------- | --------- | -------- | ------------------------ |
| `value`       | `string`  | -        | Current value            |
| `placeholder` | `string`  | -        | Placeholder text         |
| `type`        | `string`  | `'text'` | Input type               |
| `disabled`    | `boolean` | `false`  | Disabled state           |
| `onChange`    | `string`  | -        | Plumber port for changes |
| `onBlur`      | `string`  | -        | Plumber port for blur    |

### Other Atoms

- **Checkbox** - `{ checked, disabled, onChange }`
- **Select** - `{ value, options, disabled, onChange }`
- **Badge** - `{ content, variant }`
- **Spinner** - `{ size }`
- **Divider** - `{ orientation }`

## WidgetRenderer

Renders Hiccup definitions using the widget registry.

```jsx
import { WidgetRenderer, WidgetProvider } from '@bassline/ui-web'

function App() {
  const definition = [
    'stack',
    { gap: 16 },
    ['heading', { content: 'Hello' }],
    ['button', { label: 'Click', onClick: 'clicked' }],
  ]

  return (
    <WidgetProvider registry={registry} compile={compile} bl={bl}>
      <WidgetRenderer definition={definition} instanceUri="bl:///ui/my-app" />
    </WidgetProvider>
  )
}
```

### Widget Component

Shorthand for rendering within a WidgetProvider:

```jsx
import { Widget } from '@bassline/ui-web'

// Inside a WidgetProvider
;<Widget definition={['button', { label: 'Click' }]} />
```

## RootRenderer

Subscribes to `bl:///ui/root` and renders the content.

```jsx
import { RootRenderer } from '@bassline/ui-web'

function App() {
  return <RootRenderer bl={bl} registry={registry} compile={compile} />
}
```

The root resource can contain:

```javascript
// URI reference
await bl.put('bl:///ui/root', {}, { content: 'bl:///ui/app' })

// Inline definition
await bl.put(
  'bl:///ui/root',
  {},
  {
    definition: ['stack', {}, ['heading', { content: 'App' }]],
  }
)
```

## Event Dispatching

UI events dispatch through plumber:

```javascript
// Button click dispatches to port specified in onClick
;['button', { label: 'Save', onClick: 'save-clicked' }][
  // → bl.plumb('bl:///ui/instance', 'save-clicked', { body: { source: '...' } })

  // Input changes dispatch value
  ('input', { onChange: 'email-changed' })
]
// → bl.plumb('bl:///ui/instance', 'email-changed', { body: { value: '...', source: '...' } })
```

Listen for events:

```javascript
bl._plumber.addRule('handle-save', {
  match: { port: 'save-clicked' },
  to: 'save-handler',
})

bl._plumber.listen('save-handler', (msg) => {
  console.log('Save clicked from:', msg.body.source)
})
```

## Exports

```javascript
// Setup
export { setupUIWeb, registerWebPrimitives }

// Primitives
export { registerLayoutPrimitives } from './primitives/layout.jsx'
export { registerAtomPrimitives, createEventDispatcher } from './primitives/atoms.jsx'

// Components
export { WidgetRenderer, WidgetProvider, Widget, WidgetContext } from './WidgetRenderer.jsx'
export { RootRenderer, InstanceRenderer } from './RootRenderer.jsx'
```
