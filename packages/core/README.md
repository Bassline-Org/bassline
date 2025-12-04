# Bassline Core Documentation

Reference implementation of the Bassline specification for reflective distributed programming.

---

## Overview

Bassline provides a uniform interface to resources through **mirrors**. A mirror wraps any resource with three operations:

- `read()` - get current value
- `write(value)` - update value
- `subscribe(callback)` - watch for changes

Resources are named with **refs** (URIs). The system routes refs to mirrors through registered middleware.

---

## Package Structure

```
packages/core/
├── src/
│   ├── bassline.js          # Router and mirror cache
│   ├── setup.js             # Factory with standard middleware
│   ├── types.js             # Word and Ref types
│   ├── compound.js          # Ref navigation utilities
│   ├── mirror/
│   │   ├── interface.js     # BaseMirror class
│   │   ├── cell.js          # Mutable value
│   │   ├── fold.js          # Computed values
│   │   ├── compound.js      # Structures with refs
│   │   ├── ui-mirror.js     # UI definitions
│   │   ├── schema-mirror.js # Type schemas
│   │   ├── registry-mirror.js # Introspection
│   │   ├── remote.js        # WebSocket client
│   │   ├── http-server.js   # HTTP server
│   │   ├── http-client.js   # HTTP client
│   │   ├── tcp-server.js    # TCP server
│   │   └── serialize.js     # Value serialization
│   ├── protocol/
│   │   └── text.js          # BL/T text protocol
│   └── graph/
│       ├── quad.js          # Entity-Attribute-Value-Context tuples
│       └── graph.js         # Graph operations
├── bin/
│   ├── server.js            # HTTP server CLI
│   └── blt-server.js        # TCP server CLI
├── test/                    # Test files
└── examples/
    ├── explorer/            # Web-based system browser
    └── blt/                  # BL/T protocol examples
```

---

## Core Concepts

### Refs

A ref is a URI that names a resource. The `bl:` scheme is used for local resources.

```
bl:///cell/counter           # A mutable value
bl:///fold/sum?sources=a,b   # Computed sum of sources
bl:///registry/mirrors       # List of all mirrors
```

Refs are parsed into objects with standard URL properties:

| Property | Example |
|----------|---------|
| `scheme` | `bl` |
| `pathname` | `/cell/counter` |
| `searchParams` | `URLSearchParams` object |
| `href` | `bl:///cell/counter` |

### Words

Words are case-insensitive interned identifiers. Two words with the same spelling (ignoring case) are identical.

```javascript
word('alice') === word('ALICE')  // true
```

Words use `Symbol.for()` internally for O(1) equality comparison.

### Mirrors

A mirror provides access to a resource. All mirrors extend `BaseMirror` and implement:

| Property/Method | Description |
|-----------------|-------------|
| `readable` | Boolean. Can this mirror be read? |
| `writable` | Boolean. Can this mirror be written? |
| `ordering` | `'none'`, `'causal'`, or `'total'` |
| `read()` | Return current value |
| `write(value)` | Update value |
| `subscribe(callback)` | Watch for changes. Returns unsubscribe function. |

### Middleware

Middleware maps URI patterns to mirror factories. Registration uses longest-prefix matching.

```javascript
bl.use('/cell', (ref, bl) => new Cell(ref, bl));
bl.use('/cell/special', (ref, bl) => new SpecialCell(ref, bl));

// bl:///cell/foo      → Cell
// bl:///cell/special  → SpecialCell
```

Middleware can also observe operations:

```javascript
bl.use('/audit', {
  resolve: (ref, bl) => new AuditMirror(ref, bl),
  onWrite: (ref, value, result, bl) => { /* called after writes */ },
  onRead: (ref, result, bl) => { /* called after reads */ }
});
```

---

## The Bassline Class

### Constructor

```javascript
const bl = new Bassline();
```

Creates an empty router with no middleware.

### Methods

**Middleware Registration**

```javascript
bl.use(pattern, middleware)
```

- `pattern` - Path prefix (e.g., `/cell`, `/fold/sum`)
- `middleware` - Function `(ref, bl) => Mirror` or object with `resolve`, `onWrite`, `onRead`

**Resolution**

```javascript
bl.resolve(ref)  // Returns cached or new mirror
```

Resolution algorithm:
1. Parse string to Ref if needed
2. Check cache by `ref.href`
3. Find resolver with longest matching pattern prefix
4. Call resolver to create mirror
5. Cache and return mirror

**Operations**

```javascript
bl.read(ref)              // Resolve and read
bl.write(ref, value)      // Resolve and write
bl.watch(ref, callback)   // Resolve and subscribe
```

**Global Observers**

```javascript
bl.onWrite(callback)  // Called after any write. Returns unsubscribe.
bl.onRead(callback)   // Called after any read. Returns unsubscribe.
```

**Introspection**

```javascript
bl.listResolvers()         // Array of registered patterns
bl.listMirrors()           // Array of resolved mirror URIs
bl.hasResolved(ref)        // Boolean
```

**Cleanup**

```javascript
bl.dispose()  // Dispose all mirrors and clear state
```

---

## Standard Middleware

`createBassline()` returns a Bassline instance with these patterns registered:

| Pattern | Mirror | Description |
|---------|--------|-------------|
| `/cell` | Cell | Mutable value |
| `/fold/sum` | SumFold | Sum of sources |
| `/fold/max` | MaxFold | Maximum of sources |
| `/fold/min` | MinFold | Minimum of sources |
| `/fold/avg` | AvgFold | Average of sources |
| `/fold/count` | CountFold | Count of sources |
| `/fold/first` | FirstFold | First source value |
| `/fold/last` | LastFold | Last source value |
| `/fold/concat` | ConcatFold | Concatenate strings |
| `/fold/list` | ListFold | Collect into array |
| `/remote` | RemoteMirror | WebSocket connection |
| `/server/http` | HTTPServerMirror | HTTP server |
| `/http` | HTTPClientMirror | HTTP client |
| `/server/tcp` | TCPServerMirror | TCP server |
| `/compound` | CompoundMirror | Structures with refs |
| `/ui` | UIMirror | UI definitions |
| `/schema` | SchemaMirror | Type schemas |
| `/registry` | RegistryMirror | Introspection |

---

## Mirror Types

### Cell

Mutable value container.

**URI:** `bl:///cell/<name>`

**Query Parameters:**
- `?initial=<value>` - Initial value (parsed as number, boolean, or string)

**Properties:**
- `readable: true`
- `writable: true`
- `ordering: 'causal'`

**Example:**
```javascript
bl.write('bl:///cell/counter', 42);
bl.read('bl:///cell/counter');  // 42
```

### Folds

Computed values from sources. Read-only. Use semi-lattice operations (associative, commutative, idempotent).

**URI:** `bl:///fold/<operation>?sources=<ref>,<ref>,...`

**Operations:**

| Operation | Reduction | Empty Result |
|-----------|-----------|--------------|
| `sum` | `a + b` starting at 0 | `0` |
| `max` | `Math.max(...)` | `undefined` |
| `min` | `Math.min(...)` | `undefined` |
| `avg` | `sum / count` | `undefined` |
| `count` | `values.length` | `0` |
| `first` | `values[0]` | `undefined` |
| `last` | `values[length-1]` | `undefined` |
| `concat` | `values.join('')` | `''` |
| `list` | `[...values]` | `[]` |

**Properties:**
- `readable: true`
- `writable: false`
- `ordering: 'none'`

Folds subscribe to their sources and recompute when sources change.

**Example:**
```javascript
bl.write('bl:///cell/a', 10);
bl.write('bl:///cell/b', 20);
bl.read('bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b');  // 30
```

### CompoundMirror

Stores structures containing refs. Refs are preserved as `{ $ref: "..." }` markers, not dereferenced.

**URI:** `bl:///compound/<name>`

**Properties:**
- `readable: true`
- `writable: true`
- `ordering: 'causal'`

**Example:**
```javascript
bl.write('bl:///compound/user', {
  name: { $ref: 'bl:///cell/alice-name' },
  email: { $ref: 'bl:///cell/alice-email' }
});
```

### UIMirror

Stores UI definitions describing how to render data.

**URI:** `bl:///ui/<name>`

**Validation:** Definition must have a `type` field.

**Example:**
```javascript
bl.write('bl:///ui/user-form', {
  type: 'form',
  title: 'User Profile',
  data: { $ref: 'bl:///cell/user' },
  fields: [
    { path: 'name', label: 'Name', widget: 'text' }
  ]
});
```

### SchemaMirror

Stores type/validation schemas (JSON Schema format).

**URI:** `bl:///schema/<name>`

**Validation:** Definition must have a `type` field.

**Example:**
```javascript
bl.write('bl:///schema/user', {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' }
  },
  required: ['name', 'email']
});
```

### RegistryMirror

Introspection into the system. Read-only.

**URI:** `bl:///registry[/subpath]`

**Subpaths:**

| Path | Returns |
|------|---------|
| `/registry` | Array of resolver patterns |
| `/registry/resolvers` | Array of resolver patterns |
| `/registry/mirrors` | Array of resolved mirror URIs |
| `/registry/info?ref=<uri>` | Capabilities of a mirror |

**Query Filters for `/registry/mirrors`:**

| Parameter | Example | Effect |
|-----------|---------|--------|
| `type` | `?type=cell` | Filter by mirror type |
| `pattern` | `?pattern=ui/*` | Filter by URI glob pattern |
| `has` | `?has=data.$ref` | Filter by property existence |
| `where` | `?where=type:form` | Filter by value content |

Filters can be combined: `?type=ui&has=data&where=status:active`

---

## Network Mirrors

### HTTPServerMirror

Exposes Bassline over HTTP.

**URI:** `bl:///server/http?port=<port>&auth=<bool>`

**Control:**
```javascript
bl.write('bl:///server/http?port=8080', { action: 'start' });
bl.write('bl:///server/http?port=8080', { action: 'stop' });
```

**HTTP Routes:**

| Method | Path | Operation |
|--------|------|-----------|
| GET | `/bl/<path>` | Read |
| PUT | `/bl/<path>` | Write |
| GET | `/bl/<path>?sse=1` | Subscribe (Server-Sent Events) |
| GET | `/bl/info/<path>` | Mirror capabilities |

**Authentication:**

When `auth=true`, requests must include `Authorization: Bearer <token>`. Tokens are stored in `bl:///cell/_auth/tokens` as an array.

### HTTPClientMirror

Connects to remote Bassline via HTTP.

**URI:** `bl:///http?url=<endpoint>&token=<token>`

**Methods:**
```javascript
const mirror = bl.resolve('bl:///http?url=http://server:8080/bl/cell/x');
await mirror.readAsync();
await mirror.writeAsync(42);
mirror.subscribe(callback);  // Uses SSE
```

### TCPServerMirror

Exposes Bassline over TCP using BL/T protocol.

**URI:** `bl:///server/tcp?port=<port>`

### RemoteMirror

WebSocket connection to remote Bassline.

**URI:** `bl:///remote/<name>?address=<ws-url>`

**Query Parameters:**
- `?address=<url>` - WebSocket URL (required)
- `?maxReconnect=5` - Max reconnection attempts
- `?reconnectDelay=1000` - Delay between attempts (ms)

---

## BL/T Protocol

Text-based protocol for TCP connections.

### Value Encoding

| Type | Syntax | Example |
|------|--------|---------|
| Ref | `<uri>` | `<bl:///cell/x>` |
| String | `"..."` | `"hello"` |
| Word | unquoted | `alice` |
| Number | numeric | `42`, `-3.14` |
| Boolean | `true`/`false` | `true` |
| Null | `null` | `null` |
| Object | JSON | `{"key": 1}` |
| Array | JSON | `[1, 2, 3]` |

### Commands

```
VERSION BL/1.0
READ <ref>
WRITE <ref> <value>
SUBSCRIBE <ref>
UNSUBSCRIBE <stream>
INFO <ref>
```

### Responses

```
OK [value]
ERROR <code> <message>
STREAM <id>
EVENT <stream> <value>
```

### Example Session

```
> VERSION BL/1.0
< OK BL/1.0
> WRITE <bl:///cell/counter> 42
< OK
> READ <bl:///cell/counter>
< OK 42
> SUBSCRIBE <bl:///cell/counter>
< STREAM s1
< EVENT s1 42
> UNSUBSCRIBE s1
< OK
```

---

## Utilities

### Compound Helpers

Functions for working with structures containing refs:

```javascript
import { isRefMarker, getPath, getRefAt, collectRefs, reviveRefs, setPath } from '@bassline/core';

isRefMarker({ $ref: 'bl:///cell/x' })  // true
getPath(obj, 'user.name')              // Navigate path
getRefAt(obj, 'user.profile')          // Get Ref at path
collectRefs(obj)                        // Find all refs
reviveRefs(obj)                         // Convert markers to Refs
setPath(obj, 'user.name', 'Alice')     // Immutable update
```

### Serialization

```javascript
import { serializeValue, reviveValue } from '@bassline/core';

serializeValue(word('alice'))  // { $word: "ALICE" }
serializeValue(ref('bl:///x')) // "bl:///x"
reviveValue({ $word: "ALICE" }) // Word("ALICE")
```

---

## Graph Infrastructure

Quad-based graph for relationship storage. Not integrated with mirrors.

### Quads

```javascript
import { quad, word } from '@bassline/core/graph';

const q = quad(
  word('alice'),           // entity
  word('knows'),           // attribute
  word('bob'),             // value
  word('context1')         // context
);
```

### Graph Operations

```javascript
import { Graph, union, intersection, difference } from '@bassline/core/graph';

const g1 = new Graph();
g1.add(quad(...));

const g2 = new Graph();
g2.add(quad(...));

const combined = union(g1, g2);
const common = intersection(g1, g2);
const removed = difference(g1, g2);
```

---

## CLI Tools

### HTTP Server

```bash
node bin/server.js [options]

Options:
  -p, --port <n>     Port (default: 8080)
  -a, --auth <t,t>   Comma-separated auth tokens
  -c, --cell <p=v>   Pre-populate cell (repeatable)
  -h, --help         Show help

Example:
  node bin/server.js -p 3000 -c counter=0 -c name=alice
```

### TCP Server

```bash
node bin/blt-server.js [options]

Options:
  -p, --port <n>     Port (default: 9000)
  -c, --cell <p=v>   Pre-populate cell (repeatable)
  -h, --help         Show help

Example:
  node bin/blt-server.js -p 9500 -c counter=0
```

---

## Exports

### Main Entry Point (`@bassline/core`)

```javascript
// Factory
createBassline()

// Core
Bassline, ref, Ref, isRef, word, Word, isWord

// Mirrors
Cell, cell
SumFold, MaxFold, MinFold, AvgFold, CountFold, FirstFold, LastFold, ConcatFold, ListFold
CompoundMirror, compound
UIMirror, ui
SchemaMirror, schema
RegistryMirror
RemoteMirror
HTTPServerMirror, HTTPClientMirror, TCPServerMirror
BaseMirror, isMirror

// Utilities
isRefMarker, getPath, getRefAt, collectRefs, reviveRefs, setPath
serializeValue, reviveValue
```

### Subpath Exports

```javascript
import { Bassline } from '@bassline/core/bassline';
import { ref, word } from '@bassline/core/types';
import { quad, Graph } from '@bassline/core/graph';
```

---

## Tests

Run tests:
```bash
pnpm test
```

Test files cover:

- `bassline.test.js` - Router and resolution
- `mirror.test.js` - Mirror interface
- `mirror-serialize.test.js` - Value serialization
- `ref.test.js` - Ref type
- `ref-quad.test.js` - Quad operations
- `bl-scheme.test.js` - BL scheme handling
- `compound.test.js` - Compound utilities
- `protocol.test.js` - BL/T protocol
- `http.test.js` - HTTP server/client
- `tcp-server.test.js` - TCP server
- `registry.test.js` - Registry mirror with query filters
- `ui.test.js` - UI and Schema mirrors
