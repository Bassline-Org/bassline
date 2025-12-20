import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createSQLiteConnection } from '@bassline/database'
import { Runtime, std, list, dictCmd } from '@bassline/tcl'
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
  })

  it('is idempotent', () => {
    initSchema(conn)
    initSchema(conn)

    const tables = conn.query(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '\\_%' ESCAPE '\\'`
    ).rows

    expect(tables.length).toBe(4)
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
    expect(result.body).toBe('parent got /announce/')
  })

  it('returns not-found when no parent kit', async () => {
    const { kit } = createBlitKit(conn, null)

    const result = await kit.get({ path: '/unknown/path' })
    expect(result.headers.condition).toBe('not-found')
  })
})

describe('TCL commands', () => {
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

  describe('cell command', () => {
    it('creates a cell with lattice', async () => {
      await rt.run('cell create counter -lattice maxNumber')

      const result = await kit.get({ path: '/cells/counter' })
      expect(result.body.lattice).toBe('maxNumber')
    })

    it('sets cell value', async () => {
      await rt.run('cell create score -lattice maxNumber')
      await rt.run('cell set score 100')

      const result = await kit.get({ path: '/cells/score/value' })
      expect(result.body).toBe(100)
    })

    it('is idempotent - does not reset existing cell', async () => {
      await rt.run('cell create counter -lattice maxNumber')
      await rt.run('cell set counter 42')

      // Create again - should NOT reset to initial value
      await rt.run('cell create counter -lattice maxNumber')

      const result = await kit.get({ path: '/cells/counter/value' })
      expect(result.body).toBe(42)
    })

    it('gets cell value', async () => {
      await rt.run('cell create level -lattice maxNumber')
      await rt.run('cell set level 5')

      const value = await rt.run('cell value level')
      expect(value).toBe('5')
    })

    it('gets cell info as JSON', async () => {
      await rt.run('cell create info -lattice lww')
      await rt.run('cell set info hello')

      const info = await rt.run('cell get info')
      const parsed = JSON.parse(info)
      expect(parsed.lattice).toBe('lww')
    })

    it('throws on missing cell', async () => {
      await expect(rt.run('cell value nonexistent')).rejects.toThrow('not found')
    })
  })

  describe('store command', () => {
    it('sets and gets values', async () => {
      await rt.run('store set config {theme dark mode light}')
      const result = await rt.run('store get config')

      expect(JSON.parse(result)).toEqual({ theme: 'dark', mode: 'light' })
    })

    it('lists keys', async () => {
      await rt.run('store set a 1')
      await rt.run('store set b 2')

      const keys = await rt.run('store keys')
      expect(keys.split(' ')).toContain('a')
      expect(keys.split(' ')).toContain('b')
    })

    it('returns empty for missing key', async () => {
      const result = await rt.run('store get missing')
      expect(result).toBe('')
    })
  })

  describe('sql command', () => {
    beforeEach(() => {
      conn.execute(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)`)
      conn.execute(`INSERT INTO users VALUES (1, 'Alice')`)
      conn.execute(`INSERT INTO users VALUES (2, 'Bob')`)
    })

    it('queries data', async () => {
      const result = await rt.run('sql query "SELECT * FROM users"')
      expect(result).toContain('Alice')
      expect(result).toContain('Bob')
    })

    it('executes statements', async () => {
      const result = await rt.run('sql execute "INSERT INTO users VALUES (3, \'Carol\')"')
      expect(result).toContain('changes 1')
    })

    it('supports parameters', async () => {
      const result = await rt.run('sql query "SELECT name FROM users WHERE id = ?" 2')
      expect(result).toContain('Bob')
    })
  })

  describe('kit command', () => {
    it('puts and gets values', async () => {
      await rt.run('kit put /store/mykey "test value"')

      const result = await rt.run('kit get /store/mykey')
      expect(result).toBe('test value')
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

    // Add a boot script
    conn.execute(`INSERT INTO _boot VALUES ('init.tcl', 'cell create counter -lattice maxNumber; cell set counter 0')`)
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
})
