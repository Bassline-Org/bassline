# Resource Protocols

A resource is a function that receives a message and returns a result. Dispatch splits messages into two categories — **get** (read) and **put** (write) — based on whether a `put` key is present. But get and put are just the routing mechanism. The actual protocols are the message vocabularies within each category.

A resource is defined by which messages it understands.

---

## Get Messages

### Empty read: `{}`

The most basic get. Every resource that can be read at all responds to this. What it returns is entirely up to the resource — a number, a string, an object, a set, a listing of child names. The empty read is "tell me what you are."

Slot returns its current value. Scope returns `{ hrefs: [...names] }`. A compute-on-read resource runs its function and returns the result. These are three completely different responses to the same message.

### Resolve: `{ at }`

Ask for a specific child by name. Returns a resource function. This is how you navigate one level into a namespace — you get back another resource you can send further messages to.

Resolution has two phases: check static entries first, then fall back to a dynamic `lookup` function if one was provided. Static entries take precedence.

### Walk: `{ walk }`

Resolve a path through multiple levels at once. Accepts a string (`'a/b/c'`) or array (`['a', 'b', 'c']`). Walk is a recursive protocol — the resource peels the first segment via resolve, then delegates `{ walk: rest }` to the child. Each resource in the chain only sees one segment.

Walk is what platforms use to turn a path into a resource. HTTP splits the URL, FUSE splits the file path, both send the same walk message.

### Existence: `{ has }`

Check whether a name exists without resolving it. Returns a boolean. Cheaper than resolve when you don't need the child itself — resolve throws on missing names, has just returns false.

### Metadata: `{ meta }`

Retrieve out-of-band information stored alongside a name. Returns an object or null. Metadata is about the *binding* (the name-to-child relationship), not about the child resource itself. FUSE uses this for size hints so it doesn't have to read every resource during `ls`.

---

## Put Messages

Dispatch extracts the `put` key as the body and passes the remaining keys as headers: `{ put: body, ...headers }` → `put(body, headers)`.

### Reduce: `put(value, {})`

The simplest write. The resource receives a value and merges it with its current state through a reducer: `reduce(previous, current) → next`. The reducer defines what "write" means:

- Last-write-wins (replace)
- `Math.max` (monotonic maximum)
- `Math.min` (monotonic minimum)
- Set union (accumulate)
- Custom (e.g. side-effecting — the eth `ctl` resources populate a cache in their reducer)

The reducer is the resource's merge semantics. Writing `3` to a max-resource holding `5` is a no-op. Writing `'tag'` to a union-resource adds it to the set. The same put message means different things to different resources.

### Mount: `put(fn, { at })` / `put(fn, { at, meta })`

Attach a resource function as a child at a given name. Optionally include metadata. This is how namespaces grow — you put a resource into them with a name.

### Remove: `put(null, { at })`

Delete a child by name. The null body signals removal.

### Tree expansion: `put(plainObject, {})` / `put(plainObject, { at })`

A plain JS object is expanded recursively into nested namespaces. `put({ cells: { counter, title } })` creates a `cells` namespace containing `counter` and `title`. This is merge-safe — expanding into an existing namespace adds new children without disturbing existing ones.

### Prefix: `put(body, { prefix, at })`

Create intermediate namespaces along a path, then mount at the end. `put(leaf, { prefix: 'a/b', at: 'x' })` ensures `a` and `b` exist as namespaces, then mounts `leaf` as `x` inside `b`.

---

## What a Resource Is

A resource is the set of messages it responds to. Scope happens to respond to resolve, walk, has, meta, mount, remove, and tree expansion. Slot happens to respond to empty-read and reduce. A compute-on-read resource responds only to empty-read. But none of these are closed categories — they're just the vocabularies we've defined so far.

A resource that responds to `{ query }` or `{ subscribe }` or `{ at, ifAbsentPut }` or `{ match }` is equally valid. The dispatch mechanism doesn't constrain what messages exist — it only sorts them into get and put.

---

## Platform Projections

Platforms are translators between an external protocol (HTTP, FUSE) and resource messages.

**HTTP** splits a URL into segments, sends `{ walk: segments }` to resolve a resource, then forwards the request as a get or put message. The `X-Bl` header lets clients send arbitrary get messages (like `{ has: 'x' }`) over plain HTTP.

**FUSE** does the same walk, but also needs to classify resources for filesystem semantics (directory vs file, permissions). It inspects resource types via `instanceof` — this is the one place the system looks at *what* a resource is rather than just sending it messages.

Both platforms project the same tree. A resource tree built for one works identically on the other.

---

## Events

Resources announce events as a side channel orthogonal to get/put:

- **changed** — a stored value was written and the result differs from previous
- **mounted** / **unmounted** — a child was added to or removed from a namespace
- **fired** — any dispatch happened (the universal trace point)

These are observation hooks, not messages to the resource. Tracing and other cross-cutting concerns subscribe to them.
