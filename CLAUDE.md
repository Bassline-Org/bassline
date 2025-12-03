# Bassline

A toolkit for building self-ordering distributed systems.

## The Core Insight

Traditional distributed systems rely on top-down protocols: predefined message formats, fixed endpoints, rigid schemas. Bassline takes a different approach based on **reflective programming**:

**Mirrors** are reflective objects that provide controlled **reification** and **intercession**:

- **Reification** - System internals become first-class data. State, connections, computations - all are objects you can inspect, serialize, and pass around.
- **Intercession** - Access to those objects passes through the Mirror, which can transform, validate, log, or redirect operations.

This is metaprogramming, but controlled. Mirrors expose exactly what they choose to expose. They define their own vocabulary. They mediate all access.

**URIs** make everything addressable. Resources are identified by self-describing URIs where the scheme determines how to resolve it:

- `bl:///counter` - local mirror (your local view)
- `ws://peer.example.com:8080` - WebSocket connection
- `http://api.example.com/data` - HTTP resource
- `ipfs://Qm.../file` - IPFS content

All of these are valid Refs. The `bl://` scheme is specifically for your local mirror namespace. Other schemes reference external resources directly.

Together, this creates an **open-world model**: systems emerge from local, bottom-up interactions rather than global coordination.

## Why This Matters for Decentralized RPC

Ethereum's RPC layer is a collection of rigid, provider-specific interfaces. Each client, indexer, or service defines its own API surface. There's no uniform way to compose, intercept, or transform these interfaces.

Bassline provides a programmable access layer:
- URIs address any resource uniformly (local or remote)
- Mirrors intercept and transform access patterns (intercession)
- Local state and remote peers share the same abstraction (reification)
- Systems can self-organize without central coordination

A Mirror wrapping an Ethereum node can reify blocks, transactions, and state as addressable resources. Another Mirror can intercede to cache, batch, or route requests across multiple providers.

## Architecture

```
packages/core/
├── src/
│   ├── setup.js          # createBassline() with standard handlers
│   ├── bassline.js       # URI router (mounts Mirrors at paths)
│   ├── types.js          # Value types: Word, Ref
│   ├── algebra/
│   │   ├── quad.js       # Quad: (entity, attribute, value, context)
│   │   └── graph.js      # Graph: container for quads
│   └── mirror/
│       ├── interface.js  # BaseMirror class
│       ├── handlers.js   # Factory functions for standard handlers
│       ├── cell.js       # Cell: mutable value
│       ├── fold.js       # Fold: computed from sources
│       ├── remote.js     # RemoteMirror: WebSocket connection
│       ├── serialize.js  # Mirror serialization
│       └── index.js      # Public API
└── test/
    └── *.test.js
```

## Mirrors

A Mirror is a reflective object that reifies some part of the system and intercedes on access to it:

```javascript
import { createBassline, Cell, ref } from '@bassline/core';

const bl = createBassline();

// Mount a cell at a path - reifies a mutable value
bl.mount('/counter', new Cell(0));

// All access goes through the Mirror (intercession)
bl.read('bl:///counter');           // Mirror decides what to return
bl.write('bl:///counter', 42);      // Mirror decides how to handle writes
bl.watch('bl:///counter', v => {}); // Mirror decides what changes to emit
```

### Built-in Mirrors

| Mirror | Reifies | Intercession |
|--------|---------|--------------|
| Cell | Mutable value | Direct read/write |
| Fold | Computed value | Recomputes from sources on read |
| RemoteMirror | WebSocket peer | Proxies to remote system |

### Custom Mirrors

Mirrors define their own vocabulary and access patterns:

```javascript
import { BaseMirror } from '@bassline/core/mirror';

class EthBlockMirror extends BaseMirror {
  // Reify Ethereum blocks as readable resources
  readRef(ref, bassline) {
    const blockNum = ref.searchParams.get('block') || 'latest';
    return this.provider.getBlock(blockNum);
  }

  // Intercede on watch to set up block subscriptions
  watchRef(ref, callback, bassline) {
    return this.provider.on('block', callback);
  }
}

bl.mount('/eth/blocks', new EthBlockMirror(provider));
bl.read('bl:///eth/blocks?block=latest');
bl.watch('bl:///eth/blocks', block => console.log('New block:', block.number));
```

## URI-Based Addressing

Resources are identified by URIs. The scheme determines how to resolve:

```javascript
import { ref } from '@bassline/core';

// bl:// - your local mirror namespace
ref('bl:///counter')              // Local cell
ref('bl:///eth/blocks?block=12345') // Local mirror wrapping Ethereum

// ws:// - WebSocket connections (external)
ref('ws://peer.example.com:8080')

// Other schemes - references to external resources
ref('http://api.example.com/data')
ref('ipfs://QmYwAPJzv5CZsnA.../file')
```

The `bl://` scheme is for your local view - mirrors you've mounted. Other schemes are references to external resources. A Ref is just a URI - it's self-describing and requires no global schema.

## Value Types

Two primary types with semantic meaning:

**Word** - Case-insensitive identifier (interned symbol):
```javascript
import { word } from '@bassline/core/types';
word('alice') === word('ALICE')  // true (same symbol)
```

**Ref** - URI reference to any resource:
```javascript
import { ref } from '@bassline/core/types';
ref('bl:///counter').scheme      // 'bl' (local)
ref('ws://peer:8080').scheme     // 'ws' (external)
ref('ipfs://Qm.../x').scheme     // 'ipfs' (external)
```

Primitives (strings, numbers) pass through unchanged.

## The Open-World Model

Traditional systems define schemas upfront. Bassline inverts this:

1. **Mount mirrors locally** - Each node decides what to reify and how to intercede
2. **Compose via URIs** - References are just strings until resolved
3. **Transform at boundaries** - Mirrors intercept and transform at their discretion
4. **Emerge structure** - Patterns arise from local interactions, not global coordination

This is bottom-up, not top-down. No global consensus on schema. No central authority.

## Serialization

Mirrors define their own serialization:

```javascript
// Serialize a mirror (reification of the mirror itself)
const json = mirror.toJSON();  // { $mirror: 'cell', value: 42 }

// Deserialize
const restored = deserializeMirror(json);
```

Special values use tagged encoding:
- Words: `{ $word: "NAME" }`
- Refs: just URI strings (already self-describing)

## Running

```bash
pnpm install
pnpm test
```

## License

AGPLv3
