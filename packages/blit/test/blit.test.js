import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createSQLiteConnection } from '@bassline/database'
import { Runtime, std, list, dictCmd, namespace } from '@bassline/tcl'
import { createSQLiteStore, createBlitKit, createBlits, createBlitCommands, initSchema } from '../src/index.js'

describe('schema', () => {
  let conn

  beforeEach(() => {
    conn = createSQLiteConnection({ path: ':memory:' })
  })

  afterEach(() => {
    conn.close()
  })

  it('initializes all tables', () => {
    initSchema(conn)

    const tables = conn
      .query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '\\_%' ESCAPE '\\'`)
      .rows.map(r => r.name)

    expect(tables).toContain('_boot')
    expect(tables).toContain('_cells')
    expect(tables).toContain('_store')
    expect(tables).toContain('_fn')
    expect(tables).toContain('_ns')
  })

  it('is idempotent', () => {
    initSchema(conn)
    initSchema(conn)

    const tables = conn.query(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '\\_%' ESCAPE '\\'`
    ).rows

    expect(tables.length).toBe(5)
  })
})

describe('SQLite store', () => {
  let conn, store

  beforeEach(() => {
    conn = createSQLiteConnection({ path: ':memory:' })
    conn.execute(`CREATE TABLE test_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
    store = createSQLiteStore(conn, 'test_store')
  })

  afterEach(() => {
    conn.close()
  })

  it('rejects invalid table names', () => {
    expect(() => createSQLiteStore(conn, 'drop table;')).toThrow()
    expect(() => createSQLiteStore(conn, '123abc')).toThrow()
    expect(() => createSQLiteStore(conn, 'valid_table')).not.toThrow()
  })

  it('lists keys', async () => {
    conn.execute(`INSERT INTO test_store VALUES ('a', 'value1')`)
    conn.execute(`INSERT INTO test_store VALUES ('b', 'value2')`)

    const result = await store.get({ path: '/' })
    expect(result.body).toEqual(['a', 'b'])
  })

  it('gets value by key', async () => {
    conn.execute(`INSERT INTO test_store VALUES ('mykey', '"hello"')`)

    const result = await store.get({ path: '/mykey' })
    expect(result.body).toBe('hello')
  })

  it('returns not-found for missing key', async () => {
    const result = await store.get({ path: '/missing' })
    expect(result.headers.condition).toBe('not-found')
  })

  it('puts value by key', async () => {
    await store.put({ path: '/foo' }, { bar: 123 })

    const result = conn.query(`SELECT value FROM test_store WHERE key = 'foo'`)
    expect(JSON.parse(result.rows[0].value)).toEqual({ bar: 123 })
  })

  it('upserts on conflict', async () => {
    await store.put({ path: '/key' }, 'first')
    await store.put({ path: '/key' }, 'second')

    const result = await store.get({ path: '/key' })
    expect(result.body).toBe('second')
  })
})

describe('blit kit', () => {
  let conn

  beforeEach(() => {
    conn = createSQLiteConnection({ path: ':memory:' })
    initSchema(conn)
  })

  afterEach(() => {
    conn.close()
  })

  it('creates cells resource', async () => {
    const { kit } = createBlitKit(conn)

    // Create a cell
    await kit.put({ path: '/cells/counter' }, { lattice: 'maxNumber' })
    await kit.put({ path: '/cells/counter/value' }, 5)

    const result = await kit.get({ path: '/cells/counter/value' })
    expect(result.body).toBe(5)
  })

  it('creates store resource', async () => {
    const { kit } = createBlitKit(conn)

    await kit.put({ path: '/store/config' }, { theme: 'dark' })

    const result = await kit.get({ path: '/store/config' })
    expect(result.body).toEqual({ theme: 'dark' })
  })

  it('creates fn resource', async () => {
    const { kit } = createBlitKit(conn)

    await kit.put({ path: '/fn/sum' }, 'function code here')

    const result = await kit.get({ path: '/fn/sum' })
    expect(result.body).toBe('function code here')
  })

  it('hydrates cells from database', async () => {
    // Pre-populate _cells table
    conn.execute(`INSERT INTO _cells VALUES ('counter', 'maxNumber', '10')`)
    conn.execute(`INSERT INTO _cells VALUES ('flag', 'boolean', 'true')`)

    const { kit, hydrate } = createBlitKit(conn)
    await hydrate()

    const counter = await kit.get({ path: '/cells/counter/value' })
    expect(counter.body).toBe(10)

    const flag = await kit.get({ path: '/cells/flag/value' })
    expect(flag.body).toBe(true)
  })

  it('checkpoints cells to database', async () => {
    const { kit, checkpoint } = createBlitKit(conn)

    // Create and set cells
    await kit.put({ path: '/cells/score' }, { lattice: 'maxNumber' })
    await kit.put({ path: '/cells/score/value' }, 42)

    // Checkpoint
    await checkpoint()

    // Verify in database
    const result = conn.query(`SELECT * FROM _cells WHERE key = 'score'`)
    expect(result.rows.length).toBe(1)
    expect(result.rows[0].lattice).toBe('maxNumber')
    expect(JSON.parse(result.rows[0].value)).toBe(42)
  })

  it('delegates unknown paths to parent kit', async () => {
    const parentKit = {
      get: async h => ({ headers: {}, body: `parent got ${h.path}` }),
      put: async h => ({ headers: {}, body: `parent put ${h.path}` }),
    }

    const { kit } = createBlitKit(conn, parentKit)

    const result = await kit.get({ path: '/announce' })
    // routes() leaves remaining path as '/', so '/announce' + '/' = '/announce/'
    expect(result.body).toBe('parent got /announce/')
  })

  it('returns not-found when no parent kit', async () => {
    const { kit } = createBlitKit(conn, null)

    const result = await kit.get({ path: '/unknown/path' })
    expect(result.headers.condition).toBe('not-found')
  })
})

describe('bl command', () => {
  let conn, kit, commands, rt

  beforeEach(() => {
    conn = createSQLiteConnection({ path: ':memory:' })
    initSchema(conn)

    const blitKit = createBlitKit(conn)
    kit = blitKit.kit

    commands = createBlitCommands(conn, kit)

    rt = new Runtime()
    for (const [n, fn] of Object.entries(std)) rt.register(n, fn)
    for (const [n, fn] of Object.entries(list)) rt.register(n, fn)
    for (const [n, fn] of Object.entries(dictCmd)) rt.register(n, fn)
    for (const [n, fn] of Object.entries(commands)) rt.register(n, fn)
  })

  afterEach(() => {
    conn.close()
  })

  describe('cells', () => {
    it('creates a cell and sets value', async () => {
      // Create cell via bl put - need type tcl/dict to parse body as object
      await rt.run('bl put {path /cells/counter type tcl/dict} {lattice maxNumber}')
      await rt.run('bl put {path /cells/counter/value type js/num} 100')

      const result = await kit.get({ path: '/cells/counter/value' })
      expect(result.body).toBe(100)
    })

    it('gets cell value', async () => {
      await rt.run('bl put {path /cells/level type tcl/dict} {lattice maxNumber}')
      await rt.run('bl put {path /cells/level/value type js/num} 5')

      const response = await rt.run('bl get {path /cells/level/value}')
      // Response is TCL dict: {headers {type js/num} body 5}
      expect(response).toContain('body 5')
    })

    it('returns not-found for missing cell', async () => {
      const response = await rt.run('bl get {path /cells/nonexistent}')
      expect(response).toContain('not-found')
    })
  })

  describe('store', () => {
    it('sets and gets values', async () => {
      await rt.run('bl put {path /store/config type tcl/dict} {theme dark mode light}')
      const response = await rt.run('bl get {path /store/config}')

      expect(response).toContain('theme')
      expect(response).toContain('dark')
    })

    it('stores plain strings', async () => {
      await rt.run('bl put {path /store/mykey} {test value}')

      const result = await kit.get({ path: '/store/mykey' })
      expect(result.body).toBe('test value')
    })
  })

  describe('sql', () => {
    beforeEach(() => {
      conn.execute(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)`)
      conn.execute(`INSERT INTO users VALUES (1, 'Alice')`)
      conn.execute(`INSERT INTO users VALUES (2, 'Bob')`)
    })

    it('queries data', async () => {
      const response = await rt.run('bl put {path /sql/query} {SELECT * FROM users}')
      expect(response).toContain('Alice')
      expect(response).toContain('Bob')
    })

    it('executes statements', async () => {
      const response = await rt.run(`bl put {path /sql/execute} {INSERT INTO users VALUES (3, 'Carol')}`)
      expect(response).toContain('changes')
    })

    it('supports array params', async () => {
      // Body is [sql, [params]] - use tcl/list to parse
      await rt.run('set body [list {SELECT name FROM users WHERE id = ?} [list 2]]')
      const response = await rt.run('bl put {path /sql/query type tcl/list} $body')
      expect(response).toContain('Bob')
    })
  })

  describe('usage', () => {
    it('throws on missing method', async () => {
      await expect(rt.run('bl')).rejects.toThrow('usage')
    })

    it('throws on unknown method', async () => {
      await expect(rt.run('bl delete {path /foo}')).rejects.toThrow('unknown method')
    })
  })
})

describe('blits resource', () => {
  let blits, conn, testDbPath

  beforeEach(async () => {
    blits = createBlits()

    // Create a test blit file
    testDbPath = '/tmp/test-blit-' + Date.now() + '.blit'
    conn = createSQLiteConnection({ path: testDbPath })
    initSchema(conn)

    // Add a boot script using bl command
    conn.execute(
      `INSERT INTO _boot VALUES ('init.tcl', 'bl put {path /cells/counter type tcl/dict} {lattice maxNumber}; bl put {path /cells/counter/value type js/num} 0')`
    )
    conn.close()
  })

  afterEach(async () => {
    // Clean up
    try {
      const blit = await blits.get({ path: '/test' })
      if (blit.body) {
        await blits.put({ path: '/test/close' }, {})
      }
    } catch {
      // ignore
    }

    // Remove test file
    try {
      const fs = await import('fs')
      fs.unlinkSync(testDbPath)
      fs.unlinkSync(testDbPath + '-wal')
      fs.unlinkSync(testDbPath + '-shm')
    } catch {
      // ignore
    }
  })

  it('lists loaded blits', async () => {
    const result = await blits.get({ path: '/' })
    expect(result.headers.type).toBe('/types/bassline')
    expect(result.body.name).toBe('blits')
  })

  it('loads a blit', async () => {
    const result = await blits.put({ path: '/test' }, { path: testDbPath })

    expect(result.body.name).toBe('test')
    expect(result.body.loaded).toBe(true)
  })

  it('runs boot script on load', async () => {
    await blits.put({ path: '/test' }, { path: testDbPath })

    // The boot script creates a counter cell
    const counter = await blits.get({ path: '/test/cells/counter/value' })
    expect(counter.body).toBe(0)
  })

  it('gets blit info', async () => {
    await blits.put({ path: '/test' }, { path: testDbPath })

    const info = await blits.get({ path: '/test' })
    expect(info.body.name).toBe('test')
    expect(info.body.path).toBe(testDbPath)
  })

  it('checkpoints blit state', async () => {
    await blits.put({ path: '/test' }, { path: testDbPath })

    // Use store instead of cells (boot script resets cells on reload)
    await blits.put({ path: '/test/store/checkpoint-test' }, { value: 42 })

    // Checkpoint
    await blits.put({ path: '/test/checkpoint' }, {})

    // Reload and verify
    await blits.put({ path: '/test/close' }, {})
    await blits.put({ path: '/test' }, { path: testDbPath })

    const result = await blits.get({ path: '/test/store/checkpoint-test' })
    expect(result.body).toEqual({ value: 42 })
  })

  it('closes blit', async () => {
    await blits.put({ path: '/test' }, { path: testDbPath })
    const result = await blits.put({ path: '/test/close' }, {})

    expect(result.body.closed).toBe(true)

    const info = await blits.get({ path: '/test' })
    expect(info.headers.condition).toBe('not-found')
  })

  it('forwards requests to blit kit', async () => {
    await blits.put({ path: '/test' }, { path: testDbPath })

    await blits.put({ path: '/test/store/mykey' }, { value: 'hello' })

    const result = await blits.get({ path: '/test/store/mykey' })
    expect(result.body).toEqual({ value: 'hello' })
  })

  it('evaluates TCL via /tcl/eval', async () => {
    await blits.put({ path: '/test' }, { path: testDbPath })

    // Set a variable
    await blits.put({ path: '/test/tcl/eval' }, 'set x 42')

    // Read it back
    const result = await blits.put({ path: '/test/tcl/eval' }, 'set x')
    expect(result.body).toBe('42')
  })

  it('persists TCL variables through checkpoint', async () => {
    await blits.put({ path: '/test' }, { path: testDbPath })

    // Set variables and define a proc
    await blits.put({ path: '/test/tcl/eval' }, 'set myvar "hello world"')
    await blits.put({ path: '/test/tcl/eval' }, 'set count 123')
    await blits.put({ path: '/test/tcl/eval' }, 'proc double {x} { expr {$x * 2} }')

    // Checkpoint
    await blits.put({ path: '/test/checkpoint' }, {})

    // Close and reload
    await blits.put({ path: '/test/close' }, {})
    await blits.put({ path: '/test' }, { path: testDbPath })

    // Variables should be restored
    const myvar = await blits.put({ path: '/test/tcl/eval' }, 'set myvar')
    expect(myvar.body).toBe('hello world')

    const count = await blits.put({ path: '/test/tcl/eval' }, 'set count')
    expect(count.body).toBe('123')

    // Proc should be restored
    const doubled = await blits.put({ path: '/test/tcl/eval' }, 'double 21')
    expect(doubled.body).toBe('42')
  })
})

describe('TCL runtime serialization', () => {
  // Helper to create a runtime with all standard commands
  const createRuntime = () => {
    const rt = new Runtime()
    for (const [n, fn] of Object.entries(std)) rt.register(n, fn)
    for (const [n, fn] of Object.entries(list)) rt.register(n, fn)
    for (const [n, fn] of Object.entries(dictCmd)) rt.register(n, fn)
    for (const [n, fn] of Object.entries(namespace)) rt.register(n, fn)
    return rt
  }

  it('serializes and restores variables', async () => {
    const rt = createRuntime()

    // Set some variables
    await rt.run('set x 10')
    await rt.run('set name "Alice"')
    await rt.run('set data {a 1 b 2}')

    // Serialize
    const json = rt.toJSON()

    // Create new runtime and restore
    const rt2 = createRuntime()
    rt2.fromJSON(json)

    // Check variables restored
    expect(await rt2.run('set x')).toBe('10')
    expect(await rt2.run('set name')).toBe('Alice')
    expect(await rt2.run('set data')).toBe('a 1 b 2')
  })

  it('serializes and restores namespaces', async () => {
    const rt = createRuntime()

    // Create namespace with variables
    await rt.run('namespace eval myns { set foo bar }')
    await rt.run('namespace eval myns/nested { set baz qux }')

    // Serialize
    const json = rt.toJSON()

    // Create new runtime and restore
    const rt2 = createRuntime()
    rt2.fromJSON(json)

    // Check namespace variables restored
    expect(await rt2.run('namespace eval myns { set foo }')).toBe('bar')
    expect(await rt2.run('namespace eval myns/nested { set baz }')).toBe('qux')
  })

  it('skips temporary proc namespaces', async () => {
    const rt = createRuntime()

    // Define and call a proc (creates _proc_N namespace)
    await rt.run('proc test {} { set local 1 }')
    await rt.run('test')

    // Serialize
    const json = rt.toJSON()

    // Should not include _proc_* namespaces
    expect(json.root.children).not.toHaveProperty('_proc_1')
  })

  it('serializes exports', async () => {
    const rt = createRuntime()

    // Create namespace with exports
    await rt.run('namespace eval myns { namespace export foo* }')

    // Serialize
    const json = rt.toJSON()

    // Check exports are included
    expect(json.root.children.myns.exports).toContain('foo*')
  })
})
