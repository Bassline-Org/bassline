# @bassline/core

Everything in Bassline is a resource. A resource is a small computational thing that communicates via messages. There are two kinds of messages:

- A **get** is a request for information. It's metadata only — "give me the thing at this name," "list your children," "do you have this?"
- A **put** carries a payload alongside the metadata. It's giving information to the resource — a value to store, a child to mount, a tree to expand.

Payloads can be anything — values, functions, even other messages. The get/put split is just a logical distinction between the two underlying intents: asking vs. telling.

In JavaScript, we expose resources as functions. The presence of a `put` key in the message determines which kind it is:

```javascript
counter({ put: 5 }) // put — giving it a value
counter({}) // get — asking for the value → 5
```

We define resource types using classes (subclassing `Resource` with `get()` and `put()` methods), but that's an API choice, not the concept itself. Resources are the underlying thing that handles the message. The function is the interface, the class is the implementation — both are just how we happened to wire it up in JS.

Scopes, slots, computed values, whole applications — all resources, same message protocol.

## Quick start

```javascript
import { Platform, reducers, scope } from '@bassline/core'

const app = new Platform().use(reducers, scope)

function deploy(platform) {
  platform.root({
    put: {
      counter: platform.create.Slot({ value: 0, reduce: Math.max }),
      title: platform.create.Slot({ value: 'untitled' }),
    },
  })
}

await app.deploy(deploy)

app.root({ walk: 'counter' })({ put: 42 })
app.root({ walk: 'counter' })({}) // → 42
```

## What's in the box

**Portable** (works in browsers and Node):

- `Platform` — wires together modules, deploy scripts, events, and a root scope
- `Resource` — base class. Subclass it, define `get()` and `put()`
- `Slot` — state with a reducer (last-write-wins by default)
- `Max`, `Min`, `Union` — slots with built-in reducers
- `Scope` — namespace that maps names to child resources, with walk/mount/tree expansion

**Node-specific** (import separately):

- `@bassline/core/platforms/http` — HTTP server that projects the resource tree as a REST API
- `@bassline/core/platforms/fuse` — FUSE filesystem projection (requires `@bassline/fs`)
- `@bassline/core/modules/tracing` — structured event logging to stdout

## Modules and deploy scripts

Everything has the same shape: `(platform) => void`.

Modules extend the platform with new resource classes. Deploy scripts mount resources into the tree. They compose the same way:

```javascript
const app = new Platform()
  .use(reducers, scope) // modules
  .use(http, tracing) // more modules

await app.deploy(a, b, c) // deploy scripts
```

Deploy scripts can declare `.tags` (what they provide) and `.dependencies` (what they need). The platform topologically sorts them so dependencies run first. Give a script an `.id` and it only runs once.

## Messages

Resources respond to messages. Scopes understand:

```javascript
scope({}) // list children
scope({ at: 'name' }) // resolve child
scope({ walk: 'a/b/c' }) // walk a path
scope({ has: 'name' }) // check existence
scope({ put: fn, at: 'name' }) // mount a resource
scope({ put: null, at: 'x' }) // remove
scope({ put: { a: { b: fn } } }) // tree expansion
```

## License

AGPL-3.0
