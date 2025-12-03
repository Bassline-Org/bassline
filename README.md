# Bassline

A reflective toolkit for self-ordering distributed applications.

## The Problem

Distributed systems are hard because of complexity at boundaries. Every integration point requires custom code for routing, transformation, caching, and error handling. There's no uniform way to compose these concerns.

## The Solution

Bassline provides a **uniform resource interface** built on two concepts:

**URIs** address everything:
```javascript
bl:///cell/counter      // Local mutable state
bl:///fold/sum          // Computed value
ws://peer:8080          // Remote peer
```

**Mirrors** mediate access:
```javascript
bl.read('bl:///counter')     // Mirror decides what to return
bl.write('bl:///counter', 1) // Mirror decides how to handle
bl.watch('bl:///counter', f) // Mirror decides what to emit
```

This is reflective programming - mirrors reify system internals as first-class resources and intercede on all access, enabling middleware patterns like caching, batching, and transformation.

## Quick Start

```javascript
import { createBassline, Cell, ref } from '@bassline/core';

const bl = createBassline();

// Mount mirrors at paths
bl.mount('/counter', new Cell(0));

// Uniform interface
bl.write('bl:///counter', 42);
bl.read('bl:///counter'); // 42

// Watch for changes
bl.watch('bl:///counter', value => console.log('Changed:', value));
```

## Project Structure

```
packages/
├── core/            # URI router + mirrors
│   ├── src/
│   │   ├── setup.js      # createBassline()
│   │   ├── bassline.js   # URI router
│   │   ├── types.js      # Word, Ref
│   │   ├── graph/        # Quad, Graph
│   │   └── mirror/       # Cell, Fold, Remote
│   └── test/
└── parser-react/    # React integration
```

## Getting Started

```bash
pnpm install
pnpm test
```

## Documentation

See [CLAUDE.md](./CLAUDE.md) for comprehensive technical documentation.

## License

AGPLv3
