# @bassline/server-node

HTTP and WebSocket servers for Bassline (Node.js).

## Install

```bash
pnpm add @bassline/server-node
```

## Usage

```javascript
import { Bassline } from '@bassline/core'
import { createHttpServerRoutes, createWsServerRoutes } from '@bassline/server-node'

const bl = new Bassline()
bl.install(createHttpServerRoutes())
bl.install(createWsServerRoutes())

// Start HTTP server on port 9111
await bl.put('bl:///server/http/9111', {}, {})

// Start WebSocket server on port 9112
await bl.put('bl:///server/ws/9112', {}, {})
```

### HTTP Server

Exposes Bassline resources over HTTP.

```bash
# GET resource
curl "http://localhost:9111?uri=bl:///data/users/alice"

# PUT resource
curl -X PUT "http://localhost:9111?uri=bl:///data/users/alice" \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice"}'
```

### WebSocket Server

Real-time resource access and subscriptions.

```javascript
const ws = new WebSocket('ws://localhost:9112')

ws.send(JSON.stringify({
  id: 1,
  type: 'get',
  uri: 'bl:///data/users/alice'
}))

ws.onmessage = (event) => {
  const { id, result } = JSON.parse(event.data)
  console.log(result)
}
```

## Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/server/http` | GET | List HTTP servers |
| `/server/http/:port` | GET | Get server status |
| `/server/http/:port` | PUT | Start server |
| `/server/ws` | GET | List WebSocket servers |
| `/server/ws/:port` | GET | Get server status |
| `/server/ws/:port` | PUT | Start server |

## Dynamic Installation

Install via the daemon's module system:

```javascript
// HTTP server
await bl.put('bl:///install/http-server', {}, {
  path: './packages/server-node/src/upgrade-http-server.js',
  ports: [9111]
})

// WebSocket server
await bl.put('bl:///install/ws-server', {}, {
  path: './packages/server-node/src/upgrade-ws-server.js',
  ports: [9112]
})
// Requires: bl._plumber (optional, for subscriptions)
```

## Related

- [@bassline/core](../core) - Router and utilities
- [@bassline/store-node](../store-node) - File and code stores
