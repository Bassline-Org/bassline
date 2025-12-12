# @bassline/react

React bindings for Bassline.

## Install

```bash
pnpm add @bassline/react
```

## Usage

```jsx
import { Bassline } from '@bassline/core'
import { createRemoteRoutes } from '@bassline/remote-browser'
import { BasslineProvider, useResource, useWrite } from '@bassline/react'

// Setup
const bl = new Bassline()
bl.install(createRemoteRoutes())

function App() {
  return (
    <BasslineProvider value={bl}>
      <UserProfile userId="alice" />
    </BasslineProvider>
  )
}

function UserProfile({ userId }) {
  const { data, loading, error } = useResource(`bl:///data/users/${userId}`)

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!data) return <div>Not found</div>

  return <div>{data.body.name}</div>
}
```

## Exports

### BasslineProvider

Context provider for Bassline instance.

```jsx
<BasslineProvider value={bl}>{children}</BasslineProvider>
```

### useBassline

Access the Bassline instance.

```jsx
const bl = useBassline()
const data = await bl.get('bl:///data/users/alice')
```

### useResource

Fetch a resource by URI.

```jsx
const { data, loading, error, refetch } = useResource(uri)
```

### useWrite

Write to a resource.

```jsx
const write = useWrite('bl:///data/counter')
await write({ value: 42 })
```

## Related

- [@bassline/core](../core) - Router and utilities
- [@bassline/remote-browser](../remote-browser) - WebSocket client for browsers
