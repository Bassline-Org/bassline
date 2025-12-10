# Bassline

A programming environment for reflective distributed programming.

## Everything is a Resource

Resources have URIs. You `get` and `put` them. They return `{ headers, body }`.

```
bl:///data/users/alice       # a document
bl:///cells/counter          # a value that merges
bl:///propagators/sum        # a reactive computation
bl:///links/to/types/cell    # a query
```

## Design Principles

**Language Agnostic.** The resource model is protocol-based, not library-based. Any language that can make HTTP requests or speak WebSocket can interact with Bassline. The JavaScript implementation is one client among many.

**Location Transparent.** URIs name resources without encoding where they live. A cell at `bl:///cells/counter` could be local, on a remote node, or replicated across many. Resolution happens at runtime based on how middleware is configured.

**Late Binding.** Store URIs now, resolve them later. Middleware decides what they mean at runtime. You can sandbox things by controlling what's resolvable. You can move resources around without breaking references. You can define new resource types by writing handlers.

**Partial Information.** In Bassline, we view every piece of information as partial, part of a bigger picture. Information is never complete. This allows you to build systems incrementally that evolve gracefully.

## The Building Blocks

**Cells** let you have state without requiring a specific order. Concurrent writes merge using lattice semantics. Unlike CRDTs, cells support errors during merges. Errors are data that meta-merge rules can use to decide which value to keep.

**Propagators** wire cells together. Change an input, the output updates.

**Fully Reflective.** Types, links, routes, and the system itself are all resources. You can explore every part of the system dynamically at runtime.

## Quick Start

```javascript
import { Bassline } from '@bassline/core'

const bl = new Bassline()

// Store something
await bl.put('bl:///data/users/alice', {}, { name: 'Alice' })

// Get it back
const result = await bl.get('bl:///data/users/alice')
// → { headers: { type: 'bl:///types/document' }, body: { name: 'Alice' } }
```

## Cells

```javascript
// Create a cell with a lattice
await bl.put('bl:///cells/counter', {}, { lattice: 'maxNumber' })

// Write values (max wins)
await bl.put('bl:///cells/counter/value', {}, 5)
await bl.put('bl:///cells/counter/value', {}, 3)   // still 5
await bl.put('bl:///cells/counter/value', {}, 10)  // now 10
```

Lattices: `maxNumber`, `minNumber`, `setUnion`, `setIntersection`, `lww`, `object`, `counter`, `boolean`. See [packages/cells](./packages/cells) for details.

## Propagators

```javascript
// Wire cells: a + b -> sum
await bl.put('bl:///propagators/add', {}, {
  inputs: ['bl:///cells/a', 'bl:///cells/b'],
  output: 'bl:///cells/sum',
  handler: 'sum'
})
```

60+ built-in handlers for arithmetic, logic, strings, arrays, objects, and more. See [packages/propagators](./packages/propagators) for full list.

## Packages

```
packages/core/           # router, pattern matching
packages/plumber/        # message routing
packages/links/          # bidirectional refs
packages/types/          # type definitions
packages/cells/          # lattice-based cells
packages/propagators/    # reactive computation
packages/timers/         # time events
packages/fetch/          # HTTP requests
packages/monitors/       # URL polling
packages/store-node/     # file storage
packages/server-node/    # http + websocket

apps/cli/                # daemon, MCP server
apps/editor/             # web ui
```

## Running

```bash
pnpm install
pnpm test
```

See [CLAUDE.md](./CLAUDE.md) for more.

## License

AGPLv3
