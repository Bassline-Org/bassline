# @bassline/node

HTTP server, WebSocket server, and file store for Node.js.

## Install

```bash
pnpm add @bassline/node
```

## HTTP Server

```javascript
import { createHttpServer } from '@bassline/node'
import { resource, routes } from '@bassline/core'

const httpServer = createHttpServer()

// Create a kit that the server will use to handle requests
const kit = routes({
  hello: resource({
    get: async () => ({ headers: {}, body: { message: 'Hello!' } }),
  }),
  echo: resource({
    put: async (h, body) => ({ headers: {}, body }),
  }),
})

// Start server on port 9111
await httpServer.put({ path: '/9111', kit }, {})

// Server info
const info = await httpServer.get({ path: '/9111' })
// → { body: { port: 9111, status: 'running', ... } }

// Stop server
await httpServer.put({ path: '/9111/stop' }, {})
```

HTTP requests are proxied to the kit:

```bash
# GET /hello
curl http://localhost:9111/hello
# → {"headers":{},"body":{"message":"Hello!"}}

# PUT /echo
curl -X PUT http://localhost:9111/echo -d '{"data":"test"}'
# → {"headers":{},"body":{"data":"test"}}
```

## WebSocket Server

```javascript
import { createWsServer } from '@bassline/node'

const wsServer = createWsServer()

// Start WebSocket server on port 9112
await wsServer.put({ path: '/9112', kit }, {})

// Broadcast to all connected clients
await wsServer.put({ path: '/9112/broadcast' }, { message: 'Hello everyone!' })

// Stop server
await wsServer.put({ path: '/9112/stop' }, {})
```

WebSocket clients send JSON messages:

```javascript
const ws = new WebSocket('ws://localhost:9112')

// GET request
ws.send(
  JSON.stringify({
    id: 1,
    method: 'get',
    path: '/hello',
  })
)

// PUT request
ws.send(
  JSON.stringify({
    id: 2,
    method: 'put',
    path: '/echo',
    body: { data: 'test' },
  })
)

ws.onmessage = event => {
  const { id, headers, body } = JSON.parse(event.data)
  console.log(id, body)
}
```

## File Store

```javascript
import { createFileStore } from '@bassline/node'

const store = createFileStore('/path/to/data')

// Read a JSON file
const data = await store.get({ path: '/config.json' })
// → { headers: { type: 'json' }, body: { ... } }

// Write a file
await store.put({ path: '/users/alice.json' }, { name: 'Alice' })

// List directory
const files = await store.get({ path: '/' })
// → { headers: { type: 'directory' }, body: ['config.json', 'users'] }
```

Features:

- JSON files parsed automatically
- Non-JSON files returned as text
- Creates intermediate directories on write
- Pretty-prints JSON with indentation

## Routes

### HTTP Server

| Route         | Method | Description                        |
| ------------- | ------ | ---------------------------------- |
| `/`           | GET    | List all servers                   |
| `/:port`      | GET    | Server status                      |
| `/:port`      | PUT    | Start server (pass kit in headers) |
| `/:port/stop` | PUT    | Stop server                        |

### WebSocket Server

| Route              | Method | Description                        |
| ------------------ | ------ | ---------------------------------- |
| `/`                | GET    | List all servers                   |
| `/:port`           | GET    | Server status                      |
| `/:port`           | PUT    | Start server (pass kit in headers) |
| `/:port/broadcast` | PUT    | Broadcast to all clients           |
| `/:port/stop`      | PUT    | Stop server                        |

## Related

- [@bassline/core](../core) - Resource primitives
- [@bassline/remote](../remote) - WebSocket client
