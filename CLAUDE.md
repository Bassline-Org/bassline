# Bassline

A programming environment where everything is a resource.

## The Core Idea

A resource is a function that receives a message. One key splits it:

- Has `put`? → `put(body, rest)` — write
- Otherwise → `get(msg)` — read

```javascript
resource({ put: 42 })           // → put(42, {})
resource({ put: fn, at: 'x' })  // → put(fn, { at: 'x' })
resource({})                     // → get({})
resource({ at: 'counter' })     // → get({ at: 'counter' })
```

Cells, scopes, computed values, entire applications — all resources. Same interface.

## The Uniform Function

**Everything is `(platform) => void`.**

A module, a deploy script, a platform extension — they're all the same thing: a single function that receives a platform and does its work. No imports. No dependencies. Just the platform.

```javascript
// A module that defines a new resource class
export default function (platform) {
  class MyThing extends platform.classes.Resource {
    get() { return this.value }
    put(v) { this.value = v }
  }
  platform.define({ MyThing })
}

// A deploy script that mounts resources
function setup(platform) {
  platform.root({ put: platform.create.Slot({ value: 0 }), at: 'counter' })
}

// Both have the same shape: (platform) => void
```

This matters because:

- **No imports** — modules get everything from the platform. No `import { Slot } from '@bassline/core'`. The platform provides `platform.create.Slot()`, `platform.classes.Resource`, etc.
- **Same shape as each other** — modules, deploy scripts, and platform extensions all compose the same way: `platform.use(a, b, c)` or `platform.deploy(x, y, z)`.
- **No build step required** — a module is a function, not a package. You can load it from a file, a database, over the network, or evaluate it in a sandbox. Distribution is "send the function."
- **Platform = host environment** — the platform provides everything the function needs. Swap the platform and the function sees a different world without knowing. This is information hiding: a gated platform with fewer classes or a narrower root is a capability boundary.

## Platform

Resources live on a platform. The platform provides classes, a root scope, events, and deployment.

```javascript
const app = new Platform()
  .use(reducers, scope)
  .use(http, tracing)

await app.deploy(deployCells, deployCompute)
app.serve()
```

Platforms can be arbitrarily small and gated. Give a script a smaller platform with fewer modules or a narrower root, and that's all it can see. The script can't tell the difference.

## Message Protocols

Resources are defined by which messages they understand.

Get messages:

```javascript
resource({})                  // empty read — "tell me what you are"
resource({ at: 'counter' })  // resolve child by name
resource({ walk: 'a/b/c' })  // walk path through nested scopes
resource({ has: 'x' })       // check existence (boolean)
resource({ meta: 'x' })      // retrieve metadata for a binding
```

Put messages:

```javascript
resource({ put: 5 })                           // reduce: merge via reducer
resource({ put: fn, at: 'x' })                 // mount child at name
resource({ put: fn, at: 'x', meta: {} })       // mount with metadata
resource({ put: null, at: 'x' })               // remove child
resource({ put: { a: fn1, b: fn2 } })          // tree expansion into nested scopes
resource({ put: fn, prefix: 'a/b', at: 'x' }) // auto-create intermediates
```

## Core Resources

### Slot

State with a reducer. The reducer defines what "write" means.

```javascript
const counter = platform.create.Slot({ value: 0, reduce: Math.max })
counter({ put: 5 })  // → 5
counter({ put: 3 })  // → 5 (max wins)
counter({})           // → 5
```

Built-in: `Slot` (last-write-wins), `Max`, `Min`, `Union` (set accumulation).

### Scope

Namespace — maps names to children. Plain objects expand recursively into nested scopes. Merge-safe.

```javascript
root({ put: { cells: { counter, title, tags } } })
root({ at: 'cells' })({ at: 'counter' })({})  // → 0
root({ walk: 'cells/counter' })({})            // same thing
```

Dynamic children: `Scope({ lookup(name) {}, list() {} })`

## Deploy

Scripts mount resources into the root. Topologically sorted by tags/dependencies, with idempotency.

```javascript
function deployCells(platform) {
  platform.root({ put: {
    cells: {
      counter: platform.create.Slot({ value: 0, reduce: Math.max }),
      title: platform.create.Slot({ value: 'untitled' }),
    }
  }})
}
deployCells.tags = ['cells']
deployCells.id = 'deploy-cells'
```

Scripts can have `.tags` (provides), `.dependencies` (requires), `.id` (run-once), `.skip` (conditional).

## Projections

Same resource tree projects onto multiple external protocols.

**HTTP:** `GET /cells/counter` walks to resource, returns JSON. `PUT` writes through reducer. `X-Bl` header for arbitrary messages.

**FUSE:** Scopes → directories. Slots → read/write files. Compute-on-read → read-only files. `cat /mnt/app/cells/counter` reads. `echo 42 > /mnt/app/cells/counter` writes.

## Events

`resource.mounted`, `resource.unmounted`, `resource.changed`, `resource.fired`, `resource.created`.

```javascript
platform.on('resource.mounted', e => console.log(e.name))
```

## Direction

### What subsumes what

The current primitives (Platform, Scope, Slot, deploy) replace almost everything the old system had:

- **Slot** (generalized reducers) → replaces cells, store
- **Scope** (namespace with walk/mount/tree expansion) → replaces routes, bind, plumber
- **Platform** (modules, deploy, events) → replaces deployment, daemon, orchestrator, circuit
- **Projections** (HTTP, FUSE) → replaces the node package's http/ws servers

What remains as genuinely distinct concerns:

- **Propagators** — "when this changes, recompute that." Subscribe to input changes, run a function, write the output. A module, not a framework. The old combinators were overengineered.
- **Remote scope** — bridge a scope over a transport (WebSocket, stdio, etc.). This generalizes all transports into one pattern: the walk message works the same whether the scope is local or remote.
- **Gated scope** — a scope that checks capabilities before forwarding. Sits at the boundary of a remote connection or an untrusted module. The platform-as-capability-boundary idea, made concrete.
- **Persistence** — Slot/Scope backed by SQLite or similar. A module that wraps the in-memory primitives.

### FUSE decoupling

The Rust FUSE binary should be a standalone CLI tool, not a native Node addon. The JS side connects to it over a transport (stdio/socket). This is just another remote scope — the FUSE daemon sends resource messages, the JS side serves them. Decoupling means: no napi-rs compilation, independent lifecycle, works with any backend.

### Target structure

```
packages/
  core/         # Platform, Resource, Scope, Slot/Max/Min/Union
                # Modules: reducers, scope, propagators, tracing
                # Projections: http, remote scope
  eth/          # Ethereum JSON-RPC as a resource tree (proof of pattern)

apps/
  visual/       # Visual inspector UI (untouched for now)

fuse/           # Standalone Rust FUSE binary
```

## Key Files

- `packages/core/src/alt/platform.js` — Platform, Resource, dispatch, deploy, create proxy
- `packages/core/src/alt/modules/scope.js` — Scope
- `packages/core/src/alt/modules/reducers.js` — Slot, Max, Min, Union
- `packages/core/src/alt/platforms/http.js` — HTTP projection
- `packages/core/src/alt/platforms/fuse.js` — FUSE projection (to be decoupled)
- `packages/core/src/alt/modules/tracing.js` — structured event logging
- `packages/core/src/alt/protocols.md` — full protocol documentation

## Running

```bash
pnpm install
pnpm test
```

## License

AGPLv3
