# @bassline/database

SQLite database service for Bassline.

## Install

```bash
pnpm add @bassline/database
```

## Usage

```javascript
import { createDatabase } from '@bassline/database'

const database = createDatabase()

// Create a connection
await database.put(
  { path: '/connections/app' },
  {
    path: './data/app.sqlite', // or ':memory:'
    readonly: false,
    fileMustExist: false,
  }
)

// Execute queries
const result = await database.put(
  { path: '/connections/app/query' },
  {
    sql: 'SELECT * FROM users WHERE active = ?',
    params: [true],
  }
)
// → { body: { rows: [...], columns: [...], rowCount: 10 } }

// Execute mutations
await database.put(
  { path: '/connections/app/execute' },
  {
    sql: 'INSERT INTO users (name, email) VALUES (?, ?)',
    params: ['Alice', 'alice@example.com'],
  }
)
// → { body: { changes: 1, lastInsertRowid: 42 } }

// Get schema
const schema = await database.get({ path: '/connections/app/schema' })
// → { body: { tables: [...] } }

// Close connection
await database.put({ path: '/connections/app/close' }, {})
```

## Routes

| Route                              | Method | Description                  |
| ---------------------------------- | ------ | ---------------------------- |
| `/`                                | GET    | Service info                 |
| `/connections`                     | GET    | List connections             |
| `/connections/:name`               | GET    | Connection info              |
| `/connections/:name`               | PUT    | Create connection            |
| `/connections/:name/query`         | PUT    | Execute SELECT               |
| `/connections/:name/execute`       | PUT    | Execute INSERT/UPDATE/DELETE |
| `/connections/:name/schema`        | GET    | Get database schema          |
| `/connections/:name/schema/:table` | GET    | Get table schema             |
| `/connections/:name/pragma`        | PUT    | Execute PRAGMA               |
| `/connections/:name/close`         | PUT    | Close connection             |

## Low-Level API

Direct SQLite access without the resource wrapper:

```javascript
import { createSQLiteConnection } from '@bassline/database'

const conn = createSQLiteConnection({ path: './app.sqlite' })

// Query
const result = conn.query('SELECT * FROM users')
// → { rows: [...], columns: [...], rowCount: 10 }

// Execute
conn.execute('INSERT INTO users (name) VALUES (?)', ['Bob'])
// → { changes: 1, lastInsertRowid: 43 }

// Transaction
conn.transaction(() => {
  conn.execute('INSERT INTO orders (user_id) VALUES (?)', [1])
  conn.execute('UPDATE users SET order_count = order_count + 1 WHERE id = ?', [1])
})

// Schema introspection
const schema = conn.introspect()
// → { tables: [{ name, type, columns, indexes }] }

// PRAGMA
conn.pragma('journal_mode = WAL')

// Close
conn.close()
```

## Features

- **WAL Mode** - Automatically enabled for file-based databases
- **Parameterized Queries** - Protection against SQL injection
- **Lazy Connections** - Databases open on first query
- **Schema Introspection** - Tables, columns, indexes
- **Transactions** - Atomic operations with rollback

## Related

- [@bassline/core](../core) - Resource primitives
