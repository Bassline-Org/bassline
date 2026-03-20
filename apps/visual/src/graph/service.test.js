import { beforeAll, describe, expect, it, vi } from 'vitest'
import { net } from '@bassline/core'
import { entryWriter, isEntryResultMsg } from '../storage/messages.js'
import { createSqliteStorage } from '../storage/sqlite.js'
import { createGraphService, seedDefaultGraph } from './service.js'

const runtimeDescribe = process.versions.electron ? describe : describe.skip
let Database

beforeAll(async () => {
  if (!process.versions.electron) return
  Database = (await import('better-sqlite3')).default
})

const collectN = n => async reader => {
  const values = []
  await reader.take(n).sink(value => values.push(value))
  return values
}

function makeDb() {
  return new Database(':memory:')
}

function makeStorage(db, warn = vi.fn()) {
  const storageNet = net()
  createSqliteStorage(storageNet.join(), db, warn)
  return { storageNet, warn }
}

async function requestOne(storageNet, request, predicate) {
  const [reader, writer] = storageNet.join()
  writer.send(request)
  const [result] = await reader.filter(predicate).thru(collectN(1))
  writer.close()
  return result
}

async function readEntries(storageNet, select, qid = crypto.randomUUID()) {
  const result = await requestOne(
    storageNet,
    { type: 'entry-read', qid, select },
    msg => isEntryResultMsg(msg) && msg.qid === qid
  )
  return result.entries
}

async function appendEntry(storageNet, entry, qid = crypto.randomUUID()) {
  await requestOne(
    storageNet,
    { type: 'entry-append', qid, entry },
    msg => msg.type === 'entry-stored' && msg.qid === qid
  )
}

runtimeDescribe('graph service', () => {
  it('persists assert and retract ops as graph history', async () => {
    const db = makeDb()
    const { storageNet, warn } = makeStorage(db)
    const [_storageReader, storageWriter] = storageNet.join()
    const graph = createGraphService({ persist: entryWriter(storageWriter), warn })
    const [_reader, writer] = graph.join()

    writer.send({ type: 'assert', s: 'n1', p: 'label', o: 'Hello' })
    writer.send({ type: 'retract', s: 'n1', p: 'label', o: null })

    await vi.waitFor(async () => {
      const entries = await readEntries(storageNet, { space: 'graph', key: 'ops' })
      expect(entries.map(entry => entry.msg.type)).toEqual(['assert', 'retract'])
    })

    writer.close()
    storageWriter.close()
    db.close()
  })

  it('does not persist queries', async () => {
    const db = makeDb()
    const { storageNet, warn } = makeStorage(db)
    const [_storageReader, storageWriter] = storageNet.join()
    const graph = createGraphService({ persist: entryWriter(storageWriter), warn })
    const [reader, writer] = graph.join()

    const resultPromise = reader.filter(msg => msg.type === 'result').thru(collectN(1))

    writer.send({ type: 'assert', s: 'n1', p: 'label', o: 'Hello' })
    writer.send({ type: 'query', s: 'n1', p: null, o: null, qid: 'q1' })

    expect((await resultPromise)[0]).toEqual({
      type: 'result',
      qid: 'q1',
      triples: [{ s: 'n1', p: 'label', o: 'Hello' }],
    })
    await vi.waitFor(async () => {
      expect(await readEntries(storageNet, { space: 'graph', key: 'ops' })).toHaveLength(1)
    })

    writer.close()
    storageWriter.close()
    db.close()
  })

  it('links persisted ops through prev ids', async () => {
    const db = makeDb()
    const { storageNet, warn } = makeStorage(db)
    const [_storageReader, storageWriter] = storageNet.join()
    const graph = createGraphService({ persist: entryWriter(storageWriter), warn })
    const [_reader, writer] = graph.join()

    writer.send({ type: 'assert', s: 'n1', p: 'label', o: 'Hello' })
    writer.send({ type: 'assert', s: 'n1', p: 'position', o: { x: 10, y: 20 } })

    await vi.waitFor(async () => {
      const entries = await readEntries(storageNet, { space: 'graph', key: 'ops' })
      expect(entries).toHaveLength(2)
      expect(entries[0].prev).toBeNull()
      expect(entries[1].prev).toBe(entries[0].id)
    })

    writer.close()
    storageWriter.close()
    db.close()
  })

  it('reconstructs graph state from persisted graph history', async () => {
    const db = makeDb()
    const { storageNet, warn } = makeStorage(db)
    const [_storageReader, storageWriter] = storageNet.join()
    const graph = createGraphService({ persist: entryWriter(storageWriter), warn })
    const [_reader, writer] = graph.join()

    writer.send({ type: 'assert', s: 'n1', p: 'label', o: 'Hello' })
    writer.send({ type: 'assert', s: 'n1', p: 'position', o: { x: 10, y: 20 } })

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
      warn,
    })
    const [restartReader, restartWriter] = restarted.join()
    const resultPromise = restartReader.filter(msg => msg.type === 'result').thru(collectN(1))

    restartWriter.send({ type: 'query', s: null, p: null, o: null, qid: 'restart' })

    expect((await resultPromise)[0]).toEqual({
      type: 'result',
      qid: 'restart',
      triples: [
        { s: 'n1', p: 'label', o: 'Hello' },
        { s: 'n1', p: 'position', o: { x: 10, y: 20 } },
        { s: 'n2', p: 'label', o: 'World' },
      ],
    })

    restartWriter.close()
    writer.close()
    storageWriter.close()
    db.close()
  })

  it('seeds only once and exposes recovered state through query on later boots', async () => {
    const db = makeDb()
    const { storageNet, warn } = makeStorage(db)
    const [_storageReader, storageWriter] = storageNet.join()
    const graph = createGraphService({ persist: entryWriter(storageWriter), warn })

    expect(await readEntries(storageNet, { space: 'graph', key: 'ops', limit: 1 })).toHaveLength(0)
    const [_reader, seedWriter] = graph.join()
    seedDefaultGraph(seedWriter)
    seedWriter.close()

    await vi.waitFor(async () => {
      expect(await readEntries(storageNet, { space: 'graph', key: 'ops', limit: 1 })).toHaveLength(1)
    })

    const second = createGraphService({
      history: await readEntries(storageNet, { space: 'graph', key: 'ops' }),
      warn,
    })

    const [reader, writer] = second.join()
    const resultPromise = reader.filter(msg => msg.type === 'result').thru(collectN(1))

    writer.send({ type: 'query', s: null, p: null, o: null, qid: 'seeded' })

    expect((await resultPromise)[0]).toEqual({
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

    writer.close()
    storageWriter.close()
    db.close()
  })
})
