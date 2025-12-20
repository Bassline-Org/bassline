import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resource } from '@bassline/core'
import { createDatabase } from '../src/database.js'
import { createSQLiteConnection } from '../src/sqlite.js'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('createSQLiteConnection', () => {
  describe('basic operations', () => {
    it('creates in-memory database', () => {
      const conn = createSQLiteConnection({ path: ':memory:' })
      expect(conn).toBeDefined()
      conn.close()
    })

    it('executes create table', () => {
      const conn = createSQLiteConnection()
      const result = conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')

      expect(result.changes).toBe(0)
      conn.close()
    })

    it('inserts data', () => {
      const conn = createSQLiteConnection()
      conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')

      const result = conn.execute('INSERT INTO test (name) VALUES (?)', ['Alice'])

      expect(result.changes).toBe(1)
      expect(result.lastInsertRowid).toBe(1)
      conn.close()
    })

    it('queries data', () => {
      const conn = createSQLiteConnection()
      conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')
      conn.execute('INSERT INTO test (name) VALUES (?)', ['Alice'])
      conn.execute('INSERT INTO test (name) VALUES (?)', ['Bob'])

      const result = conn.query('SELECT * FROM test ORDER BY id')

      expect(result.rowCount).toBe(2)
      expect(result.rows[0].name).toBe('Alice')
      expect(result.rows[1].name).toBe('Bob')
      conn.close()
    })

    it('returns column metadata', () => {
      const conn = createSQLiteConnection()
      conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)')

      const result = conn.query('SELECT id, name, age FROM test')

      expect(result.columns).toHaveLength(3)
      expect(result.columns.map(c => c.name)).toEqual(['id', 'name', 'age'])
      conn.close()
    })

    it('updates data', () => {
      const conn = createSQLiteConnection()
      conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')
      conn.execute('INSERT INTO test (name) VALUES (?)', ['Alice'])

      const result = conn.execute('UPDATE test SET name = ? WHERE id = ?', ['Alicia', 1])

      expect(result.changes).toBe(1)

      const query = conn.query('SELECT name FROM test WHERE id = 1')
      expect(query.rows[0].name).toBe('Alicia')
      conn.close()
    })

    it('deletes data', () => {
      const conn = createSQLiteConnection()
      conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')
      conn.execute('INSERT INTO test (name) VALUES (?)', ['Alice'])
      conn.execute('INSERT INTO test (name) VALUES (?)', ['Bob'])

      const result = conn.execute('DELETE FROM test WHERE name = ?', ['Alice'])

      expect(result.changes).toBe(1)

      const query = conn.query('SELECT * FROM test')
      expect(query.rowCount).toBe(1)
      conn.close()
    })
  })

  describe('transactions', () => {
    it('commits successful transaction', () => {
      const conn = createSQLiteConnection()
      conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')

      conn.transaction(() => {
        conn.execute('INSERT INTO test (name) VALUES (?)', ['Alice'])
        conn.execute('INSERT INTO test (name) VALUES (?)', ['Bob'])
      })

      const result = conn.query('SELECT * FROM test')
      expect(result.rowCount).toBe(2)
      conn.close()
    })

    it('rolls back failed transaction', () => {
      const conn = createSQLiteConnection()
      conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT UNIQUE)')
      conn.execute('INSERT INTO test (name) VALUES (?)', ['Alice'])

      try {
        conn.transaction(() => {
          conn.execute('INSERT INTO test (name) VALUES (?)', ['Bob'])
          conn.execute('INSERT INTO test (name) VALUES (?)', ['Alice']) // Duplicate
        })
      } catch (e) {
        // Expected
      }

      // Transaction should have rolled back - only Alice exists
      const result = conn.query('SELECT * FROM test')
      expect(result.rowCount).toBe(1)
      conn.close()
    })
  })

  describe('introspection', () => {
    it('lists tables', () => {
      const conn = createSQLiteConnection()
      conn.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
      conn.execute('CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)')

      const schema = conn.introspect()

      expect(schema.tables).toHaveLength(2)
      expect(schema.tables.map(t => t.name).sort()).toEqual(['posts', 'users'])
      conn.close()
    })

    it('returns column info', () => {
      const conn = createSQLiteConnection()
      conn.execute(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER DEFAULT 0
        )
      `)

      const schema = conn.introspect()
      const users = schema.tables.find(t => t.name === 'users')

      expect(users.columns).toHaveLength(4)

      const idCol = users.columns.find(c => c.name === 'id')
      expect(idCol.primaryKey).toBe(true)

      const nameCol = users.columns.find(c => c.name === 'name')
      expect(nameCol.nullable).toBe(false)

      const emailCol = users.columns.find(c => c.name === 'email')
      expect(emailCol.nullable).toBe(true)

      const ageCol = users.columns.find(c => c.name === 'age')
      expect(ageCol.defaultValue).toBe('0')
      conn.close()
    })

    it('returns index info', () => {
      const conn = createSQLiteConnection()
      conn.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE)')
      conn.execute('CREATE INDEX idx_email ON users(email)')

      const schema = conn.introspect()
      const users = schema.tables.find(t => t.name === 'users')

      expect(users.indexes.length).toBeGreaterThan(0)
      conn.close()
    })

    it('handles views', () => {
      const conn = createSQLiteConnection()
      conn.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
      conn.execute('CREATE VIEW active_users AS SELECT * FROM users')

      const schema = conn.introspect()

      expect(schema.tables.find(t => t.name === 'active_users')).toBeDefined()
      conn.close()
    })
  })

  describe('pragma', () => {
    it('executes pragma commands', () => {
      const conn = createSQLiteConnection()

      const result = conn.pragma('table_info(sqlite_master)')

      expect(Array.isArray(result)).toBe(true)
      conn.close()
    })

    it('gets database version', () => {
      const conn = createSQLiteConnection()

      const result = conn.pragma('user_version')

      expect(result).toBeDefined()
      conn.close()
    })
  })

  describe('file-based database', () => {
    let tempDir

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'bassline-db-test-'))
    })

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true })
    })

    it('creates file-based database', () => {
      const dbPath = join(tempDir, 'test.db')
      const conn = createSQLiteConnection({ path: dbPath })

      conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY)')
      conn.close()

      // Reopen and verify
      const conn2 = createSQLiteConnection({ path: dbPath })
      const schema = conn2.introspect()
      expect(schema.tables.find(t => t.name === 'test')).toBeDefined()
      conn2.close()
    })

    it('enables WAL mode for file databases', () => {
      const dbPath = join(tempDir, 'wal.db')
      const conn = createSQLiteConnection({ path: dbPath })

      const result = conn.pragma('journal_mode')
      expect(result[0].journal_mode).toBe('wal')
      conn.close()
    })

    it('opens in readonly mode', () => {
      const dbPath = join(tempDir, 'readonly.db')

      // First create and populate
      const writeConn = createSQLiteConnection({ path: dbPath })
      writeConn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY)')
      writeConn.execute('INSERT INTO test VALUES (1)')
      writeConn.close()

      // Now open readonly
      const readConn = createSQLiteConnection({ path: dbPath, readonly: true })

      // Read should work
      const result = readConn.query('SELECT * FROM test')
      expect(result.rowCount).toBe(1)

      // Write should fail
      expect(() => {
        readConn.execute('INSERT INTO test VALUES (2)')
      }).toThrow()

      readConn.close()
    })

    it('throws when file must exist but does not', () => {
      const dbPath = join(tempDir, 'nonexistent.db')

      expect(() => {
        createSQLiteConnection({ path: dbPath, fileMustExist: true })
      }).toThrow()
    })
  })

  describe('edge cases', () => {
    it('handles empty result set', () => {
      const conn = createSQLiteConnection()
      conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY)')

      const result = conn.query('SELECT * FROM test')

      expect(result.rows).toEqual([])
      expect(result.rowCount).toBe(0)
      conn.close()
    })

    it('handles null values', () => {
      const conn = createSQLiteConnection()
      conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)')
      conn.execute('INSERT INTO test (value) VALUES (?)', [null])

      const result = conn.query('SELECT * FROM test')

      expect(result.rows[0].value).toBe(null)
      conn.close()
    })

    it('handles special characters in data', () => {
      const conn = createSQLiteConnection()
      conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')
      conn.execute('INSERT INTO test (name) VALUES (?)', ["O'Brien"])
      conn.execute('INSERT INTO test (name) VALUES (?)', ['Line1\nLine2'])

      const result = conn.query('SELECT * FROM test ORDER BY id')

      expect(result.rows[0].name).toBe("O'Brien")
      expect(result.rows[1].name).toBe('Line1\nLine2')
      conn.close()
    })

    it('handles large text', () => {
      const conn = createSQLiteConnection()
      conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY, data TEXT)')

      const largeText = 'x'.repeat(100000)
      conn.execute('INSERT INTO test (data) VALUES (?)', [largeText])

      const result = conn.query('SELECT data FROM test')
      expect(result.rows[0].data.length).toBe(100000)
      conn.close()
    })

    it('handles blob data', () => {
      const conn = createSQLiteConnection()
      conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY, data BLOB)')

      const buffer = Buffer.from([1, 2, 3, 4, 5])
      conn.execute('INSERT INTO test (data) VALUES (?)', [buffer])

      const result = conn.query('SELECT data FROM test')
      expect(Buffer.isBuffer(result.rows[0].data)).toBe(true)
      conn.close()
    })

    it('handles multiple statements in sequence', () => {
      const conn = createSQLiteConnection()

      for (let i = 0; i < 100; i++) {
        conn.execute('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, val INTEGER)')
        conn.execute('INSERT INTO test (val) VALUES (?)', [i])
      }

      const result = conn.query('SELECT COUNT(*) as count FROM test')
      expect(result.rows[0].count).toBe(100)
      conn.close()
    })
  })
})

describe('createDatabase resource', () => {
  let db

  beforeEach(() => {
    db = createDatabase()
  })

  describe('service info', () => {
    it('returns service info at root', async () => {
      const result = await db.get({ path: '/' })

      expect(result.headers.type).toBe('/types/service')
      expect(result.body.name).toBe('database')
    })
  })

  describe('connection management', () => {
    it('lists connections', async () => {
      const result = await db.get({ path: '/connections' })

      expect(result.headers.type).toBe('/types/bassline')
      expect(result.body.name).toBe('connections')
      expect(result.body.resources).toEqual({})
    })

    it('creates connection', async () => {
      const result = await db.put({ path: '/connections/test' }, { path: ':memory:' })

      expect(result.headers.type).toBe('/types/database-connection')
      expect(result.body.name).toBe('test')
      expect(result.body.driver).toBe('sqlite')
    })

    it('lists created connections', async () => {
      await db.put({ path: '/connections/db1' }, { path: ':memory:' })
      await db.put({ path: '/connections/db2' }, { path: ':memory:' })

      const result = await db.get({ path: '/connections' })

      expect(result.body.resources).toHaveProperty('/db1')
      expect(result.body.resources).toHaveProperty('/db2')
    })

    it('gets connection info', async () => {
      await db.put({ path: '/connections/test' }, { path: ':memory:' })

      const result = await db.get({ path: '/connections/test' })

      expect(result.headers.type).toBe('/types/database-connection')
      expect(result.body.name).toBe('test')
      expect(result.body.connected).toBe(false) // Not connected until first query
    })

    it('returns not-found for unknown connection', async () => {
      const result = await db.get({ path: '/connections/unknown' })

      expect(result.headers.condition).toBe('not-found')
    })

    it('closes connection', async () => {
      await db.put({ path: '/connections/test' }, { path: ':memory:' })

      // Connect by querying
      await db.put({ path: '/connections/test/execute' }, {
        sql: 'SELECT 1'
      })

      // Now close
      const result = await db.put({ path: '/connections/test/close' })

      expect(result.body.connected).toBe(false)
    })
  })

  describe('query operations', () => {
    beforeEach(async () => {
      await db.put({ path: '/connections/test' }, { path: ':memory:' })
      await db.put({ path: '/connections/test/execute' }, {
        sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)'
      })
    })

    it('executes SELECT query', async () => {
      await db.put({ path: '/connections/test/execute' }, {
        sql: 'INSERT INTO users (name, age) VALUES (?, ?)',
        params: ['Alice', 30]
      })

      const result = await db.put({ path: '/connections/test/query' }, {
        sql: 'SELECT * FROM users'
      })

      expect(result.headers.type).toBe('/types/database-result')
      expect(result.body.rowCount).toBe(1)
      expect(result.body.rows[0].name).toBe('Alice')
    })

    it('returns columns in query result', async () => {
      const result = await db.put({ path: '/connections/test/query' }, {
        sql: 'SELECT id, name, age FROM users'
      })

      expect(result.body.columns.map(c => c.name)).toEqual(['id', 'name', 'age'])
    })

    it('handles parameterized queries', async () => {
      await db.put({ path: '/connections/test/execute' }, {
        sql: 'INSERT INTO users (name, age) VALUES (?, ?)',
        params: ['Alice', 30]
      })
      await db.put({ path: '/connections/test/execute' }, {
        sql: 'INSERT INTO users (name, age) VALUES (?, ?)',
        params: ['Bob', 25]
      })

      const result = await db.put({ path: '/connections/test/query' }, {
        sql: 'SELECT * FROM users WHERE age > ?',
        params: [27]
      })

      expect(result.body.rowCount).toBe(1)
      expect(result.body.rows[0].name).toBe('Alice')
    })

    it('rejects query without sql', async () => {
      const result = await db.put({ path: '/connections/test/query' }, {})

      expect(result.headers.condition).toBe('error')
      expect(result.headers.message).toContain('sql')
    })
  })

  describe('execute operations', () => {
    beforeEach(async () => {
      await db.put({ path: '/connections/test' }, { path: ':memory:' })
      await db.put({ path: '/connections/test/execute' }, {
        sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)'
      })
    })

    it('returns changes count for INSERT', async () => {
      const result = await db.put({ path: '/connections/test/execute' }, {
        sql: 'INSERT INTO users (name) VALUES (?)',
        params: ['Alice']
      })

      expect(result.headers.type).toBe('/types/database-execute-result')
      expect(result.body.changes).toBe(1)
      expect(result.body.lastInsertRowid).toBe(1)
    })

    it('returns changes count for UPDATE', async () => {
      await db.put({ path: '/connections/test/execute' }, {
        sql: 'INSERT INTO users (name) VALUES (?)',
        params: ['Alice']
      })
      await db.put({ path: '/connections/test/execute' }, {
        sql: 'INSERT INTO users (name) VALUES (?)',
        params: ['Bob']
      })

      const result = await db.put({ path: '/connections/test/execute' }, {
        sql: 'UPDATE users SET name = ?',
        params: ['Updated']
      })

      expect(result.body.changes).toBe(2)
    })

    it('returns changes count for DELETE', async () => {
      await db.put({ path: '/connections/test/execute' }, {
        sql: 'INSERT INTO users (name) VALUES (?)',
        params: ['Alice']
      })

      const result = await db.put({ path: '/connections/test/execute' }, {
        sql: 'DELETE FROM users WHERE name = ?',
        params: ['Alice']
      })

      expect(result.body.changes).toBe(1)
    })

    it('notifies kit on changes', async () => {
      const notifications = []
      const kit = resource({
        get: async () => ({ headers: {}, body: null }),
        put: async (h, body) => {
          notifications.push({ path: h.path, body })
          return { headers: {}, body: null }
        }
      })

      await db.put({ path: '/connections/test/execute', kit }, {
        sql: 'INSERT INTO users (name) VALUES (?)',
        params: ['Alice']
      })

      expect(notifications).toHaveLength(1)
      expect(notifications[0].path).toBe('/plumber/send')
      expect(notifications[0].body.port).toBe('database-changes')
      expect(notifications[0].body.body.changes).toBe(1)
    })
  })

  describe('schema operations', () => {
    beforeEach(async () => {
      await db.put({ path: '/connections/test' }, { path: ':memory:' })
      await db.put({ path: '/connections/test/execute' }, {
        sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)'
      })
      await db.put({ path: '/connections/test/execute' }, {
        sql: 'CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT)'
      })
    })

    it('returns full schema', async () => {
      const result = await db.get({ path: '/connections/test/schema' })

      expect(result.headers.type).toBe('/types/database-schema')
      expect(result.body.connection).toBe('test')
      expect(result.body.tables).toHaveLength(2)
    })

    it('returns table schema', async () => {
      const result = await db.get({ path: '/connections/test/schema/users' })

      expect(result.headers.type).toBe('/types/database-table')
      expect(result.body.name).toBe('users')
      expect(result.body.columns).toHaveLength(2)
    })

    it('returns not-found for unknown table', async () => {
      const result = await db.get({ path: '/connections/test/schema/nonexistent' })

      expect(result.headers.condition).toBe('not-found')
    })
  })

  describe('pragma operations', () => {
    beforeEach(async () => {
      await db.put({ path: '/connections/test' }, { path: ':memory:' })
    })

    it('executes pragma command', async () => {
      const result = await db.put({ path: '/connections/test/pragma' }, {
        pragma: 'table_list'
      })

      expect(result.headers.type).toBe('/types/database-pragma-result')
      expect(result.body.result).toBeDefined()
    })

    it('rejects missing pragma', async () => {
      const result = await db.put({ path: '/connections/test/pragma' }, {})

      expect(result.headers.condition).toBe('error')
      expect(result.headers.message).toContain('pragma')
    })
  })

  describe('error handling', () => {
    it('returns error for query on unknown connection', async () => {
      // First register a connection but don't query it (so it's lazy-initialized)
      // Then try to query a completely unregistered connection
      const result = await db.put({ path: '/connections/nonexistent/query' }, { sql: 'SELECT 1' })

      // When connection doesn't exist, getConnection throws which gets wrapped
      expect(result.headers.condition).toBe('error')
      expect(result.headers.message).toContain('Connection not found')
    })

    it('returns error for invalid SQL', async () => {
      await db.put({ path: '/connections/test' }, { path: ':memory:' })

      const result = await db.put({ path: '/connections/test/query' }, { sql: 'INVALID SQL' })

      expect(result.headers.condition).toBe('error')
    })

    it('returns error for constraint violation', async () => {
      await db.put({ path: '/connections/test' }, { path: ':memory:' })
      await db.put({ path: '/connections/test/execute' }, {
        sql: 'CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT UNIQUE)'
      })
      await db.put({ path: '/connections/test/execute' }, {
        sql: 'INSERT INTO test (name) VALUES (?)',
        params: ['Alice']
      })

      const result = await db.put({ path: '/connections/test/execute' }, {
        sql: 'INSERT INTO test (name) VALUES (?)',
        params: ['Alice']
      })

      expect(result.headers.condition).toBe('error')
      expect(result.headers.message).toContain('UNIQUE constraint')
    })
  })

  describe('concurrent access', () => {
    it('handles multiple connections simultaneously', async () => {
      await db.put({ path: '/connections/db1' }, { path: ':memory:' })
      await db.put({ path: '/connections/db2' }, { path: ':memory:' })

      await db.put({ path: '/connections/db1/execute' }, {
        sql: 'CREATE TABLE test (val INTEGER)'
      })
      await db.put({ path: '/connections/db2/execute' }, {
        sql: 'CREATE TABLE test (val INTEGER)'
      })

      await db.put({ path: '/connections/db1/execute' }, {
        sql: 'INSERT INTO test VALUES (1)'
      })
      await db.put({ path: '/connections/db2/execute' }, {
        sql: 'INSERT INTO test VALUES (2)'
      })

      const [result1, result2] = await Promise.all([
        db.put({ path: '/connections/db1/query' }, { sql: 'SELECT val FROM test' }),
        db.put({ path: '/connections/db2/query' }, { sql: 'SELECT val FROM test' })
      ])

      expect(result1.body.rows[0].val).toBe(1)
      expect(result2.body.rows[0].val).toBe(2)
    })

    it('handles rapid sequential queries', async () => {
      await db.put({ path: '/connections/test' }, { path: ':memory:' })
      await db.put({ path: '/connections/test/execute' }, {
        sql: 'CREATE TABLE counter (val INTEGER)'
      })
      await db.put({ path: '/connections/test/execute' }, {
        sql: 'INSERT INTO counter VALUES (0)'
      })

      for (let i = 0; i < 50; i++) {
        await db.put({ path: '/connections/test/execute' }, {
          sql: 'UPDATE counter SET val = val + 1'
        })
      }

      const result = await db.put({ path: '/connections/test/query' }, {
        sql: 'SELECT val FROM counter'
      })

      expect(result.body.rows[0].val).toBe(50)
    })
  })
})
