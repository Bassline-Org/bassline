# @bassline/ui

A React component library for contextual, object-centric inspection and navigation.

> **Inspired by [Glamorous Toolkit](https://gtoolkit.com) by [Feenk](https://feenk.com)**
>
> This library is a React implementation of concepts pioneered by Tudor Gîrba and the Feenk team. Their work on [moldable development](https://moldabledevelopment.com) has profoundly shaped how we think about tools and interfaces. We encourage you to explore and support Glamorous Toolkit.

## Philosophy

Software systems have no canonical form. The files aren't the system. The types aren't the system. And the documentation definitely isn't the system.

There is no single view captures "the truth" of what a system looks like.

So to create humane and explainable systems, we must embrace this fact.

**Moldable development** does exactly this by making custom tools cheap to make. Instead of one general inspector that shows everything the same way, we build many small, contextual views, that each answer a specific question about the system we are observing. When creating a view takes minutes instead of days, this becomes easier than fumbling around, playing interpreter as you read line by line.

- **Many lenses, not one** — Understanding comes from having the right view for the current context
- **Cheap to create** — Views are so easy to make that they become disposable, built for the moment
- **Living objects** — Views aren't static pictures; they're interactive objects you can inspect, compose, and navigate
- **Decision support** — The goal isn't observation but enabling meaningful action

This library provides React primitives for this approach:

- **Views** — Contextual visualizations attached to objects
- **Tools** — Complete applications for specific interactions
- **Actions** — Buttons that trigger object-specific behaviors
- **Panes** — Miller columns for navigating object graphs

## Installation

```bash
npm install @bassline/ui
# or
pnpm add @bassline/ui
```

## Quick Start

```tsx
import { phlowViews, phlow, InspectorProvider, PaneContainer, useInspect } from '@bassline/ui'

// Define how your class presents itself
class Person {
  constructor(
    public name: string,
    public age: number,
    public friends: Person[] = []
  ) {}

  [phlowViews] = [
    // Primary view: key-value pairs
    () =>
      phlow.info({
        title: 'Info',
        priority: 10,
        entries: {
          Name: () => ({ text: this.name }),
          Age: () => ({ text: String(this.age) }),
        },
      }),

    // Secondary view: list of friends
    () =>
      phlow.list({
        title: 'Friends',
        priority: 20,
        items: () => this.friends,
        text: friend => friend.name,
        send: friend => friend, // clicking opens friend in new pane
      }),
  ]
}

// Use in your app
function App() {
  const inspect = useInspect()
  const alice = new Person('Alice', 30)

  return (
    <InspectorProvider>
      <button onClick={() => inspect(alice, 'Alice')}>Inspect Alice</button>
      <PaneContainer />
    </InspectorProvider>
  )
}
```

## Core Concepts

### Views

Views are contextual visualizations. Objects declare their views using the `phlowViews` symbol.

```tsx
import { phlowViews, phlow, PRIORITY } from '@bassline/ui'

class DataSet {
  data = ([
    /* ... */
  ][phlowViews] = [
    // Factory functions produce views lazily
    () =>
      phlow.columnedList({
        title: 'Table',
        priority: PRIORITY.high,
        items: () => this.data,
        columns: {
          id: { text: row => row.id },
          value: { text: row => String(row.value) },
        },
        send: row => row, // drill down into row
      }),

    () =>
      phlow.explicit({
        title: 'Chart',
        priority: PRIORITY.med,
        component: () => <BarChart data={this.data} />,
      }),
  ])
}
```

#### View Types

| Factory                                          | Description                 |
| ------------------------------------------------ | --------------------------- |
| `phlow.empty()`                                  | Placeholder/null view       |
| `phlow.forward({ view })`                        | Delegates to another view   |
| `phlow.list({ items, text, send? })`             | Simple vertical list        |
| `phlow.columnedList({ items, columns, send? })`  | Table with multiple columns |
| `phlow.info({ entries })`                        | Key-value pairs display     |
| `phlow.textEditor({ text, onBlur?, onChange? })` | Editable text area          |
| `phlow.explicit({ component })`                  | Custom React component      |
| `phlow.descriptor({ schema, model, onUpdate? })` | Form with validation        |

#### Priority

Views are sorted by priority (lower = shown first). Use the `PRIORITY` constants:

```tsx
import { PRIORITY } from '@bassline/ui'

PRIORITY.high // 10 - Primary views
PRIORITY.med // 50 - Important but secondary
PRIORITY.low // 100 - Fallback views
```

### Tools

Tools are complete applications for interacting with an object. The inspector is the default tool, but objects can define additional tools.

```tsx
import { phlowTools, tool } from '@bassline/ui'

class AudioFile {
  constructor(public path: string) {}

  [phlowTools] = [
    () =>
      tool.window({
        title: 'Player',
        icon: '🎵',
        component: ({ target }) => <AudioPlayer src={target.path} />,
      }),

    // Conditional tools
    () => (this.hasLyrics() ? tool.window({ title: 'Lyrics', component: LyricsView }) : tool.empty()),
  ]
}
```

#### Tool Types

| Factory                                    | Description                         |
| ------------------------------------------ | ----------------------------------- |
| `tool.empty()`                             | Null tool (for conditional display) |
| `tool.window({ title, component, icon? })` | Complete application view           |

### Actions

Actions are buttons that appear in the inspector header and trigger behaviors.

```tsx
import { phlowActions, action } from '@bassline/ui'

class Document {
  [phlowActions] = [
    () =>
      action.button({
        label: 'Save',
        icon: '💾',
        tooltip: 'Save document',
        onClick: async () => await this.save(),
      }),

    () =>
      action.button({
        label: 'Delete',
        icon: '🗑️',
        enabled: () => !this.isReadOnly,
        onClick: () => this.delete(),
      }),
  ]
}
```

#### Action Types

| Factory                                                        | Description                           |
| -------------------------------------------------------------- | ------------------------------------- |
| `action.empty()`                                               | Null action (for conditional display) |
| `action.button({ label, onClick, icon?, tooltip?, enabled? })` | Clickable button                      |

### Panes (Miller Columns)

The pane system implements Miller columns navigation. Each inspection opens a new pane to the right. Users can navigate, maximize, and close panes.

```tsx
import { InspectorProvider, PaneContainer } from '@bassline/ui'

function Explorer() {
  return (
    <InspectorProvider>
      <PaneContainer paneWidth={400} autoScrollToNew={true} emptyMessage="Click an item to inspect" />
    </InspectorProvider>
  )
}
```

## API Reference

### Hooks

```tsx
// Trigger inspection
const inspect = useInspect()
inspect(object, 'label')

// Read current inspector state
const chain = useInspectorChain()
// { panes: PaneState[], focusedPaneIndex: number }

// Get views for an object
const views = useViews(object)

// Get tools for an object
const tools = useTools(object)

// Get actions for an object
const actions = useActions(object)
```

### State Atoms (Advanced)

For advanced use cases, atoms are exposed directly:

```tsx
import {
  inspectorChainAtom, // Main state
  inspectAtom, // Action: open new pane
  closePaneAtom, // Action: close pane by index
  focusPaneAtom, // Action: focus pane by index
  navigateFocusAtom, // Action: move focus left/right
  selectToolAtom, // Action: select tool in pane
  toggleMaximizeAtom, // Action: maximize/restore pane
  maximizedPaneIdAtom, // Derived: currently maximized pane
} from '@bassline/ui'
```

### Inheritance Control

By default, views/tools/actions inherit from the prototype chain. Control this per-object:

```tsx
import { phlowInheritViews, phlowInheritActions, phlowInheritTools } from '@bassline/ui'

class Child extends Parent {
  // Don't inherit parent's views
  [phlowInheritViews] = (false[phlowViews] = [
    // Only these views will be shown
  ])
}
```

## Customization

### Component Provider

Override default UI components to match your design system:

```tsx
import { ComponentProvider } from '@bassline/ui'
import { Button, Card, Table } from './my-components'

function App() {
  return (
    <ComponentProvider
      components={{
        Button,
        Card,
        Table,
        // ... other overrides
      }}
    >
      <InspectorProvider>
        <PaneContainer />
      </InspectorProvider>
    </ComponentProvider>
  )
}
```

### Keyboard Navigation

The pane container handles keyboard navigation:

| Key             | Action              |
| --------------- | ------------------- |
| `←` Arrow Left  | Focus previous pane |
| `→` Arrow Right | Focus next pane     |
| `Escape`        | Close focused pane  |

#### Bypassing Keyboard Capture

When using text inputs inside panes, you may want arrow keys to work normally (move cursor) rather than navigate panes. The `isTextInputElement` check handles this automatically for:

- `<textarea>`
- `<input type="text|search|url|tel|email|password|number">`
- `contenteditable` elements

For other elements that need keyboard input, add the `nocapture` class:

```tsx
import { KEYBOARD_NOCAPTURE } from '@bassline/ui'

// Keyboard events won't be captured by pane navigation
;<div className={KEYBOARD_NOCAPTURE}>
  <MyCustomEditor />
</div>
```

The check walks up the DOM tree, so adding `nocapture` to a container protects all children.

## Roadmap

### Contextual Search (Planned)

A key capability in Glamorous Toolkit is contextual search: search results are views, not strings. Each result knows how to present itself, and searches can span multiple object types with per-type rendering.

```tsx
// Future API (not yet implemented)
const results = await search('config', {
  searchers: [
    fileSearcher, // Files show path + preview
    functionSearcher, // Functions show signature + docstring
    configSearcher, // Configs show key-value pairs
  ],
})

// Each result renders using its own views
```

## Inspiration & Credits

This library implements (shamelessly stole) ideas from **[Glamorous Toolkit](https://gtoolkit.com)** by **[Feenk](https://feenk.com)**.

We've adapted their concepts for React, with some modifications since the js object model is much less sophisticated than Smalltalk.

Explore the original:

- [Glamorous Toolkit](https://gtoolkit.com) — Download and try it
- [Feenk](https://feenk.com) — The company behind GT
- [Moldable Development](https://moldabledevelopment.com) — The philosophy
- [Tudor Gîrba's talks](https://www.youtube.com/results?search_query=tudor+girba+moldable) — Deep dives into the concepts

Thank you to Tudor Gîrba and the Feenk team!

## License

AGPL-3.0
