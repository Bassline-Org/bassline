# Distributed Gadget Sync Demo

This demo showcases **protocol-generic transport adapters** enabling real distributed synchronization with **zero transport-specific code in gadgets**.

## Architecture

### The Key Separation

```
┌─────────────────────────────────────────────────┐
│ Gadget Layer (Transport-Agnostic)              │
│ • createSharedState() - pure gadget code       │
│ • Zero knowledge of WebSocket, HTTP, etc.      │
│ • Works in-memory, over network, anywhere      │
└─────────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────────┐
│ Adapter Layer (Protocol-Generic)               │
│ • wsValuedAdapter() - works with Valued<T>     │
│ • wsTransformAdapter() - works with Transform  │
│ • Generic over protocols, not gadget types     │
└─────────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────────┐
│ Transport Layer (Mechanical I/O)               │
│ • WebSocket server - just connection mgmt      │
│ • Zero business logic, just forwarding         │
└─────────────────────────────────────────────────┘
```

## What Makes This Special

### 1. Transport-Agnostic Gadgets

The `shared-state.ts` gadget has **ZERO networking code**. It's pure business logic that works:

- ✅ In-memory (same process)
- ✅ Over WebSocket (real-time bidirectional)
- ✅ Over HTTP (request/response)
- ✅ Over IPC (cross-process)
- ✅ Over ANY transport via adapters

**Same gadget. Different transport. Zero changes.**

### 2. Protocol-Generic Adapters

Adapters constrain on **protocols, not implementations**:

```typescript
// This adapter works with ANY Valued<T> gadget
wsValuedAdapter<T>(socket, gadget: Implements<Valued<T>>)

// Works with:
wsValuedAdapter(socket, lastCell);      // Valued<number>
wsValuedAdapter(socket, unionCell);     // Valued<Set<T>>
wsValuedAdapter(socket, maxCell);       // Valued<number>
wsValuedAdapter(socket, customGadget);  // Valued<MyType>
```

**One adapter. Infinite gadget implementations. Full type safety.**

### 3. ACI Properties Enable Distribution

The `unionCell` used in shared state has these properties:

- **Associative**: `(a ∪ b) ∪ c = a ∪ (b ∪ c)` - grouping doesn't matter
- **Commutative**: `a ∪ b = b ∪ a` - order doesn't matter
- **Idempotent**: `a ∪ a = a` - duplicates don't matter

This means:
- ✅ Messages can arrive out of order - still converges
- ✅ Messages can be duplicated - still correct
- ✅ Concurrent updates - still consistent

**CRDT-like behavior with zero CRDT-specific code.**

## Running the Demo

### Prerequisites

```bash
npm install ws  # WebSocket library
```

### Start the Server

```bash
npx tsx src/demo/websocket-server.ts
```

You should see:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Distributed Gadget Sync Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Created shared state gadget
   Protocol: Valued<Set<number>>
   Initial state: (empty)

✅ Wired broadcast adapter
   Shared state effects → All connected clients

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Server running on ws://localhost:8080
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Open the Client

1. Open `src/demo/websocket-client.html` in your browser
2. Open it in **multiple tabs/windows** to see distributed sync
3. Add values in any tab - they instantly appear in all others

### Try These Scenarios

#### Scenario 1: Basic Sync
- Open 2 tabs
- Add values in tab 1 → see them in tab 2
- Add values in tab 2 → see them in tab 1

#### Scenario 2: Concurrent Updates
- Open 3+ tabs
- Click "Add Random Value" rapidly in multiple tabs simultaneously
- All values merge correctly, no conflicts

#### Scenario 3: Idempotence
- Add the same value multiple times
- Set only stores it once (idempotent property)

#### Scenario 4: Order Independence
- Disconnect a client (close tab)
- Update state in other tabs
- Reconnect client
- State catches up correctly regardless of update order

## Code Walkthrough

### The Gadget (Transport-Agnostic)

```typescript
// demo/shared-state.ts
export function createSharedState(): Implements<Protocols.Valued<Set<number>>> {
  return withTaps(quick(unionProto<number>(), new Set()));
}
```

**That's it!** Zero transport code. Protocol-typed return value enables generic adapters.

### The Server (Thin Transport Layer)

```typescript
// demo/websocket-server.ts
const sharedState = createSharedState();
const clients = new Set<WebSocket>();

// Broadcast gadget effects to all clients
wsBroadcastAdapter(sharedState, () => clients);

// Wire each client to shared state
wss.on('connection', (socket) => {
  clients.add(socket);
  wsValuedAdapter(socket, sharedState, {
    serialize: (set) => Array.from(set),
    deserialize: (arr) => new Set(arr)
  });
});
```

**No business logic!** Just wiring adapters. The gadget handles everything.

### The Adapter (Protocol-Generic)

```typescript
// patterns/network/adapters.ts
export function wsValuedAdapter<T>(
  socket: WebSocket,
  gadget: Implements<Protocols.Valued<T>>,
  codec?: { serialize, deserialize }
) {
  // Transport → Gadget
  socket.on('message', data => gadget.receive(deserialize(data)));

  // Gadget → Transport
  return gadget.tap(effects => socket.send(JSON.stringify(effects)));
}
```

**Works with ANY `Valued<T>` gadget!** Protocol constraint ensures type safety.

## Extending the Demo

### Add HTTP Endpoint (Same Gadget!)

```typescript
// demo/http-server.ts
import express from 'express';
import { createSharedState } from './shared-state';

const sharedState = createSharedState();
const app = express();
app.use(express.json());

app.get('/state', (req, res) => {
  res.json({ values: Array.from(sharedState.current()) });
});

app.post('/update', (req, res) => {
  sharedState.receive(new Set(req.body.values));
  const cleanup = sharedState.tap(({ changed }) => {
    if (changed) {
      res.json({ values: Array.from(changed) });
      cleanup();
    }
  });
});

app.listen(3000);
```

Now clients can connect via WebSocket OR HTTP - **same gadget, different transport!**

### Add IPC Worker (Same Gadget!)

```typescript
// demo/worker.ts
import { fork } from 'child_process';
import { createSharedState } from './shared-state';
import { ipcAdapter } from '../patterns/network/adapters';

const sharedState = createSharedState();
const worker = fork('./worker-process.js');

ipcAdapter(worker, sharedState);
```

### Add Chaos Mode

```typescript
// Simulate message loss
function chaosAdapter(socket, gadget) {
  return wsAdapter(socket, gadget);
  // Randomly drop 30% of messages
  const originalTap = gadget.tap;
  gadget.tap = (fn) => originalTap((effects) => {
    if (Math.random() > 0.3) fn(effects);
  });
}
```

**Even with 30% packet loss, ACI properties ensure eventual convergence!**

## Key Takeaways

1. **Separation of concerns**: Business logic (gadgets) vs transport (adapters) vs I/O (server)
2. **Protocol polymorphism**: Adapters work with any gadget implementing a protocol
3. **Transport agnostic**: Same gadget works everywhere
4. **ACI = CRDT**: Lattice properties enable distributed consistency
5. **Type safety**: Protocols ensure compile-time correctness
6. **Composable**: Mix transports, add features via composition

**This is how you build distributed systems with gadgets.**
