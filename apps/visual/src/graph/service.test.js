import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createSqliteStorage } from '../storage/sqlite.ts'
import { createGraphService, seedDefaultGraph } from './service.ts'

const runtimeDescribe = process.versions.electron ? describe : describe.skip
let Database

beforeAll(async () => {
  if (!process.versions.electron) return
  Database = (await import('better-sqlite3')).default
})

async function collectN(reader, n) {
  const values = []
  await reader.take(n).sink(value => values.push(value))
  return values
}

function makeDb() {
  return new Database(':memory:')
}

runtimeDescribe('graph service', () => {
  it('persists assert and retract ops as graph history', () => {
    const db = makeDb()
    const warn = vi.fn()
    const service = createGraphService(db, warn)
    const storage = createSqliteStorage(db, warn)
    const [_reader, writer] = service.join()

    writer.send({ type: 'assert', s: 'n1', p: 'label', o: 'Hello' })
    writer.send({ type: 'retract', s: 'n1', p: 'label', o: null })

    const entries = storage.readEntries({ space: 'graph', key: 'ops' })
    expect(entries.map(entry => entry.msg.type)).toEqual(['assert', 'retract'])

    writer.close()
    db.close()
  })

  it('does not persist queries', async () => {
    const db = makeDb()
    const warn = vi.fn()
    const service = createGraphService(db, warn)
    const storage = createSqliteStorage(db, warn)
    const [reader, writer] = service.join()

    const resultPromise = collectN(
      reader.filter(msg => msg.type === 'result'),
      1
    )

    writer.send({ type: 'assert', s: 'n1', p: 'label', o: 'Hello' })
    writer.send({ type: 'query', s: 'n1', p: null, o: null, qid: 'q1' })

    expect((await resultPromise)[0]).toEqual({
      type: 'result',
      qid: 'q1',
      triples: [{ s: 'n1', p: 'label', o: 'Hello' }],
    })
    expect(storage.readEntries({ space: 'graph', key: 'ops' })).toHaveLength(1)

    writer.close()
    db.close()
  })

  it('rejects result messages on the public writer', () => {
    const db = makeDb()
    const warn = vi.fn()
    const service = createGraphService(db, warn)
    const [_reader, writer] = service.join()

    expect(() => writer.send({ type: 'result', qid: 'q1', triples: [] })).toThrow(/invalid graph write/)

    writer.close()
    db.close()
  })

  it('updates head ref and checkpoint on each mutation', () => {
    const db = makeDb()
    const warn = vi.fn()
    const service = createGraphService(db, warn)
    const storage = createSqliteStorage(db, warn)
    const [_reader, writer] = service.join()

    writer.send({ type: 'assert', s: 'n1', p: 'label', o: 'Hello' })
    writer.send({ type: 'assert', s: 'n1', p: 'position', o: { x: 10, y: 20 } })

    const entries = storage.readEntries({ space: 'graph', key: 'ops' })
    const last = entries.at(-1)
    expect(last).toBeTruthy()
    expect(storage.readRef('graph', 'head')).toEqual({
      space: 'graph',
      name: 'head',
      target: { kind: 'entry', id: last.id },
    })
    expect(storage.readCheckpoint('graph', 'current')).toEqual({
      space: 'graph',
      name: 'current',
      tail: last.id,
      state: {
        subjects: {
          n1: {
            label: 'Hello',
            position: { x: 10, y: 20 },
          },
        },
      },
    })

    writer.close()
    db.close()
  })

  it('reconstructs graph state from checkpoint plus tail history', async () => {
    const db = makeDb()
    const warn = vi.fn()
    const service = createGraphService(db, warn)
    const storage = createSqliteStorage(db, warn)
    const [_reader, writer] = service.join()

    writer.send({ type: 'assert', s: 'n1', p: 'label', o: 'Hello' })
    writer.send({ type: 'assert', s: 'n1', p: 'position', o: { x: 10, y: 20 } })

    const baseEntries = storage.readEntries({ space: 'graph', key: 'ops' })
    const tailBase = baseEntries.at(-1)
    expect(tailBase).toBeTruthy()

    storage.appendEntry({
      id: 'tail-1',
      space: 'graph',
      key: 'ops',
      prev: tailBase.id,
      msg: { type: 'assert', s: 'n2', p: 'label', o: 'World' },
    })
    storage.setRef({ space: 'graph', name: 'head', target: { kind: 'entry', id: 'tail-1' } })

    const restarted = createGraphService(db, warn)
    const [restartReader, restartWriter] = restarted.join()
    const snapshot = await collectN(restartReader, 3)

    expect(snapshot).toEqual([
      { type: 'assert', s: 'n1', p: 'label', o: 'Hello' },
      { type: 'assert', s: 'n1', p: 'position', o: { x: 10, y: 20 } },
      { type: 'assert', s: 'n2', p: 'label', o: 'World' },
    ])

    restartWriter.close()
    writer.close()
    db.close()
  })

  it('seeds only once and exposes recovered state on later boots', async () => {
    const db = makeDb()
    const warn = vi.fn()
    const first = createGraphService(db, warn)

    expect(first.isEmpty()).toBe(true)
    const [_reader, seedWriter] = first.join()
    seedDefaultGraph(seedWriter)
    seedWriter.close()

    const second = createGraphService(db, warn)
    expect(second.isEmpty()).toBe(false)

    const [reader, writer] = second.join()
    const snapshot = await collectN(reader, 6)

    expect(snapshot).toEqual([
      { type: 'assert', s: 'n1', p: 'kind', o: 'default' },
      { type: 'assert', s: 'n1', p: 'position', o: { x: 100, y: 150 } },
      { type: 'assert', s: 'n1', p: 'label', o: 'Hello' },
      { type: 'assert', s: 'n2', p: 'kind', o: 'default' },
      { type: 'assert', s: 'n2', p: 'position', o: { x: 350, y: 200 } },
      { type: 'assert', s: 'n2', p: 'label', o: 'World' },
    ])

    writer.close()
    db.close()
  })
})
