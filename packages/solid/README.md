# @bassline/solid

SolidJS bindings for Bassline.

## Overview

Provides Solid.js primitives for building reactive UIs with Bassline:

- **Context** - `BasslineProvider` and `useBassline` for instance access
- **Resources** - `useResource` and `useLiveResource` for data fetching
- **Cells** - `useCell` for bidirectional cell sync
- **State** - `useTmpState` for ephemeral UI state
- **Plumber** - `usePlumberRule` for reactive message rules
- **WebSocket** - `WebSocketProvider` for live updates

## Installation

```bash
pnpm add @bassline/solid
```

## Setup

```jsx
import { Bassline } from '@bassline/core'
import { createRemoteRoutes } from '@bassline/remote-browser'
import { BasslineProvider, WebSocketProvider } from '@bassline/solid'

const bl = new Bassline()
bl.install(createRemoteRoutes())

function App() {
  return (
    <BasslineProvider value={bl}>
      <WebSocketProvider url="ws://localhost:9111/ws">
        <MyApp />
      </WebSocketProvider>
    </BasslineProvider>
  )
}
```

## Hooks

### useBassline

Access the Bassline instance.

```jsx
import { useBassline } from '@bassline/solid'

function MyComponent() {
  const bl = useBassline()

  const handleClick = async () => {
    await bl.put('bl:///cells/counter/value', {}, 42)
  }

  return <button onClick={handleClick}>Set Value</button>
}
```

### useResource

Fetch a resource by URI.

```jsx
import { useResource } from '@bassline/solid'

function UserProfile(props) {
  const { data, loading, error, refetch } = useResource(() => `bl:///data/users/${props.userId}`)

  return (
    <Show when={!loading()} fallback={<div>Loading...</div>}>
      <Show when={error()} fallback={<div>{data()?.name}</div>}>
        <div>Error: {error().message}</div>
      </Show>
    </Show>
  )
}
```

### useLiveResource

Resource with WebSocket subscription for live updates.

```jsx
import { useLiveResource } from '@bassline/solid'

function LiveCounter() {
  const { data, loading, isLive } = useLiveResource(() => 'bl:///cells/counter')

  return (
    <div>
      <span>{data()?.value ?? 0}</span>
      {isLive() && <span class="live-indicator" />}
    </div>
  )
}
```

### useWrite

Write to a resource.

```jsx
import { useResource, useWrite } from '@bassline/solid'

function Counter() {
  const { data } = useResource(() => 'bl:///cells/counter')
  const write = useWrite(() => 'bl:///cells/counter/value')

  return (
    <button onClick={() => write((data()?.value || 0) + 1)}>Count: {data()?.value || 0}</button>
  )
}
```

### useCell

Bidirectional sync with a Bassline cell.

Creates a tmp/state proxy with plumber rules that bridge to the cell:

- Cell changes sync to UI
- UI changes sync to cell

```jsx
import { useCell } from '@bassline/solid'

function Counter() {
  const [count, setCount, { synced }] = useCell('counter')

  return (
    <div>
      <span>{count() ?? 0}</span>
      {!synced() && <span class="syncing">...</span>}
      <button onClick={() => setCount((c) => (c ?? 0) + 1)}>+</button>
      <button onClick={() => setCount((c) => (c ?? 0) - 1)}>-</button>
    </div>
  )
}
```

### useTmpState

Ephemeral state that syncs with the server.

External systems (CLI, Claude, other UIs) can read/write this state and the component updates automatically.

```jsx
import { useTmpState } from '@bassline/solid'

function EditorPanel() {
  const [mode, setMode, { synced, reset }] = useTmpState('editor/mode', 'edit')

  return (
    <div>
      <select value={mode()} onChange={(e) => setMode(e.target.value)}>
        <option value="edit">Edit</option>
        <option value="view">View</option>
      </select>
      {!synced() && <span>Saving...</span>}
      <button onClick={reset}>Reset</button>
    </div>
  )
}
```

### usePlumberRule

Create a plumber rule that's cleaned up on component unmount.

```jsx
import { usePlumberRule } from '@bassline/solid'

function NotificationListener() {
  // Rule: when 'user-action' port fires, forward to notifications handler
  usePlumberRule('user-notifications', { port: 'user-action' }, 'bl:///handlers/notifications')

  return <div>Listening for user actions...</div>
}
```

### useHotkey

Keyboard shortcut handler.

```jsx
import { useHotkey } from '@bassline/solid'

function Editor() {
  useHotkey('s', () => save(), { meta: true }) // Cmd+S / Ctrl+S
  useHotkey('Escape', () => closePanel())

  return <div>...</div>
}
```

## Providers

### BasslineProvider

Provides Bassline instance to child components.

```jsx
<BasslineProvider value={bl}>
  <App />
</BasslineProvider>
```

### WebSocketProvider

Provides WebSocket connection with auto-reconnect.

```jsx
<WebSocketProvider url="ws://localhost:9111/ws">
  <App />
</WebSocketProvider>
```

Access via `useWebSocket()`:

```jsx
const ws = useWebSocket()
if (ws?.readyState === WebSocket.OPEN) {
  ws.send(JSON.stringify({ type: 'subscribe', uri: 'bl:///cells/counter' }))
}
```

## Exports

```javascript
// Context
export { BasslineProvider, useBassline }
export { WebSocketProvider, useWebSocket }

// Resource hooks
export { useResource, useWrite, useLiveResource }

// State hooks
export { useCell } from './hooks/useCell.js'
export { useTmpState } from './hooks/useTmpState.js'
export { usePlumberRule } from './hooks/usePlumberRule.js'

// Utilities
export { useHotkey }
```
