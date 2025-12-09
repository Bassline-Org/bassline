# Bassline Core

Minimal resource model for reflective distributed programming. ~100 lines.

## Overview

Everything is a **resource**. Resources are:
- **Owned by stores** - the store is the authority
- **Materialized from documents** - URI + stored data = runtime object
- **Accessed via get()** - returns a filtered ref (capabilities)

```
URI ──store.resolve()──▶ Resource (full capabilities)
                              │
                              │ get(headers)
                              ▼
                         Ref (filtered view)
                         { type: '...',
                           value: 'bl:///...',  ← capability (URI)
                           // write: not included = no access
                         }
```

## Package Structure

```
packages/core/src/
├── resource.js   # Materialized runtime object
├── store.js      # Authority that owns resources
├── bassline.js   # Routes URIs to stores
└── index.js      # Exports
```

## Core Concepts

### Resource

A materialized runtime object with full capabilities.

```javascript
import { Resource } from '@bassline/core'

class Cell extends Resource {
  _initFromDocument(doc) {
    this._type = doc.type
    this._value = doc.value ?? doc.initial ?? null
    this._lattice = doc.lattice
  }

  get(headers = {}) {
    // Filter capabilities based on headers
    const ref = { type: this._type, value: this._value }
    if (headers.role === 'admin') {
      ref.write = `${this.uri}/write`
      ref.meta = `${this.uri}/meta`
    }
    return ref
  }
}
```

### Store

The authority that owns, materializes, and stores resources.

```javascript
import { MemoryStore } from '@bassline/core'

const store = new MemoryStore()

// Bootstrap: save a document
store._save('bl:///cells/counter', {
  type: 'bl:///types/cell',
  value: 42
})

// Resolve: URI → Resource
const counter = store.resolve('bl:///cells/counter')

// Modify and persist
counter._value = 100
counter.save()
```

### Bassline

Routes URIs to the appropriate store via prefix matching.

```javascript
import { Bassline, MemoryStore } from '@bassline/core'

const bl = new Bassline()
const cellStore = new MemoryStore()
const userStore = new MemoryStore()

bl.mount('/cells', cellStore)
bl.mount('/users', userStore)

// Routes to cellStore
const counter = bl.resolve('bl:///cells/counter')

// Routes to userStore
const alice = bl.resolve('bl:///users/alice')
```

## API

### Resource

```javascript
new Resource(uri, doc, store)
```

| Method | Description |
|--------|-------------|
| `get(headers)` | Returns filtered ref (capabilities) |
| `serialize()` | Returns document for storage |
| `save()` | Persist to store |
| `resolve(uri)` | Resolve another URI via this resource's store |

Override in subclasses:
- `_initFromDocument(doc)` - Initialize state from document
- `_buildRef(headers)` - Customize capability filtering

### Store

```javascript
new Store()        // Abstract base
new MemoryStore()  // In-memory implementation
```

| Method | Description |
|--------|-------------|
| `resolve(uri)` | Materialize URI → Resource (cached) |
| `store(resource)` | Serialize and save resource |

Override in subclasses:
- `_load(uri)` - Load document from storage
- `_save(uri, doc)` - Save document to storage
- `_materialize(uri, doc)` - Create type-specific Resource

### Bassline

```javascript
new Bassline()
```

| Method | Description |
|--------|-------------|
| `mount(prefix, store)` | Register store at prefix |
| `storeFor(uri)` | Find store (longest prefix match) |
| `resolve(uri)` | Route to store and resolve |

## Usage

```javascript
import { Bassline, MemoryStore, Resource } from '@bassline/core'

const bl = new Bassline()
const store = new MemoryStore()
bl.mount('/things', store)

// Bootstrap
store._save('bl:///things/foo', {
  type: 'bl:///types/thing',
  name: 'Foo',
  related: 'bl:///things/bar'
})

// Resolve
const foo = bl.resolve('bl:///things/foo')

// Get filtered capabilities
const ref = foo.get({ role: 'public' })
// { type: '...', name: 'Foo', related: 'bl:///things/bar' }

// Traverse
const bar = foo.resolve(ref.related)

// Modify and persist
foo._data.name = 'Updated'
foo.save()
```

## Key Principles

1. **Store is the authority** - owns, materializes, and stores resources
2. **Resource = full runtime object** - all capabilities
3. **Ref = filtered view** - URIs in the ref ARE your capabilities
4. **Document = serialized resource** - what gets stored
5. **Bassline = router** - maps URI prefixes to stores

## Tests

```bash
pnpm test
```

## License

AGPL-3.0
