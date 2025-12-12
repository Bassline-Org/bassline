# @bassline/database

SQLite database service for Bassline.

## Overview

Provides SQLite database access as resources:

- **Connections** - Named database connections at `bl:///database/connections/*`
- **Queries** - Execute SELECT queries with parameterized SQL
- **Mutations** - Execute INSERT/UPDATE/DELETE with change events
- **Schema** - Introspect tables, columns, and indexes

## Installation

Installed during bootstrap:

```javascript
await bl.put(
  'bl:///install/database',
  {},
  {
    path: './packages/database/src/upgrade.js',
  }
)
```

## Routes

| Route                                       | Method | Description                  |
| ------------------------------------------- | ------ | ---------------------------- |
| `/database`                                 | GET    | Service info                 |
| `/database/connections`                     | GET    | List all connections         |
| `/database/connections/:name`               | GET    | Connection info              |
| `/database/connections/:name`               | PUT    | Create/update connection     |
| `/database/connections/:name/query`         | PUT    | Execute SELECT query         |
| `/database/connections/:name/execute`       | PUT    | Execute INSERT/UPDATE/DELETE |
| `/database/connections/:name/schema`        | GET    | Get database schema          |
| `/database/connections/:name/schema/:table` | GET    | Get table schema             |
| `/database/connections/:name/pragma`        | PUT    | Execute PRAGMA               |
| `/database/connections/:name/close`         | PUT    | Close connection             |

## Creating Connections

```javascript
// Create an in-memory database
await bl.put(
  'bl:///database/connections/temp',
  {},
  {
    path: ':memory:',
  }
)

// Create a file-based database
await bl.put(
  'bl:///database/connections/app',
  {},
  {
    path: './data/app.sqlite',
    readonly: false,
    fileMustExist: false,
  }
)

// List connections
await bl.get('bl:///database/connections')
// → { body: { entries: [{ name: 'app', path: '...', connected: true }] } }
```

## Querying Data

```javascript
// Execute a SELECT query
await bl.put(
  'bl:///database/connections/app/query',
  {},
  {
    sql: 'SELECT * FROM users WHERE active = ?',
    params: [true],
  }
)
// → { body: { rows: [...], columns: [...], rowCount: 10 } }

// Query without parameters
await bl.put(
  'bl:///database/connections/app/query',
  {},
  {
    sql: 'SELECT COUNT(*) as total FROM users',
  }
)
```

## Executing Mutations

```javascript
// INSERT
await bl.put(
  'bl:///database/connections/app/execute',
  {},
  {
    sql: 'INSERT INTO users (name, email) VALUES (?, ?)',
    params: ['Alice', 'alice@example.com'],
  }
)
// → { body: { changes: 1, lastInsertRowid: 42 } }

// UPDATE
await bl.put(
  'bl:///database/connections/app/execute',
  {},
  {
    sql: 'UPDATE users SET active = ? WHERE id = ?',
    params: [false, 42],
  }
)
// → { body: { changes: 1, lastInsertRowid: 42 } }

// DELETE
await bl.put(
  'bl:///database/connections/app/execute',
  {},
  {
    sql: 'DELETE FROM users WHERE id = ?',
    params: [42],
  }
)
```

Mutations dispatch change events through plumber:

```javascript
{
  source: 'bl:///database/connections/app',
  port: 'database-changes',
  headers: { type: 'bl:///types/database-change', changes: 1 },
  body: { connection: 'app', sql: '...', changes: 1, lastInsertRowid: 42 }
}
```

## Schema Introspection

```javascript
// Get all tables
await bl.get('bl:///database/connections/app/schema')
// → {
//   body: {
//     tables: [
//       { name: 'users', type: 'table', columns: [...], indexes: [...] },
//       { name: 'posts', type: 'table', columns: [...], indexes: [...] }
//     ]
//   }
// }

// Get specific table
await bl.get('bl:///database/connections/app/schema/users')
// → {
//   body: {
//     name: 'users',
//     type: 'table',
//     columns: [
//       { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
//       { name: 'name', type: 'TEXT', nullable: true, primaryKey: false }
//     ],
//     indexes: [
//       { name: 'users_email_idx', unique: true, columns: ['email'] }
//     ]
//   }
// }
```

## PRAGMA Commands

```javascript
// Execute PRAGMA
await bl.put(
  'bl:///database/connections/app/pragma',
  {},
  {
    pragma: 'table_info(users)',
  }
)

// Common PRAGMAs
await bl.put('bl:///database/connections/app/pragma', {}, { pragma: 'journal_mode' })
await bl.put('bl:///database/connections/app/pragma', {}, { pragma: 'foreign_keys = ON' })
```

## Connection Management

```javascript
// Close a connection
await bl.put('bl:///database/connections/app/close', {}, {})

// Connections are lazy-initialized
// Creating a connection config doesn't open the database
// The actual connection opens on first query/execute
```

## Direct API

```javascript
import { createDatabaseRoutes, createSQLiteConnection } from '@bassline/database'

// Low-level SQLite connection
const conn = createSQLiteConnection({ path: './app.sqlite' })
const result = conn.query('SELECT * FROM users')
conn.execute('INSERT INTO users (name) VALUES (?)', ['Bob'])
const schema = conn.introspect()
conn.transaction(() => {
  // Multiple operations in transaction
})
conn.close()

// Create routes
const database = createDatabaseRoutes({ bl })
database.install(bl)
```

## Features

- **WAL Mode** - Automatically enabled for file-based databases
- **Parameterized Queries** - Protection against SQL injection
- **Lazy Connections** - Databases open on first use
- **Schema Introspection** - Tables, columns, indexes
- **Change Events** - Mutations dispatch through plumber
