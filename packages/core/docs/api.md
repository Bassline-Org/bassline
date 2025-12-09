# Bassline API

## The Resource Model

Everything in Bassline is a **resource**. A resource is something you can `get` from and `put` to. That's the entire API.

```
get <uri>        → response
put <uri> <body> → response
```

Resources are:
- **Identified by URIs** — `bl:///cells/counter`, `bl:///props/sum`
- **Stored as documents** — the store IS the system
- **Accessed uniformly** — same two verbs for everything

The meaning of get/put depends entirely on what resource you're accessing. A cell interprets `put` as "join this value". A network interprets `put` as "add this propagator". The resource decides.

## Verbs

| Verb | Description |
|------|-------------|
| get  | Read from a resource (all resources support this) |
| put  | Send to a resource (resource determines if supported) |

All resources support `get`. Whether a resource supports `put` depends on the resource — a cell's `write` endpoint accepts puts, a cell's `value` does not.

## Request/Response

Every request and response has `headers` and `body`:

```javascript
// Request
{
  headers: { capability: "token" },
  body: "bl:///cells/counter"
}

// Response
{
  headers: { type: "bl:///types/cell" },
  body: {
    value: "bl:///cells/counter/value",
    write: "bl:///cells/counter/write",
    lattice: "bl:///lattices/max",
    meta: "bl:///cells/counter/meta"
  }
}
```

## Resources

A resource is anything with a URI. When you `get` a resource, you get one of two things:

### Scalars

A scalar is a value with no parts — a number, string, boolean, or null.

```javascript
get bl:///cells/counter/value
// → { headers: { type: "bl:///types/number" }, body: 42 }
```

The body IS the value. Nothing more to discover.

### Compounds

A compound is a structure that points to other resources. Each field is either a scalar or a URI.

```javascript
get bl:///cells/counter
// → {
//   headers: { type: "bl:///types/cell" },
//   body: {
//     value: "bl:///cells/counter/value",
//     write: "bl:///cells/counter/write",
//     lattice: "bl:///lattices/max",
//     meta: "bl:///cells/counter/meta"
//   }
// }
```

The body is a map of links. Follow any link to discover more.

### Everything is a Link

All behaviors, implementations, and relationships are URIs:
- Lattice: `"bl:///lattices/max"` not `"max"`
- Combiner: `"bl:///combiners/sum"` not `"sum"`
- Type: `"bl:///types/cell"` not `"cell"`

This is what makes the system uniform. A cell's lattice is just another resource you can get. A propagator's combiner is just another resource. There's no magic — only resources pointing to resources.

### Links as Capabilities

Each link in a compound is a capability — it grants access to something. What links you see depends on your access level (communicated via headers). A read-only view of a cell might only expose `value`. An admin view exposes `meta` for control. The resolver decides what to show.

## Storage

The store IS the world. Every resource is a document. The stored document is the complete, unrestricted representation.

```javascript
// What's stored = full unrestricted response
store.get("cells/counter")
// → {
//   type: "bl:///types/cell",
//   value: "bl:///cells/counter/value",
//   write: "bl:///cells/counter/write",
//   lattice: "bl:///lattices/max",
//   meta: "bl:///cells/counter/meta"
// }
```

Resolution reads from store. Capabilities filter what you see:
- Full access → see everything
- Restricted → some links hidden

## Primitives

Primitives are the core resource types. Each has a characteristic shape — a set of links that expose its capabilities. What links you see depends on your access (headers).

### Cell

A cell holds a value with merge semantics:

```javascript
{
  type: "bl:///types/cell",
  value: "bl:///cells/counter/value",      // capability: read current value
  write: "bl:///cells/counter/write",      // capability: join new value
  lattice: "bl:///lattices/max",           // capability: see merge behavior
  meta: "bl:///cells/counter/meta"         // capability: introspection/control
}
```

Each link is a capability. With restricted access, some links may be hidden:
- Read-only view might only expose `value`
- Admin view exposes `meta` for intercession
- The resolver decides what to show based on headers

### Propagator

A propagator relates cells — it watches sources and writes to a target:

```javascript
{
  type: "bl:///types/propagator",
  sources: "bl:///props/sum/sources",      // capability: see inputs
  combiner: "bl:///combiners/sum",         // capability: see computation
  target: "bl:///cells/total/write",       // capability: see output
  meta: "bl:///props/sum/meta"             // capability: control
}
```

When sources change, the propagator reads them, applies the combiner, and puts to target.

### Bus

A bus handles notifications — it's how resources learn about changes:

```javascript
{
  type: "bl:///types/bus",
  notify: "bl:///bus/main/notify",       // capability: send notifications
  listen: "bl:///bus/main/listen",       // capability: register listeners
  meta: "bl:///bus/main/meta"
}
```

Notifications are just puts:

```javascript
// Notify that a cell changed
put bl:///bus/main/notify { source: "bl:///cells/a", event: "changed" }

// Register a listener
put bl:///bus/main/listen { target: "bl:///props/sum", sources: ["bl:///cells/a"] }
```

A bus can be local to a network (`bl:///networks/my-net/bus`) or global (`bl:///bus/main`). Same resource, same interface.

### Lattice

A lattice defines merge behavior:

```javascript
{
  type: "bl:///types/lattice",
  description: "Maximum of comparable values",
  bottom: "bl:///lattices/max/bottom",     // link: identity value
  join: "bl:///lattices/max/join",         // link: merge operation
  implementation: "bl:///code/lattices/max"// link: actual code
}
```

Built-in lattices:
- `bl:///lattices/max` — maximum
- `bl:///lattices/min` — minimum
- `bl:///lattices/set` — set union
- `bl:///lattices/lww` — last-write-wins

### Combiner

A combiner defines how a propagator computes its output:

```javascript
{
  type: "bl:///types/combiner",
  description: "Adds values",
  arity: 2,
  implementation: "bl:///code/combiners/sum"// link: actual code
}
```

Built-in combiners:
- `bl:///combiners/constant` — 0-arity, outputs fixed value
- `bl:///combiners/identity` — 1-arity, passes through
- `bl:///combiners/sum` — n-arity, adds values
- `bl:///combiners/max` — n-arity, maximum
- `bl:///combiners/min` — n-arity, minimum

### Type

A type defines what a kind of resource looks like:

```javascript
{
  type: "bl:///types/type",
  description: "A cell - holds a value with lattice merge semantics",
  schema: "bl:///types/cell/schema"          // link: structure definition
}
```

### Network

A network manages cells, propagators, and their connections:

```javascript
{
  type: "bl:///types/network",
  cells: "bl:///networks/my-net/cells",           // capability: see/add cells
  propagators: "bl:///networks/my-net/propagators", // capability: see/add props
  connections: "bl:///networks/my-net/connections", // capability: see wiring
  meta: "bl:///networks/my-net/meta"              // capability: control
}
```

Networks reference cells — ownership is by path:
- Cells under the network's path are owned (die with network)
- Cells elsewhere are referenced (survive network death)

Building a network = putting to its capability endpoints:

```javascript
// Add cells to network
put bl:///networks/my-net/cells { add: ["bl:///cells/a", "bl:///cells/b"] }

// Add propagator
put bl:///networks/my-net/propagators {
  add: {
    sources: ["bl:///cells/a/value", "bl:///cells/b/value"],
    combiner: "bl:///combiners/sum",
    target: "bl:///cells/total/write"
  }
}
```

The network handles connections internally. You interact with it through its exposed capabilities.

## Resolution

Resolution = store lookup + capability filtering.

```
get bl:///cells/counter
       │
       ▼
┌─────────────────────────────────┐
│           Resolver              │
│  1. Look up path in store       │
│  2. Filter by capabilities      │
│  3. Return { headers, body }    │
└─────────────────────────────────┘
       │
       ▼
     Store
```

Sub-paths aren't special — they're just resources at those paths:

```javascript
// All separate stored documents
store.get("cells/counter")        // compound with links
store.get("cells/counter/value")  // scalar: 42
store.get("cells/counter/write")  // write endpoint resource
store.get("cells/counter/meta")   // compound with meta links
```

The "structure" of a cell (having value, write, meta) is just convention — the cell document contains URIs pointing to other stored resources.

## Contexts (Implicit via Paths)

Path hierarchy is scoping:

```
bl:///sessions/abc/counter
bl:///sessions/abc/total
bl:///sessions/def/counter
```

Killing `bl:///sessions/abc` kills everything under it. Like `rm -rf`.

No explicit "context" type needed. Paths ARE contexts.

```javascript
// Kill a context
put bl:///sessions/abc/meta/kill
// → deletes all resources under sessions/abc/
```

## Intercession

Meta-level operations are just more resources, exposed via the `meta` link:

```javascript
get bl:///cells/counter/meta
// → {
//   type: "bl:///types/meta",
//   state: "bl:///cells/counter/meta/state",
//   kill: "bl:///cells/counter/meta/kill",
//   history: "bl:///cells/counter/meta/history"
// }
```

Each link under `meta` is a capability for introspection or control. What's available depends on the resource type and your access level:
- Cell: state, kill, history, resolve (contradictions)
- Propagator: state, kill, pause, rebind
- Any resource under a path: kill (cascades to children)

## Resource Access

When you access a resource:

1. **Try store** — look up the path
2. **If exists** — return it (filtered by resolver)
3. **If missing + body provided** — create from body
4. **If missing + no body** — fail

```javascript
// Get existing
get bl:///cells/counter
// → returns stored document

// Create new (body has type)
put bl:///cells/new-counter {
  type: "bl:///types/cell",
  lattice: "bl:///lattices/max",
  initial: 0
}
// → creates cell + sub-resources, returns created document

// Access missing with no body
get bl:///cells/doesnt-exist
// → error: not found
```

## Capabilities

Each resolver decides what to expose. There's no global capability system.

Request headers carry context (identity, tokens, etc.):

```javascript
{
  headers: { session: "abc123" },
  body: "bl:///cells/counter"
}
```

The resolver uses this to decide what to return. Different resolvers can have different rules:
- Some might expose everything
- Some might filter based on the requester
- Some might require specific headers

The store has the complete document. The resolver filters based on its own logic.
