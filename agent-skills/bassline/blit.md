# Blits - Persistent Applications

Blits are self-contained, SQLite-backed applications. Load a `.blit` file and it configures itself with cells, stores, and boot scripts.

## Loading a Blit

```javascript
import { createBlits } from '@bassline/blit'

const blits = createBlits()

// Load a blit file
await blits.put({ path: '/myapp' }, { path: './myapp.blit' })

// Access blit contents via forwarding
await blits.get({ path: '/myapp/cells/counter/value' })
await blits.put({ path: '/myapp/store/config' }, { theme: 'dark' })
```

## Blit Operations

### Load a Blit

```javascript
await blits.put(
  { path: '/myapp' },
  {
    path: './myapp.blit', // Path to SQLite file
    force: false, // Re-run boot script even if already initialized
    readonly: false, // Load in readonly mode (no writes)
  }
)
```

Returns:

```javascript
{
  headers: { type: '/types/blit' },
  body: {
    name: 'myapp',
    path: './myapp.blit',
    loaded: true,
    bootOutput: { /* result of boot script */ }
  }
}
```

### Get Blit Info

```javascript
const { body } = await blits.get({ path: '/myapp' })
// { name: 'myapp', path: './myapp.blit', loaded: true, bootOutput: {...} }
```

### Checkpoint (Save State)

Cells are kept in memory for performance. Checkpoint writes them to SQLite:

```javascript
await blits.put({ path: '/myapp/checkpoint' }, null)
```

### Close a Blit

Checkpoints and closes the SQLite connection:

```javascript
await blits.put({ path: '/myapp/close' }, null)
```

### List Loaded Blits

```javascript
const { body } = await blits.get({ path: '/' })
// { name: 'blits', resources: { '/myapp': {}, '/other': {} } }
```

## Accessing Blit Contents

Once loaded, access blit resources by path:

```javascript
// Cells
await blits.get({ path: '/myapp/cells/counter/value' })
await blits.put({ path: '/myapp/cells/counter/value' }, 42)

// Store
await blits.get({ path: '/myapp/store/config' })
await blits.put({ path: '/myapp/store/users/alice' }, { name: 'Alice' })

// Functions (if registered by boot script)
await blits.get({ path: '/myapp/fn/myFunction' })
```

## SQLite Schema

A blit file contains these tables:

| Table    | Purpose                                            |
| -------- | -------------------------------------------------- |
| `_boot`  | Boot script (`init.tcl`) and initialization status |
| `_cells` | Cell state: key, lattice type, serialized value    |
| `_store` | Key/value storage                                  |
| `_fn`    | Stored functions                                   |

## Boot Scripts

Boot scripts are TCL code stored in `_boot` under key `init.tcl`. They run once when the blit first loads (tracked by `_initialized` key).

### Creating a Boot Script

Write TCL code to initialize your blit:

```tcl
# init.tcl - runs on first load

# Create cells with lattices
cell create counter -lattice maxNumber
cell create tags -lattice setUnion
cell create config -lattice object

# Set initial values
cell set counter 0
cell set tags {todo feature}

# Store configuration
store set app_name "My Application"
store set version "1.0.0"

# Access parent kit if needed
kit get /config/global
```

### Boot Script Commands

See `tcl.md` for full TCL syntax. Blit-specific commands:

#### cell

```tcl
cell create <name> -lattice <type>    # Create a cell (idempotent)
cell get <name>                        # Get cell config as JSON
cell set <name> <value>                # Merge value into cell
cell value <name>                      # Get current value
cell exists <name>                     # Returns 1 or 0
```

#### store

```tcl
store get <key>                        # Get value (empty if missing)
store set <key> <value>                # Set value (TCL dict → JSON object)
store keys                             # List all keys
store delete <key>                     # Delete key
```

#### sql

```tcl
sql query "SELECT * FROM _store WHERE key LIKE ?" "user%"
sql execute "INSERT INTO custom_table VALUES (?, ?)" $a $b
```

Returns TCL-formatted results.

#### kit

```tcl
kit get /path/to/resource              # GET from parent kit
kit put /path/to/resource <value>      # PUT to parent kit
```

### Force Re-running Boot

```javascript
await blits.put(
  { path: '/myapp' },
  {
    path: './myapp.blit',
    force: true, // Re-run boot even if already initialized
  }
)
```

## Creating a New Blit

```javascript
import { createSQLiteConnection } from '@bassline/database'

// Create empty SQLite file
const conn = createSQLiteConnection({ path: './newapp.blit' })

// Initialize schema (createBlits does this automatically, but for manual setup):
conn.execute(`
  CREATE TABLE IF NOT EXISTS _boot (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS _cells (key TEXT PRIMARY KEY, lattice TEXT, value TEXT);
  CREATE TABLE IF NOT EXISTS _store (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS _fn (key TEXT PRIMARY KEY, value TEXT);
`)

// Add boot script
conn.execute(`INSERT INTO _boot (key, value) VALUES ('init.tcl', ?)`, [
  `
    cell create counter -lattice maxNumber
    cell set counter 0
    store set config {name "New App" version "1.0"}
  `,
])

conn.close()

// Now load it
await blits.put({ path: '/newapp' }, { path: './newapp.blit' })
```

## Readonly Mode

Load blits in readonly mode for safe access:

```javascript
await blits.put(
  { path: '/myapp' },
  {
    path: './myapp.blit',
    readonly: true,
  }
)

// Reads work
await blits.get({ path: '/myapp/cells/counter/value' })

// Writes fail
await blits.put({ path: '/myapp/cells/counter/value' }, 99)
// → { headers: { condition: 'readonly' }, body: null }
```

## Patterns

### Application State Container

```tcl
# Boot script sets up app structure
cell create user -lattice lww
cell create preferences -lattice object
cell create notifications -lattice setUnion

store set routes {
  home /
  profile /user
  settings /settings
}
```

```javascript
// App code
const user = await blits.get({ path: '/myapp/cells/user/value' })
await blits.put({ path: '/myapp/cells/preferences/value' }, { theme: 'dark' })
```

### Periodic Checkpoint

```javascript
// Checkpoint every 5 minutes
setInterval(
  async () => {
    await blits.put({ path: '/myapp/checkpoint' }, null)
  },
  5 * 60 * 1000
)
```

### Multi-Blit Setup

```javascript
// Load multiple blits
await blits.put({ path: '/users' }, { path: './users.blit' })
await blits.put({ path: '/posts' }, { path: './posts.blit' })
await blits.put({ path: '/config' }, { path: './config.blit', readonly: true })

// Access each by name
await blits.get({ path: '/users/store/alice' })
await blits.put({ path: '/posts/cells/count/value' }, 42)
```
