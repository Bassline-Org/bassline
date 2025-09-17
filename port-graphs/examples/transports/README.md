# Transport Examples

Demonstrations of gadgets communicating across process boundaries using different transports.

## Key Insight

Gadgets don't care about transport - they just `receive` and `emit`. The transport is just wiring:

```typescript
// Same gadget works with any transport:
gadget.emit = (effect) => transport.send(effect)     // Outgoing
transport.on('data', (data) => gadget.receive(data)) // Incoming
```

Because cells use ACI (Associative, Commutative, Idempotent) operations, they naturally handle:
- Async delivery
- Out-of-order messages
- Network delays
- Duplicate messages

## Examples

### Unix Pipes

Parent and child processes communicate through stdin/stdout:

```bash
cd pipes
tsx parent.ts
```

Both processes have `maxCell` gadgets that converge to the same maximum value despite async, bidirectional communication.

### TCP Sockets

Server and multiple clients with `unionCell` gadgets:

```bash
# Terminal 1: Start server
cd tcp
tsx server.ts

# Terminal 2: Start client
tsx client.ts client1

# Terminal 3: Start another client
tsx client.ts client2
```

All clients and server converge to the same set union, showing that ACI properties work across network boundaries.

### HTTP Server

REST API + Server-Sent Events for gadget communication:

```bash
# Terminal 1: Start server
cd http
npm install node-fetch eventsource
tsx server.ts

# Terminal 2: Start client
tsx client.ts

# Terminal 3: Another client
tsx client.ts
```

Shows how request/response pattern can work with gadgets using POST for sending and SSE for receiving.

## Running Examples

Install dependencies:
```bash
npm install -g tsx
npm install
```

Each example demonstrates the same principle: **gadgets work unchanged across any transport boundary**.

## Convergence Properties

All examples use cells with ACI merge functions:
- **maxCell**: Converges to maximum value seen
- **unionCell**: Converges to union of all sets

These naturally handle distributed systems challenges:
- Messages can arrive in any order
- Messages can be delayed
- Messages can be duplicated
- No coordination needed between nodes

The transport is irrelevant - the gadget protocol handles it all.