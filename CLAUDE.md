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

## Architecture

```
packages/core/
├── src/
│   ├── setup.js          # createBassline() with standard handlers
│   ├── bassline.js       # URI router (mounts Mirrors at paths)
│   ├── types.js          # Value types: Word, Ref
│   ├── graph/
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

## Quick Start

```javascript
import { createBassline, Cell, ref } from '@bassline/core';

const bl = createBassline();

// Mount a cell at a path - reifies a mutable value
bl.mount('/counter', new Cell(0));

// All access goes through the Mirror (intercession)
bl.read('bl:///counter');           // 0
bl.write('bl:///counter', 42);      // Mirror handles the write
bl.watch('bl:///counter', v => {}); // Mirror decides what changes to emit
```

## Mirrors

A Mirror is a reflective object that reifies some part of the system and intercedes on access to it.

### Built-in Mirrors

| Mirror | Reifies | Intercession |
|--------|---------|--------------|
| Cell | Mutable value | Direct read/write |
| Fold | Computed value | Recomputes from sources |
| RemoteMirror | WebSocket peer | Proxies to remote system |

### Standard Handlers

Handlers are factory functions that create mirrors on demand:

```javascript
// createBassline() mounts these by default:
bl.mount('/cell', createCellHandler());    // bl:///cell/name → Cell
bl.mount('/fold', createFoldHandler());    // bl:///fold/name?sources=... → Fold
bl.mount('/remote', createRemoteHandler()); // bl:///remote/name?address=... → Remote
bl.mount('/action', createActionHandler()); // bl:///action/name → Write-only trigger
```

### Custom Mirrors

```javascript
import { BaseMirror } from '@bassline/core/mirror';

class EthBlockMirror extends BaseMirror {
  get readable() { return true; }
  get writable() { return false; }

  read() {
    return this.provider.getBlock('latest');
  }
}

bl.mount('/eth/blocks', new EthBlockMirror(provider));
bl.read('bl:///eth/blocks'); // Returns latest block
```

### Path-Aware Mirrors

Mirrors that need to inspect the URI use `readRef`/`writeRef`/`watchRef`:

```javascript
class RegistryMirror extends BaseMirror {
  readRef(ref, bassline) {
    const path = ref.pathname;
    if (path === '/registry/mounts') {
      return bassline.listMounts();
    }
    // ... handle other paths
  }
}
```

## Value Types

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
```

## Graph (Optional)

For applications that need structured data:

**Quad** - `(entity, attribute, value, context)`:
```javascript
import { quad, Graph } from '@bassline/core/graph';
import { word } from '@bassline/core/types';

const q = quad(word('alice'), word('age'), 30, word('facts'));
const g = new Graph();
g.add(q);
```

## Serialization

Mirrors define their own serialization:

```javascript
const json = mirror.toJSON();  // { $mirror: 'cell', value: 42 }
const restored = deserializeMirror(json);
```

Tagged encoding:
- Words: `{ $word: "NAME" }`
- Refs: URI strings (already self-describing)
- Mirrors: `{ $mirror: "type", ...config }`

## Running

```bash
pnpm install
pnpm test
```

## License

AGPLv3
