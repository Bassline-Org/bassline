# @bassline/store-node

File and code stores for Bassline (Node.js).

## Install

```bash
pnpm add @bassline/store-node
```

## Usage

### File Store

JSON document persistence.

```javascript
import { Bassline } from '@bassline/core'
import { createFileStore } from '@bassline/store-node'

const bl = new Bassline()
bl.install(createFileStore('.data', '/data'))

// Write document
await bl.put('bl:///data/users/alice', {}, { name: 'Alice' })

// Read document
const user = await bl.get('bl:///data/users/alice')
// { headers: { type: 'bl:///types/json' }, body: { name: 'Alice' } }

// List directory
const dir = await bl.get('bl:///data/users')
// { body: { entries: [{ name: 'alice', uri: 'bl:///data/users/alice' }] } }
```

### Code Store

Load JS modules as resources.

```javascript
import { createCodeStore } from '@bassline/store-node'

bl.install(createCodeStore(null, '/code'))

// Register a module
await bl.put('bl:///code/math', {}, { path: './math.js' })

// Load and use
const mod = await bl.get('bl:///code/math')
mod.body.add(1, 2)  // call exported function
```

## Exports

- `createFileStore(dir, prefix)` - JSON file store
- `createCodeStore(dir, prefix)` - JS module loader

## Dynamic Installation

Install via the daemon's module system:

```javascript
await bl.put('bl:///install/file-store', {}, {
  path: './packages/store-node/src/upgrade-file-store.js',
  dataDir: '.data',
  prefix: '/data'
})
```

## Related

- [@bassline/core](../core) - Router and utilities
- [@bassline/server-node](../server-node) - HTTP and WebSocket servers
