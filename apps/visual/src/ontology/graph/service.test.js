import { beforeAll, describe, expect, it, vi } from 'vitest'
import { net } from '@bassline/core'
import { request } from '@bassline/ontology'
import { isEntryResultMsg } from '../storage/messages.js'
import { storage } from '../storage/slang.js'
import { createSqliteStorage } from '../storage/sqlite.js'
import { createGraphService } from './service.js'
import { seedDefaultGraph } from './slang.js'

const runtimeDescribe = process.versions.electron ? describe : describe.skip
let Database

beforeAll(async () => {
  if (!process.versions.electron) return
  Database = (await import('better-sqlite3')).default
})

function makeDb() {
  return new Database(':memory:')
}

function makeStorage(db, debug = vi.fn()) {
  const storageNet = net()
  createSqliteStorage(storageNet(), db, debug)
  return { storageNet, debug }
}

async function readEntries(storageNet, select, qid = crypto.randomUUID()) {
  const result = await request(
    storageNet,
    { type: 'entry-read', qid, select },
    msg => isEntryResultMsg(msg) && msg.qid === qid
  )
  return result.entries
}

async function appendEntry(storageNet, entry, qid = crypto.randomUUID()) {
  await request(storageNet, { type: 'entry-append', qid, entry }, msg => msg.type === 'entry-stored' && msg.qid === qid)
}

runtimeDescribe('graph service', () => {
  it('persists assert and retract ops as graph history', async () => {
    const db = makeDb()
    const { storageNet, debug } = makeStorage(db)
    const storageSlot = storageNet()
    const graphJoin = createGraphService({ persist: storage(storageSlot.send).appendEntry, debug })
    const graphSlot = graphJoin()

    graphSlot.send({ type: 'assert', s: 'n1', p: 'label', o: 'Hello' })
    graphSlot.send({ type: 'retract', s: 'n1', p: 'label', o: null })

    await vi.waitFor(async () => {
      const entries = await readEntries(storageNet, { space: 'graph', key: 'ops' })
      expect(entries.map(entry => entry.msg.type)).toEqual(['assert', 'retract'])
    })

    graphSlot.close()
    storageSlot.close()
    db.close()
  })

  it('does not persist queries', async () => {
    const db = makeDb()
    const { storageNet, debug } = makeStorage(db)
    const storageSlot = storageNet()
    const graphJoin = createGraphService({ persist: storage(storageSlot.send).appendEntry, debug })
    const graphSlot = graphJoin()

    graphSlot.send({ type: 'assert', s: 'n1', p: 'label', o: 'Hello' })
    graphSlot.send({ type: 'query', s: 'n1', p: null, o: null, qid: 'q1' })

    const result = await request(
      graphJoin,
      { type: 'query', s: 'n1', p: null, o: null, qid: 'q2' },
      msg => msg.type === 'result' && msg.qid === 'q2'
    )
    expect(result.triples).toEqual([{ s: 'n1', p: 'label', o: 'Hello' }])

    await vi.waitFor(async () => {
      expect(await readEntries(storageNet, { space: 'graph', key: 'ops' })).toHaveLength(1)
    })

    graphSlot.close()
    storageSlot.close()
    db.close()
  })

  it('links persisted ops through prev ids', async () => {
    const db = makeDb()
    const { storageNet, debug } = makeStorage(db)
    const storageSlot = storageNet()
    const graphJoin = createGraphService({ persist: storage(storageSlot.send).appendEntry, debug })
    const graphSlot = graphJoin()

    graphSlot.send({ type: 'assert', s: 'n1', p: 'label', o: 'Hello' })
    graphSlot.send({ type: 'assert', s: 'n1', p: 'position', o: { x: 10, y: 20 } })

    await vi.waitFor(async () => {
      const entries = await readEntries(storageNet, { space: 'graph', key: 'ops' })
      expect(entries).toHaveLength(2)
      expect(entries[0].prev).toBeNull()
      expect(entries[1].prev).toBe(entries[0].id)
    })

    graphSlot.close()
    storageSlot.close()
    db.close()
  })

  it('reconstructs graph state from persisted graph history', async () => {
    const db = makeDb()
    const { storageNet, debug } = makeStorage(db)
    const storageSlot = storageNet()
    const graphJoin = createGraphService({ persist: storage(storageSlot.send).appendEntry, debug })
    const graphSlot = graphJoin()

    graphSlot.send({ type: 'assert', s: 'n1', p: 'label', o: 'Hello' })
    graphSlot.send({ type: 'assert', s: 'n1', p: 'position', o: { x: 10, y: 20 } })

    await vi.waitFor(async () => {
      expect(await readEntries(storageNet, { space: 'graph', key: 'ops' })).toHaveLength(2)
    })

    const baseEntries = await readEntries(storageNet, { space: 'graph', key: 'ops' })
    const tailBase = baseEntries.at(-1)

    await appendEntry(storageNet, {
      id: 'tail-1',
      space: 'graph',
      key: 'ops',
      prev: tailBase.id,
      msg: { type: 'assert', s: 'n2', p: 'label', o: 'World' },
    })
    const restarted = createGraphService({
      history: await readEntries(storageNet, { space: 'graph', key: 'ops' }),
      debug,
    })

    const result = await request(
      restarted,
      { type: 'query', s: null, p: null, o: null, qid: 'restart' },
      msg => msg.type === 'result' && msg.qid === 'restart'
    )

    expect(result).toEqual({
      type: 'result',
      qid: 'restart',
      triples: [
        { s: 'n1', p: 'label', o: 'Hello' },
        { s: 'n1', p: 'position', o: { x: 10, y: 20 } },
        { s: 'n2', p: 'label', o: 'World' },
      ],
    })

    graphSlot.close()
    storageSlot.close()
    db.close()
  })

  it('seeds only once and exposes recovered state through query on later boots', async () => {
    const db = makeDb()
    const { storageNet, debug } = makeStorage(db)
    const storageSlot = storageNet()
    const graphJoin = createGraphService({ persist: storage(storageSlot.send).appendEntry, debug })

    expect(await readEntries(storageNet, { space: 'graph', key: 'ops', limit: 1 })).toHaveLength(0)
    const seedSlot = graphJoin()
    seedDefaultGraph(seedSlot.send)
    seedSlot.close()

    await vi.waitFor(async () => {
      expect(await readEntries(storageNet, { space: 'graph', key: 'ops', limit: 1 })).toHaveLength(1)
    })

    const second = createGraphService({
      history: await readEntries(storageNet, { space: 'graph', key: 'ops' }),
      debug,
    })

    const result = await request(
      second,
      { type: 'query', s: null, p: null, o: null, qid: 'seeded' },
      msg => msg.type === 'result' && msg.qid === 'seeded'
    )

    expect(result).toEqual({
      type: 'result',
      qid: 'seeded',
      triples: [
        { s: 'n1', p: 'kind', o: 'default' },
        { s: 'n1', p: 'position', o: { x: 100, y: 150 } },
        { s: 'n1', p: 'label', o: 'Hello' },
        { s: 'n2', p: 'kind', o: 'default' },
        { s: 'n2', p: 'position', o: { x: 350, y: 200 } },
        { s: 'n2', p: 'label', o: 'World' },
      ],
    })

    storageSlot.close()
    db.close()
  })
})
