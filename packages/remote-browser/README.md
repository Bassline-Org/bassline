# @bassline/remote-browser

WebSocket client for connecting to remote Bassline servers from browsers.

## Install

```bash
pnpm add @bassline/remote-browser
```

## Usage

```javascript
import { Bassline } from '@bassline/core'
import { createRemoteRoutes } from '@bassline/remote-browser'

const bl = new Bassline()
bl.install(createRemoteRoutes())

// Connect to a remote server, mount at /server1
await bl.put(
  'bl:///remote/ws/server1',
  {},
  {
    uri: 'ws://localhost:9112',
    mount: '/server1',
  }
)

// Access remote resources through the mount point
const user = await bl.get('bl:///server1/data/users/alice')
// Proxies to bl:///data/users/alice on the remote server

// Check connection status
const status = await bl.get('bl:///remote/ws/server1')
// { body: { status: 'connected', uri: 'ws://...', mount: '/server1' } }
```

## How It Works

1. Create a remote connection with a mount point
2. All requests to the mount point are forwarded over WebSocket
3. Remote URIs in responses are rewritten to include the mount prefix

## Routes

| Route              | Method | Description           |
| ------------------ | ------ | --------------------- |
| `/remote/ws`       | GET    | List connections      |
| `/remote/ws/:name` | GET    | Get connection status |
| `/remote/ws/:name` | PUT    | Create connection     |

## Related

- [@bassline/core](../core) - Router and utilities
- [@bassline/react](../react) - React bindings
- [@bassline/server-node](../server-node) - WebSocket server
