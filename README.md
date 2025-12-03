# Bassline

A specification for reflective distributed programming.

## What Is This?

Bassline is rooted in **partial information**. In distributed systems, no node has the complete picture—you work with what you know, and merge what others know.

**Mirrors** are the API for partial information:

| Operation | Meaning |
|-----------|---------|
| `read()` | What do I know now? |
| `write(value)` | Here's what I know |
| `subscribe(cb)` | Tell me when you learn more |

This simple interface enables powerful composition:

- **Mirrors compose** - Folds over cells over remotes. Layers stack cleanly.
- **Partial implementation** - Implement what you need, delegate what you don't.
- **Semi-lattice semantics** - Concurrent updates merge without coordination.
- **Layered properties** - Constraints enforced locally, shared as data, negotiated with peers.

## The Core Insight

**Refs are just URIs.** They're not tied to any scheme or implementation—they're the universal way to name things.

```
bl:///cell/counter?initial=0     # A mutable value
https://api.example.com/user/42  # A REST resource
ws://node2:8080/events           # A WebSocket stream
custom://my/protocol             # Whatever you define
```

A ref is just "something to address"—data, action, connection, computation. The scheme tells you what kind. Middleware resolves it.

## What This Enables

**Sandboxing** - Middleware controls what's resolvable. Create isolated environments with restricted capabilities.

**Distributed** - Refs are location-transparent. Same interface whether local, remote, or replicated.

**Protocol-extensible** - Define new resource types by creating mirrors and registering middleware.

**Heterogeneous** - Any language can implement the spec. JavaScript, Rust, Python, Erlang—they all speak refs.

## Quick Start

```javascript
import { createBassline } from '@bassline/core';

const bl = createBassline();

// Cells - mutable values
bl.write('bl:///cell/counter', 42);
bl.read('bl:///cell/counter'); // 42

// Folds - computed values
bl.write('bl:///cell/a', 10);
bl.write('bl:///cell/b', 20);
bl.read('bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b'); // 30

// Watch for changes
bl.watch('bl:///cell/counter', value => console.log(value));

// Custom middleware
bl.use('/price', (ref, bl) => new PriceFeed(ref, bl));
bl.read('bl:///price/btc?symbol=BTCUSD');
```

## Reference Implementation

This repo contains a JavaScript implementation in ~720 lines:

```
packages/core/src/
├── bassline.js      # Middleware router + ref→mirror cache
├── setup.js         # createBassline() with standard middleware
├── types.js         # Word, Ref value types
└── mirror/          # Cell, Fold, Remote, Registry mirrors
```

## Running

```bash
pnpm install
pnpm test  # 182 tests
```

## BL/T Protocol

Bassline includes a text-based wire protocol for shell-friendly interactions:

```bash
# Start a BL/T server
node packages/core/bin/blt-server.js -p 9000 -c counter=0

# Connect with netcat
nc localhost 9000
VERSION BL/1.0
VERSION BL/1.0
WRITE bl:///cell/counter 42
OK
READ bl:///cell/counter
OK 42
INFO bl:///cell/counter
OK {"readable":true,"writable":true,"ordering":"causal"}
```

**Features:**
- Human-readable, line-based format
- Works with grep, awk, pipes
- Tag correlation for request pipelining
- Subscription support with EVENTs
- Mirror introspection via INFO

See [packages/core/docs/protocol.md](./packages/core/docs/protocol.md) for the full specification.

## Documentation

See [CLAUDE.md](./CLAUDE.md) for the full specification and implementation details.

## License

AGPLv3
