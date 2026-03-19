import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createSqliteStorage } from './sqlite.ts'

const runtimeDescribe = process.versions.electron ? describe : describe.skip
let Database

beforeAll(async () => {
  if (!process.versions.electron) return
  Database = (await import('better-sqlite3')).default
})

function makeStorage() {
  const warn = vi.fn()
  const db = new Database(':memory:')
  const storage = createSqliteStorage(db, warn)
  return { db, storage, warn }
}

runtimeDescribe('sqlite storage', () => {
  it('appends and reads entries by exact key', () => {
    const { storage, db } = makeStorage()

    storage.appendEntry({
      id: 'e1',
      space: 'graph',
      key: 'ops',
      msg: { type: 'assert', s: 'n1', p: 'label', o: 'Hello' },
    })

    expect(storage.readEntries({ space: 'graph', key: 'ops' })).toEqual([
      { id: 'e1', space: 'graph', key: 'ops', msg: { type: 'assert', s: 'n1', p: 'label', o: 'Hello' }, prev: null },
    ])

    db.close()
  })

  it('reads entries by prefix', () => {
    const { storage, db } = makeStorage()

    storage.appendEntry({ id: 'e1', space: 'graph', key: 'ops', msg: { body: 1 } })
    storage.appendEntry({ id: 'e2', space: 'graph', key: 'ops/node/a', msg: { body: 2 } })
    storage.appendEntry({ id: 'e3', space: 'graph', key: 'other', msg: { body: 3 } })

    expect(storage.readEntries({ space: 'graph', prefix: 'ops' }).map(entry => entry.id)).toEqual(['e1', 'e2'])

    db.close()
  })

  it('reads entries with after and limit', () => {
    const { storage, db } = makeStorage()

    storage.appendEntry({ id: 'e1', space: 'graph', key: 'ops', msg: { body: 1 } })
    storage.appendEntry({ id: 'e2', space: 'graph', key: 'ops', msg: { body: 2 } })
    storage.appendEntry({ id: 'e3', space: 'graph', key: 'ops', msg: { body: 3 } })

    expect(storage.readEntries({ space: 'graph', key: 'ops', after: 'e1', limit: 1 }).map(entry => entry.id)).toEqual([
      'e2',
    ])

    db.close()
  })

  it('sets and reads refs and checkpoints', () => {
    const { storage, db } = makeStorage()

    expect(storage.setRef({ space: 'graph', name: 'head', target: { kind: 'entry', id: 'e2' } })).toBe(true)
    expect(storage.readRef('graph', 'head')).toEqual({
      space: 'graph',
      name: 'head',
      target: { kind: 'entry', id: 'e2' },
    })

    expect(
      storage.setCheckpoint({
        space: 'graph',
        name: 'current',
        tail: 'e2',
        state: { subjects: { n1: { label: 'Hello' } } },
      })
    ).toBe(true)
    expect(storage.readCheckpoint('graph', 'current')).toEqual({
      space: 'graph',
      name: 'current',
      tail: 'e2',
      state: { subjects: { n1: { label: 'Hello' } } },
    })

    db.close()
  })

  it('keeps entries immutable by rejecting duplicate ids', () => {
    const { storage, warn, db } = makeStorage()

    expect(storage.appendEntry({ id: 'e1', space: 'graph', key: 'ops', msg: { body: 1 } })).toBe(true)
    expect(storage.appendEntry({ id: 'e1', space: 'graph', key: 'ops', msg: { body: 2 } })).toBe(false)
    expect(storage.readEntries({ space: 'graph', key: 'ops' })).toHaveLength(1)
    expect(warn).toHaveBeenCalled()

    db.close()
  })

  it('rejects non-json-serializable payloads cleanly', () => {
    const { storage, warn, db } = makeStorage()
    const circular = {}
    circular.self = circular

    expect(storage.appendEntry({ id: 'e1', space: 'graph', key: 'ops', msg: circular })).toBe(false)
    expect(storage.readEntries({ space: 'graph', key: 'ops' })).toEqual([])
    expect(warn).toHaveBeenCalled()

    db.close()
  })
})
