# Database - SQLite Access

The database package provides SQLite connections as resources, allowing direct SQL queries alongside Bassline's resource model.

## Creating Connections

```javascript
import { createDatabase } from '@bassline/database'

const db = createDatabase()

// Create a connection
await db.put(
  { path: '/connections/main' },
  {
    path: './mydata.db', // File path (or ':memory:' for in-memory)
    readonly: false, // Optional: open in readonly mode
    fileMustExist: false, // Optional: error if file doesn't exist
  }
)
```

## Querying Data

### SELECT Queries

```javascript
const { body } = await db.put(
  { path: '/connections/main/query' },
  {
    sql: 'SELECT * FROM users WHERE age > ?',
    params: [21],
  }
)

// Result:
// {
//   rows: [
//     { id: 1, name: 'Alice', age: 30 },
//     { id: 2, name: 'Bob', age: 25 }
//   ],
//   columns: ['id', 'name', 'age'],
//   rowCount: 2
// }
```

### Parameterized Queries

Always use parameters for user input:

```javascript
// GOOD - parameterized
await db.put(
  { path: '/connections/main/query' },
  {
    sql: 'SELECT * FROM users WHERE name = ?',
    params: [userName],
  }
)

// BAD - SQL injection risk
await db.put(
  { path: '/connections/main/query' },
  {
    sql: `SELECT * FROM users WHERE name = '${userName}'`, // DON'T DO THIS
  }
)
```

## Executing Statements

### INSERT/UPDATE/DELETE

```javascript
const { body } = await db.put(
  { path: '/connections/main/execute' },
  {
    sql: 'INSERT INTO users (name, age) VALUES (?, ?)',
    params: ['Charlie', 35],
  }
)

// Result:
// {
//   changes: 1,              // rows affected
//   lastInsertRowid: 3       // for INSERT
// }
```

### Multiple Statements

Execute one at a time:

```javascript
await db.put(
  { path: '/connections/main/execute' },
  {
    sql: 'INSERT INTO logs (message) VALUES (?)',
    params: ['First log'],
  }
)

await db.put(
  { path: '/connections/main/execute' },
  {
    sql: 'INSERT INTO logs (message) VALUES (?)',
    params: ['Second log'],
  }
)
```

## Schema Introspection

### Get All Tables

```javascript
const { body } = await db.get({ path: '/connections/main/schema' })

// Result:
// {
//   connection: 'main',
//   tables: [
//     { name: 'users', type: 'table', columns: [...] },
//     { name: 'posts', type: 'table', columns: [...] }
//   ]
// }
```

### Get Single Table Schema

```javascript
const { body } = await db.get({ path: '/connections/main/schema/users' })

// Result:
// {
//   name: 'users',
//   type: 'table',
//   columns: [
//     { name: 'id', type: 'INTEGER', notnull: false, pk: true },
//     { name: 'name', type: 'TEXT', notnull: true, pk: false },
//     { name: 'age', type: 'INTEGER', notnull: false, pk: false }
//   ]
// }
```

## PRAGMA Commands

```javascript
const { body } = await db.put(
  { path: '/connections/main/pragma' },
  {
    pragma: 'table_info(users)',
  }
)

// Other useful pragmas:
// 'journal_mode'      - WAL, DELETE, etc.
// 'foreign_keys'      - ON/OFF
// 'cache_size'        - page cache size
// 'synchronous'       - sync mode
```

## Connection Management

### List Connections

```javascript
const { body } = await db.get({ path: '/connections' })
// { name: 'connections', resources: { '/main': { path: './mydata.db', connected: true } } }
```

### Get Connection Info

```javascript
const { body } = await db.get({ path: '/connections/main' })
// { name: 'main', driver: 'sqlite', path: './mydata.db', readonly: false, connected: true }
```

### Close Connection

```javascript
await db.put({ path: '/connections/main/close' }, null)
```

## Patterns

### Setup Script

```javascript
const db = createDatabase()

// Create connection
await db.put({ path: '/connections/app' }, { path: './app.db' })

// Create tables if not exist
await db.put(
  { path: '/connections/app/execute' },
  {
    sql: `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  }
)

await db.put(
  { path: '/connections/app/execute' },
  {
    sql: `CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  }
)
```

### CRUD Operations

```javascript
// Create
async function createUser(name, email) {
  const { body } = await db.put(
    { path: '/connections/app/execute' },
    {
      sql: 'INSERT INTO users (name, email) VALUES (?, ?)',
      params: [name, email],
    }
  )
  return body.lastInsertRowid
}

// Read
async function getUser(id) {
  const { body } = await db.put(
    { path: '/connections/app/query' },
    {
      sql: 'SELECT * FROM users WHERE id = ?',
      params: [id],
    }
  )
  return body.rows[0]
}

// Update
async function updateUser(id, name) {
  const { body } = await db.put(
    { path: '/connections/app/execute' },
    {
      sql: 'UPDATE users SET name = ? WHERE id = ?',
      params: [name, id],
    }
  )
  return body.changes > 0
}

// Delete
async function deleteUser(id) {
  const { body } = await db.put(
    { path: '/connections/app/execute' },
    {
      sql: 'DELETE FROM users WHERE id = ?',
      params: [id],
    }
  )
  return body.changes > 0
}
```

### Transactions

SQLite in WAL mode auto-commits each statement. For explicit transactions:

```javascript
await db.put({ path: '/connections/app/execute' }, { sql: 'BEGIN TRANSACTION' })

try {
  await db.put(
    { path: '/connections/app/execute' },
    {
      sql: 'INSERT INTO accounts (name, balance) VALUES (?, ?)',
      params: ['Alice', 100],
    }
  )

  await db.put(
    { path: '/connections/app/execute' },
    {
      sql: 'INSERT INTO accounts (name, balance) VALUES (?, ?)',
      params: ['Bob', 100],
    }
  )

  await db.put({ path: '/connections/app/execute' }, { sql: 'COMMIT' })
} catch (err) {
  await db.put({ path: '/connections/app/execute' }, { sql: 'ROLLBACK' })
  throw err
}
```

### Multiple Databases

```javascript
// Main application data
await db.put({ path: '/connections/app' }, { path: './app.db' })

// Read-only reference data
await db.put(
  { path: '/connections/reference' },
  {
    path: './reference.db',
    readonly: true,
  }
)

// In-memory cache
await db.put({ path: '/connections/cache' }, { path: ':memory:' })
```

### With Kit Integration

The database notifies kit when data changes:

```javascript
// When execute runs, it sends to kit at /plumber/send
// with port 'database-changes'

// Set up a handler in your kit to respond to changes
const kit = routes({
  plumber: routes({
    send: resource({
      put: async (h, body) => {
        if (body.port === 'database-changes') {
          console.log(`Database ${body.body.connection} changed: ${body.body.changes} rows`)
        }
        return { headers: {}, body: { received: true } }
      },
    }),
  }),
})
```
