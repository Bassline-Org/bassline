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
- **Actions** — Buttons that trigger object-specific behaviors
- **Search** — Declarative, query-parameterized search sources attached to objects
- **Panes** — Miller columns for navigating object graphs

## Installation

```bash
npm install @bassline/ui
# or
pnpm add @bassline/ui
```

## Quick Start

```tsx
import { phlowViews, views, PRIORITY, InspectorProvider, PaneContainer, useInspector, inspect } from '@bassline/ui'

// Define how your class presents itself
class Person {
  constructor(
    public name: string,
    public age: number,
    public friends: Person[] = []
  ) {}

  // Attach views using the fluent builder
  [phlowViews] = views<Person>()
    .info(self => ({
      title: 'Info',
      priority: PRIORITY.high,
      entries: {
        Name: () => ({ text: self.name }),
        Age: () => ({ text: String(self.age) }),
      },
    }))
    .list(self => ({
      title: 'Friends',
      priority: PRIORITY.med,
      items: () => self.friends,
      text: friend => friend.name,
      send: friend => friend, // clicking opens friend in new pane
    }))
}

// Use in your app
function App() {
  const { inspectRoot } = useInspector()
  const alice = new Person('Alice', 30)

  return (
    <InspectorProvider>
      <button onClick={() => inspectRoot(inspect(alice)!)}>Inspect Alice</button>
      <PaneContainer paneWidth={400} />
    </InspectorProvider>
  )
}
```

## Core Concepts

### Views

Views are contextual visualizations. Objects declare their views using the `phlowViews` symbol and the `views<T>()` fluent builder.

```tsx
import { phlowViews, views, PRIORITY } from '@bassline/ui'

class DataSet {
  data: Array<{ id: string; value: number }> = ([][phlowViews] = views<DataSet>()
    .columnedList(self => ({
      title: 'Table',
      priority: PRIORITY.high,
      items: () => self.data,
      columns: {
        id: { text: row => row.id },
        value: { text: row => String(row.value) },
      },
      send: row => row, // drill down into row
    }))
    .explicit(self => ({
      title: 'Chart',
      priority: PRIORITY.med,
      component: () => <BarChart data={self.data} />,
    }))
    .panel(self => ({
      title: 'Dashboard',
      component: onInspect => <Dashboard data={self.data} onInspect={onInspect} />,
    })))
}
```

#### View Types

| Builder Method    | Description                                       |
| ----------------- | ------------------------------------------------- |
| `.info()`         | Key-value pairs display                           |
| `.list()`         | Simple vertical list                              |
| `.columnedList()` | Table with multiple columns                       |
| `.textEditor()`   | Editable text area                                |
| `.explicit()`     | Custom React component                            |
| `.descriptor()`   | Form with validation (Zod)                        |
| `.forward()`      | Delegates to another view                         |
| `.panel()`        | Full-pane component (shown via dropdown selector) |

Each view config takes `title`, `priority?` (defaults to `PRIORITY.low`), and type-specific fields.

#### Panels

Panels are full-pane components that replace the tab view area. When an object has both regular views and panels, the pane shows a dropdown selector to switch between "Inspector" (tab views) and each panel.

```tsx
.panel(self => ({
  title: 'Preview',
  component: (onInspect) => <Preview doc={self} onInspect={onInspect} />,
}))
```

The `component` receives an `onInspect` callback: `(target: unknown, label?: string) => void`.

#### Priority

Views are sorted by priority (lower = shown first). Use the `PRIORITY` constants:

```tsx
import { PRIORITY } from '@bassline/ui'

PRIORITY.high // 10 - Primary views
PRIORITY.med // 50 - Important but secondary
PRIORITY.low // 100 - Default (used when priority is omitted)
```

### Actions

Actions are buttons that appear in the pane header and trigger behaviors.

```tsx
import { phlowActions, actions } from '@bassline/ui'

class Document {
  text = (''[phlowActions] = actions<Document>()
    .button(self => ({
      label: 'Save',
      icon: '💾',
      tooltip: 'Save document',
      onClick: async () => await self.save(),
    }))
    .button(self => ({
      label: 'Delete',
      enabled: () => !self.isReadOnly,
      onClick: () => self.delete(),
    })))
}
```

Button config: `label`, `onClick`, `icon?`, `tooltip?`, `priority?`, `enabled?`.

If `onClick` returns a value (or a Promise that resolves to a value), the result is automatically inspected in a new pane.

### Search

Objects declare search sources using the `phlowSearches` symbol and the `searches<T>()` fluent builder. A search source is a query-parameterized list: `items(query)` returns matching items, `text(item)` labels them, `send(item)` gives the inspect target.

```tsx
import { phlowSearches, searches } from '@bassline/ui'

class TextDocument {
  text = (''[phlowSearches] = searches<TextDocument>()
    .source(self => ({
      title: 'Lines',
      items: query => self.text.split('\n').filter(l => l.toLowerCase().includes(query.toLowerCase())),
      text: line => line,
      send: line => ({ line, length: line.length }),
    }))
    .source(self => ({
      title: 'Words',
      items: query => [...new Set(self.text.split(/\s+/))].filter(w => w.toLowerCase().startsWith(query.toLowerCase())),
      text: word => word,
    })))
}
```

When an object has search sources, a search button appears in the pane header. Clicking it opens a text input; results replace the view content, grouped by source title. Clicking a result with a `send` function inspects the result. Escape closes search.

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

### Primitives and `inspect()`

The `inspect()` function wraps any JavaScript value into a `Viewable` object with appropriate views:

```tsx
import { inspect } from '@bassline/ui'

inspect('hello') // ViewableString with value, length, character list views
inspect(42) // ViewableNumber with value, hex, binary views
inspect(true) // ViewableBoolean
inspect([1, 2, 3]) // ViewableArray with items list, JSON views
inspect({ a: 1 }) // ViewableObject with properties, keys views
inspect(promise) // ViewablePromise with loading/resolved/rejected states
inspect(viewableObj) // Returns the object as-is if already Viewable
inspect(null) // Returns null
```

Objects that already implement `[phlowViews]` are returned directly. This is how you bridge plain values into the inspection system.

## API Reference

### Hooks

```tsx
// Main inspector navigation
const {
  panes, // InspectorPane[]
  paneCount, // number
  focusedPane, // InspectorPane | null
  focusedPaneIndex, // number
  currentPane, // InspectorPane | null
  inspect, // (target, breadcrumbLabel?) => void
  inspectRoot, // (target) => void — replaces all panes
  closeCurrent, // () => void
  clear, // () => void
  goBack, // () => void — focus previous pane
  goForward, // () => void — focus next pane
} = useInspector()

// Pane-specific controls
const { pane, selectView, close, focus } = usePane(paneId)

// Currently focused pane
const activePane = useActivePane()

// Inspection callback scoped to a source pane
const inspectFrom = useInspectFrom(sourcePaneId)

// Collect views/actions/searches from an object
const views = useViews(target) // PhlowView[]
const actions = useActions(target) // PhlowButtonAction[]
const searches = useSearches(target) // PhlowSearchSource[]

// Component registry access
const components = useComponents()
```

### State Atoms (Advanced)

For advanced use cases, Jotai atoms are exposed directly:

```tsx
import {
  inspectorChainAtom, // Main state
  inspectAtom, // Action: open new pane
  inspectRootAtom, // Action: replace with new root
  closePaneAtom, // Action: close pane by index
  closePaneByIdAtom, // Action: close pane by ID
  focusPaneAtom, // Action: focus pane by index
  navigateFocusAtom, // Action: move focus left/right
  selectViewAtom, // Action: select view tab in pane
  toggleMaximizeAtom, // Action: maximize/restore pane
  maximizedPaneIdAtom, // Derived: currently maximized pane
  clearChainAtom, // Action: clear all panes
  currentPaneAtom, // Derived: last pane
  focusedPaneAtom, // Derived: focused pane
  paneCountAtom, // Derived: number of panes
} from '@bassline/ui'
```

### Inheritance Control

By default, views inherit from the prototype chain. Control this per-object:

```tsx
import { phlowInheritViews } from '@bassline/ui'

class Child extends Parent {
  [phlowInheritViews] = false // Don't inherit parent's views

  [phlowViews] = views<Child>()
    .info(self => ({ ... }))
    // Only these views will be shown
}
```

Actions and search sources do **not** walk the prototype chain — they are always object-specific.

## Customization

### Component Overrides

Override default UI components to match your design system by passing them to `InspectorProvider`:

```tsx
import { InspectorProvider, PaneContainer } from '@bassline/ui'
import { Button, Card, CardHeader, CardTitle, CardContent, Table } from './my-components'

function App() {
  return (
    <InspectorProvider
      components={{
        Button,
        Card,
        CardHeader,
        CardTitle,
        CardContent,
        Table,
        // ... other overrides
      }}
    >
      <PaneContainer />
    </InspectorProvider>
  )
}
```

Overridable components: `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Button`, `Textarea`, `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `Form`.

### Keyboard Navigation

The pane container handles keyboard navigation:

| Key             | Action              |
| --------------- | ------------------- |
| `←` Arrow Left  | Focus previous pane |
| `→` Arrow Right | Focus next pane     |
| `Escape`        | Close focused pane  |

#### Bypassing Keyboard Capture

When using text inputs inside panes, arrow keys work normally (move cursor) rather than navigate panes. The `isTextInputElement` check handles this automatically for:

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
