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

## Why URIs?

Because you can store them now and resolve them later. Middleware decides what they mean at runtime.

You can sandbox things—middleware controls what's resolvable. You can move resources around without breaking anything. You can define new resource types just by writing handlers.

In distributed systems, no node has the complete picture. URIs let you point at things you don't have yet, and figure it out when you need to.

## The Building Blocks

**Types are resources too.** `headers.type` points to a type definition you can fetch.

**Links go both ways.** The link index tracks who references what, so you can query in either direction.

**Cells** are values with merge semantics. Write 5, then write 3, you still get 5 (max wins). Concurrent updates just merge—no coordination needed.

**Propagators** wire cells together. Change an input, the output updates.

## Quick Start

```bash
node apps/cli/src/daemon.js

# store something
curl -X PUT "http://localhost:9111?uri=bl:///data/users/alice" \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice"}'

# get it back
curl "http://localhost:9111?uri=bl:///data/users/alice"
```

## Cells

```bash
# create a cell
curl -X PUT "http://localhost:9111?uri=bl:///cells/counter" \
  -H "Content-Type: application/json" \
  -d '{"lattice": "maxNumber"}'

# write values (max wins)
curl -X PUT "http://localhost:9111?uri=bl:///cells/counter/value" \
  -H "Content-Type: application/json" -d '5'
curl -X PUT "http://localhost:9111?uri=bl:///cells/counter/value" \
  -H "Content-Type: application/json" -d '3'   # still 5
curl -X PUT "http://localhost:9111?uri=bl:///cells/counter/value" \
  -H "Content-Type: application/json" -d '10'  # now 10
```

Lattices: `maxNumber`, `minNumber`, `setUnion`, `lww`.

## Propagators

```bash
# a + b -> sum
curl -X PUT "http://localhost:9111?uri=bl:///propagators/add" \
  -H "Content-Type: application/json" \
  -d '{"inputs": ["bl:///cells/a", "bl:///cells/b"], "output": "bl:///cells/sum", "handler": "sum"}'
```

Handlers: `sum`, `product`, `passthrough`, `constant`.

## Packages

```
packages/core/           # router, links, plumber
packages/cells/          # cells
packages/propagators/    # propagators
packages/store-node/     # file storage
packages/server-node/    # http + websocket

apps/cli/                # daemon
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
