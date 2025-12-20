# @bassline/remote

WebSocket client for connecting to remote Bassline servers.

## Install

```bash
pnpm add @bassline/remote
```

## Usage

```javascript
import { createRemote } from '@bassline/remote'

const remote = createRemote()

// Connect to a remote server
await remote.put(
  { path: '/server1' },
  {
    uri: 'ws://localhost:9112',
  }
)

// Check connection status
const status = await remote.get({ path: '/server1' })
// → { body: { name: 'server1', uri: 'ws://...', status: 'connected' } }

// Proxy requests to remote server
const user = await remote.get({ path: '/server1/proxy/users/alice' })
// Proxies to /users/alice on the remote server

await remote.put({ path: '/server1/proxy/users/bob' }, { name: 'Bob' })
// Proxies PUT to /users/bob on the remote server

// Close connection
await remote.put({ path: '/server1/close' }, {})
```

## How It Works

1. Create a connection with a name and WebSocket URI
2. Use `/name/proxy/...` to proxy requests to the remote
3. Requests are serialized as JSON over WebSocket
4. Responses are returned as normal `{ headers, body }`

## Routes

| Route            | Method | Description                 |
| ---------------- | ------ | --------------------------- |
| `/`              | GET    | List all connections        |
| `/:name`         | GET    | Connection status           |
| `/:name`         | PUT    | Create connection `{ uri }` |
| `/:name/close`   | PUT    | Close connection            |
| `/:name/proxy/*` | GET    | Proxy GET to remote         |
| `/:name/proxy/*` | PUT    | Proxy PUT to remote         |

## Browser Usage

Works in browsers with the native WebSocket:

```javascript
import { createRemote } from '@bassline/remote'

const remote = createRemote()

await remote.put({ path: '/api' }, { uri: 'wss://api.example.com' })
const data = await remote.get({ path: '/api/proxy/data' })
```

## Custom WebSocket

Pass a custom WebSocket constructor for Node.js or testing:

```javascript
import WebSocket from 'ws'
import { createRemote } from '@bassline/remote'

const remote = createRemote({ WebSocket })
```

## Related

- [@bassline/core](../core) - Resource primitives
- [@bassline/node](../node) - WebSocket server
