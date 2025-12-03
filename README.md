# Bassline

A pattern-matching graph system for building distributed applications where **time doesn't matter**.

## The Problem

Distributed systems are hard because of ordering and synchronization. Most protocols require global consensus on operation order, making them complex, fragile, and difficult to extend.

## The Solution

Bassline eliminates temporal concerns by making all computation:

- **Monotonic** — Information only accumulates, never retracts
- **Incremental** — We care about convergence, not operation order
- **Reactive** — Patterns fire automatically as data arrives

This means nodes can process information in any order and still converge to the same result.

## Core Concepts

**Quads** are the current standard data format: `(entity, attribute, value, context)`. We are using this for now because it's a nice representation of a piece of "partial information". Each quad represents one fact, and facts accumulate over time, filling in the graph as we process it. It also means all of our data is naturally relational and queryable.

**Patterns** watch for matches. As quads accumulate, patterns fire reactively, enabling derived computations without polling or explicit subscriptions.

**Contexts** isolate concerns. The same entity-attribute-value triple can exist in different contexts (pending vs confirmed, local vs remote, etc.), enabling natural modeling of distributed state.

## Project Structure

```
packages/
├── parser/          # Core graph + pattern matching system
│   ├── src/
│   │   ├── algebra/     # Graph, Quad, Pattern, Watch primitives
│   │   ├── control.js   # High-level control interface
│   │   └── types.js     # Value types and serialization
│   └── extensions/      # IO effects, persistence, connections
└── parser-react/    # React integration
```

## Getting Started

```bash
pnpm install
pnpm test
```

## Documentation

See [CLAUDE.md](./CLAUDE.md) for comprehensive technical documentation.

## Status

Active development. Core primitives are stable.

## License

AGPLv3
