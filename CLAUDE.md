# Bassline

A specification for reflective distributed programming. Reference implementation: ~700 lines.

## What Is Bassline?

Bassline is a **specification** for distributed programming built around one key idea: **mirrors**.

A mirror is a uniform interface to a resource—any resource. It has three operations:
- `read()` - get the current value
- `write(value)` - update the value
- `subscribe(callback)` - watch for changes

That's it. But this simple interface enables powerful composition:

- **Mirrors compose** - A fold mirrors over cell mirrors. A remote mirrors a local. Layers stack cleanly.
- **Implementation-agnostic** - Any language can implement the interface. You don't need a complete client—implement what you need, delegate what you don't.
- **Folds are semi-lattices** - Operations are associative, commutative, idempotent. Concurrent updates merge without coordination. CRDT semantics baked in.
- **Layered properties** - Each layer can add constraints enforced locally, shared as data, negotiated with peers. Protocol evolution without breaking changes.

## The Foundation: Partial Information

Bassline is rooted in one idea: **partial information**.

In any distributed system, no node has the complete picture:
- You never have complete knowledge
- You work with what you know
- New information refines what you have
- Different nodes have different partial views
- Merging partial views must be well-defined

Mirrors are a natural API for partial information:

| Operation | Meaning |
|-----------|---------|
| `read()` | "What do I know now?" |
| `write(value)` | "Here's what I know" |
| `subscribe(cb)` | "Tell me when you learn more" |

Everything else follows from this:
- **Semi-lattices** for merging partial views without conflicts
- **Partial implementation** because you only implement what you know
- **Layered properties** because each layer has partial constraints
- **Eventual consistency** because partial views converge over time

This is why mirrors compose so cleanly—they're not "reactive state containers," they're interfaces to partial knowledge. A fold doesn't "compute a value," it merges partial information from its sources. A remote doesn't "sync state," it exchanges partial views with a peer.

## Refs: Universal Naming

**Refs are just URIs.** They're not tied to any particular scheme or implementation—they're the universal way to name things.

```
bl:///cell/counter?initial=0     # A mutable value
https://api.example.com/user/42  # A REST resource
ws://node2:8080/events           # A WebSocket stream
ipfs://Qm.../document            # Content-addressed data
custom://my/protocol             # Whatever you define
```

A ref is just "something to address"—could be data, an action, a connection, a computation, a remote service. The scheme tells you what kind of thing. Middleware teaches the system how to resolve it.

This is what makes refs universal:
- Not tied to Bassline
- Not tied to any language
- Already the standard way to name things on the internet
- Self-describing: the URI carries its own resolution information

## What This Enables

### 1. Sandboxing

Middleware controls what's resolvable. You can create isolated environments with restricted capabilities:

```javascript
// Restricted environment - only cells, no remote access
const sandbox = new Bassline();
sandbox.use('/cell', (ref, bl) => new Cell(ref, bl));
// That's it. No /remote, no /fold, nothing else.
```

Everything goes through resolution. You have complete control over what resources exist.

### 2. Distributed Programming

Refs are location-transparent. The same ref can resolve to:
- A local cell
- A remote proxy over WebSocket
- A replicated value across nodes

```javascript
// Local
bl.write('bl:///cell/counter', 42);

// Remote - same interface
bl.write('bl:///remote/peer1?address=ws://node2:8080', {
  ref: 'bl:///cell/counter',
  value: 42
});
```

The code using refs doesn't know or care where the data lives.

### 3. Protocol Definition

Define new protocols by creating mirrors and registering middleware:

```javascript
class PriceFeed extends BaseMirror {
  constructor(ref, bassline) {
    super(ref, bassline);
    this._symbol = ref.searchParams.get('symbol');
    this._connect();
  }

  get readable() { return true; }
  get writable() { return false; }

  read() { return this._latestPrice; }
}

bl.use('/price', (ref, bl) => new PriceFeed(ref, bl));
bl.read('bl:///price/btc?symbol=BTCUSD');
```

The system is self-extensible. Want a new kind of resource? Write a mirror, register it.

### 4. Heterogeneity

Because the spec is minimal, implementations can exist everywhere:

| Environment | Implementation |
|-------------|---------------|
| Browser | JavaScript |
| Server | Node, Deno, Bun |
| Systems | Rust, Go, C |
| Enterprise | Java, C# |
| Distributed | Erlang, Elixir |
| Embedded | C, Rust |

They all speak the same language: refs.

### 5. Partial Implementation

You don't need to implement the entire spec. Implement what you need:

- A browser client might only need cells and folds
- An IoT device might only need cells and remote
- A server might implement custom mirrors for your domain

No monolithic client required. Delegate what you don't implement to peers who do.

## Semi-Lattice Semantics

Folds implement semi-lattice operations—associative, commutative, idempotent:

```
sum(a, b) = sum(b, a)           # commutative
sum(a, sum(b, c)) = sum(sum(a, b), c)  # associative
max(a, a) = a                   # idempotent
```

This means:
- **Order-independent** - Operations can happen in any order and still converge
- **Coordination-free** - No consensus needed for concurrent updates
- **Eventually consistent** - Replicas converge automatically

This is the CRDT insight built into the fold design. When you use folds, you get distributed-friendly semantics by default.

## Layered Properties

Each layer in the system can add properties that:
- Are **enforced locally** - Your node validates its own constraints
- Are **shared as data** - Properties travel with values
- Are **negotiated with peers** - Connect to others, agree on what properties matter

This enables protocol evolution:
- Add new constraints without breaking existing clients
- Clients that don't understand a property can ignore it or delegate
- Properties compose: layer A's constraints + layer B's constraints

## The Specification

### Ref

A URI with:
- `scheme` - Protocol identifier (e.g., `bl`)
- `pathname` - Resource path (e.g., `/cell/counter`)
- `searchParams` - Configuration (e.g., `initial=0`)
- `href` - Canonical string form

### Mirror

An object bound to a ref with:
- `readable` - Boolean, can this be read?
- `writable` - Boolean, can this be written?
- `read()` - Return current value
- `write(value)` - Update value
- `subscribe(callback)` - Watch for changes, return unsubscribe function

### Bassline (Router)

- `use(pattern, middleware)` - Register resolver for pattern
- `resolve(ref)` - Get or create mirror for ref
- `read(ref)` - Resolve and read
- `write(ref, value)` - Resolve and write
- `watch(ref, callback)` - Resolve and subscribe

### Resolution Algorithm

1. Parse ref string → Ref object
2. Find middleware with longest matching pattern prefix
3. If mirror cached, return it
4. Otherwise: create mirror via middleware, cache it, return it

## Reference Implementation

The JavaScript implementation is ~720 lines:

```
packages/core/src/
├── bassline.js         # 123 LOC - Middleware router + ref→mirror cache
├── setup.js            #  49 LOC - createBassline() with standard middleware
├── types.js            # 152 LOC - Word, Ref value types
└── mirror/
    ├── interface.js    #  53 LOC - BaseMirror class
    ├── cell.js         #  43 LOC - Mutable value
    ├── fold.js         # 107 LOC - Computed values (sum, max, min, etc.)
    ├── remote.js       #  91 LOC - WebSocket connection
    ├── serialize.js    #  46 LOC - Value serialization
    ├── registry-mirror.js # 42 LOC - Introspection
    └── index.js        #  16 LOC - Exports
```

### Built-in Mirrors

| Pattern | Mirror | Description |
|---------|--------|-------------|
| `/cell` | Cell | Mutable value with subscriptions |
| `/fold/sum` | SumFold | Sum of source values |
| `/fold/max` | MaxFold | Maximum of source values |
| `/fold/min` | MinFold | Minimum of source values |
| `/fold/avg` | AvgFold | Average of source values |
| `/fold/count` | CountFold | Count of sources |
| `/fold/first` | FirstFold | First source value |
| `/fold/last` | LastFold | Last source value |
| `/fold/concat` | ConcatFold | Concatenate string values |
| `/fold/list` | ListFold | Collect values into array |
| `/remote` | Remote | WebSocket connection |
| `/registry` | Registry | Introspection |

### Usage

```javascript
import { createBassline } from '@bassline/core';

const bl = createBassline();

// Cells
bl.write('bl:///cell/counter', 42);
bl.read('bl:///cell/counter'); // 42

// Folds
bl.write('bl:///cell/a', 10);
bl.write('bl:///cell/b', 20);
bl.read('bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b'); // 30

// Subscriptions
bl.watch('bl:///cell/counter', value => console.log(value));

// Custom middleware
bl.use('/custom', (ref, bl) => new MyMirror(ref, bl));
```

### Event Observation

Middleware can observe all reads/writes:

```javascript
bl.use('/audit', {
  resolve: (ref, bl) => new AuditMirror(ref, bl),
  onWrite: (ref, value, result, bl) => {
    console.log(`Write to ${ref.href}:`, value);
  }
});

// Or globally
bl.onWrite((ref, value, result, bl) => {
  // Called for every write in the system
});
```

### Introspection

```javascript
bl.listResolvers();  // ['/cell', '/fold/sum', ...]
bl.listMirrors();    // ['bl:///cell/counter', ...]
bl.hasResolved('bl:///cell/counter'); // true/false

// Or via the registry mirror
bl.read('bl:///registry');         // List all resolvers
bl.read('bl:///registry/mirrors'); // List all resolved mirrors
```

## Why This Matters

Traditional approaches assume complete information:

| Approach | Assumption |
|----------|------------|
| RPC | Caller knows the complete interface |
| Databases | Schema defines the complete structure |
| State libraries | One process has the complete state |
| Message queues | Messages have complete, self-contained payloads |

Real distributed systems don't work this way. Nodes have partial views. Information arrives incrementally. Schemas evolve. Peers come and go.

Bassline embraces partial information:
- **Mirrors** - uniform interface to partial knowledge
- **Semi-lattices** - merge partial views without coordination
- **Partial implementation** - implement what you need, delegate the rest
- **Layered properties** - constraints compose across partial views
- **Refs** - name things you don't fully know yet

All in ~700 lines per implementation.

## Value Types

**Word** - Case-insensitive interned identifier:
```javascript
import { word } from '@bassline/core';
word('alice') === word('ALICE')  // true (same symbol)
```

**Ref** - URI reference:
```javascript
import { ref } from '@bassline/core';
const r = ref('bl:///cell/counter?initial=0');
r.scheme       // 'bl'
r.pathname     // '/cell/counter'
r.searchParams // URLSearchParams { initial: '0' }
```

## Serialization

Mirrors serialize to JSON with their URI:

```javascript
const cell = bl.resolve('bl:///cell/counter');
cell.toJSON();
// { $mirror: 'cell', uri: 'bl:///cell/counter', value: 42 }
```

To restore: just resolve the URI again.

```javascript
const data = JSON.parse(stored);
const mirror = bl.resolve(data.uri);
```

The URI carries everything needed. No type registry required.

## Running

```bash
pnpm install
pnpm test  # 99 tests
```

## License

AGPLv3
