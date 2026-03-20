import { beforeAll, describe, expect, it, vi } from 'vitest'
import { net, isEOF } from '@bassline/core'
import {
  isCheckpointResultMsg,
  isCheckpointStoredMsg,
  isEntryResultMsg,
  isEntryStoredMsg,
  isRefResultMsg,
  isRefStoredMsg,
} from './messages.ts'
import { createSqliteStorage } from './sqlite.ts'

const runtimeDescribe = process.versions.electron ? describe : describe.skip
let Database

beforeAll(async () => {
  if (!process.versions.electron) return
  Database = (await import('better-sqlite3')).default
})

function delay(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function makeStorage() {
  const warn = vi.fn()
  const db = new Database(':memory:')
  const storageNet = net()
  createSqliteStorage(storageNet(), db, warn)
  return { db, warn, storageNet }
}

async function requestOne(storageNet, request, predicate) {
  const { send, recv, close } = storageNet()
  send(request)
  while (true) {
    const msg = await recv()
    if (isEOF(msg)) return null
    if (predicate(msg)) {
      close()
      return msg
    }
  }
}

async function observeDuring(storageNet, predicate, sendFn) {
  const slot = storageNet()
  const seen = []
  const collecting = (async () => {
    while (true) {
      const msg = await slot.recv()
      if (isEOF(msg)) break
      if (predicate(msg)) seen.push(msg)
    }
  })()
  await sendFn(slot)
  await delay()
  slot.close()
  await collecting
  return seen
}

async function appendEntry(storageNet, entry, qid = crypto.randomUUID()) {
  return requestOne(storageNet, { type: 'entry-append', entry, qid }, msg => isEntryStoredMsg(msg) && msg.qid === qid)
}

async function readEntries(storageNet, select, qid = crypto.randomUUID()) {
  const result = await requestOne(
    storageNet,
    { type: 'entry-read', qid, select },
    msg => isEntryResultMsg(msg) && msg.qid === qid
  )
  return result.entries
}

async function setRef(storageNet, ref, qid = crypto.randomUUID()) {
  return requestOne(storageNet, { type: 'ref-set', ref, qid }, msg => isRefStoredMsg(msg) && msg.qid === qid)
}

async function readRef(storageNet, space, name, qid = crypto.randomUUID()) {
  const result = await requestOne(
    storageNet,
    { type: 'ref-read', qid, space, name },
    msg => isRefResultMsg(msg) && msg.qid === qid
  )
  return result.ref
}

async function setCheckpoint(storageNet, checkpoint, qid = crypto.randomUUID()) {
  return requestOne(
    storageNet,
    { type: 'checkpoint-set', checkpoint, qid },
    msg => isCheckpointStoredMsg(msg) && msg.qid === qid
  )
}

async function readCheckpoint(storageNet, space, name, qid = crypto.randomUUID()) {
  const result = await requestOne(
    storageNet,
    { type: 'checkpoint-read', qid, space, name },
    msg => isCheckpointResultMsg(msg) && msg.qid === qid
  )
  return result.checkpoint
}

runtimeDescribe('sqlite storage', () => {
  it('appends and reads entries by exact key', async () => {
    const { storageNet, db } = makeStorage()

    await appendEntry(storageNet, {
      id: 'e1',
      space: 'graph',
      key: 'ops',
      msg: { type: 'assert', s: 'n1', p: 'label', o: 'Hello' },
    })

    expect(await readEntries(storageNet, { space: 'graph', key: 'ops' })).toEqual([
      { id: 'e1', space: 'graph', key: 'ops', msg: { type: 'assert', s: 'n1', p: 'label', o: 'Hello' }, prev: null },
    ])

    db.close()
  })

  it('reads entries by prefix', async () => {
    const { storageNet, db } = makeStorage()

    await appendEntry(storageNet, { id: 'e1', space: 'graph', key: 'ops', msg: { body: 1 } })
    await appendEntry(storageNet, { id: 'e2', space: 'graph', key: 'ops/node/a', msg: { body: 2 } })
    await appendEntry(storageNet, { id: 'e3', space: 'graph', key: 'other', msg: { body: 3 } })

    expect((await readEntries(storageNet, { space: 'graph', prefix: 'ops' })).map(entry => entry.id)).toEqual([
      'e1',
      'e2',
    ])

    db.close()
  })

  it('reads entries with after and limit', async () => {
    const { storageNet, db } = makeStorage()

    await appendEntry(storageNet, { id: 'e1', space: 'graph', key: 'ops', msg: { body: 1 } })
    await appendEntry(storageNet, { id: 'e2', space: 'graph', key: 'ops', msg: { body: 2 } })
    await appendEntry(storageNet, { id: 'e3', space: 'graph', key: 'ops', msg: { body: 3 } })

    expect(
      (await readEntries(storageNet, { space: 'graph', key: 'ops', after: 'e1', limit: 1 })).map(entry => entry.id)
    ).toEqual(['e2'])

    db.close()
  })

  it('sets and reads refs and checkpoints', async () => {
    const { storageNet, db } = makeStorage()

    await setRef(storageNet, { space: 'graph', name: 'head', target: { kind: 'entry', id: 'e2' } })
    expect(await readRef(storageNet, 'graph', 'head')).toEqual({
      space: 'graph',
      name: 'head',
      target: { kind: 'entry', id: 'e2' },
    })

    await setCheckpoint(storageNet, {
      space: 'graph',
      name: 'current',
      tail: 'e2',
      state: { subjects: { n1: { label: 'Hello' } } },
    })
    expect(await readCheckpoint(storageNet, 'graph', 'current')).toEqual({
      space: 'graph',
      name: 'current',
      tail: 'e2',
      state: { subjects: { n1: { label: 'Hello' } } },
    })

    db.close()
  })

  it('keeps entries immutable by rejecting duplicate ids and emitting no success ack', async () => {
    const { storageNet, warn, db } = makeStorage()

    await appendEntry(storageNet, { id: 'e1', space: 'graph', key: 'ops', msg: { body: 1 } }, 'first')

    const seen = await observeDuring(
      storageNet,
      msg => isEntryStoredMsg(msg) && msg.qid === 'duplicate',
      async slot => {
        slot.send({
          type: 'entry-append',
          qid: 'duplicate',
          entry: { id: 'e1', space: 'graph', key: 'ops', msg: { body: 2 } },
        })
      }
    )

    expect(seen).toEqual([])
    expect(await readEntries(storageNet, { space: 'graph', key: 'ops' })).toHaveLength(1)
    expect(warn).toHaveBeenCalled()

    db.close()
  })

  it('rejects non-json-serializable entry and checkpoint payloads cleanly with no success ack', async () => {
    const { storageNet, warn, db } = makeStorage()
    const circular = {}
    circular.self = circular

    const entryAcks = await observeDuring(
      storageNet,
      msg => isEntryStoredMsg(msg) && msg.qid === 'bad-entry',
      async slot => {
        slot.send({
          type: 'entry-append',
          qid: 'bad-entry',
          entry: { id: 'e1', space: 'graph', key: 'ops', msg: circular },
        })
      }
    )

    const checkpointAcks = await observeDuring(
      storageNet,
      msg => isCheckpointStoredMsg(msg) && msg.qid === 'bad-checkpoint',
      async slot => {
        slot.send({
          type: 'checkpoint-set',
          qid: 'bad-checkpoint',
          checkpoint: { space: 'graph', name: 'current', tail: null, state: circular },
        })
      }
    )

    expect(entryAcks).toEqual([])
    expect(checkpointAcks).toEqual([])
    expect(await readEntries(storageNet, { space: 'graph', key: 'ops' })).toEqual([])
    expect(warn).toHaveBeenCalled()

    db.close()
  })

  it('skips corrupt stored rows while still returning valid rows', async () => {
    const { storageNet, warn, db } = makeStorage()

    await appendEntry(storageNet, { id: 'e1', space: 'graph', key: 'ops', msg: { body: 1 } })
    db.prepare('INSERT INTO entries (entry_id, space, key, prev_entry_id, msg_json) VALUES (?, ?, ?, ?, ?)').run(
      'broken',
      'graph',
      'ops',
      null,
      '{not-json'
    )

    expect((await readEntries(storageNet, { space: 'graph', key: 'ops' })).map(entry => entry.id)).toEqual(['e1'])
    expect(warn).toHaveBeenCalled()

    db.close()
  })

  it('ignores storage response messages on the input reader', async () => {
    const { storageNet, db } = makeStorage()

    const slot = storageNet()
    slot.send({
      type: 'entry-stored',
      qid: 'noop',
      entry: { id: 'e1', space: 'graph', key: 'ops', msg: { body: 1 } },
    })
    await delay()

    expect(await readEntries(storageNet, { space: 'graph', key: 'ops' })).toEqual([])

    slot.close()
    db.close()
  })

  it('emits exactly one matching ack per successful write and exactly one result per read qid', async () => {
    const { storageNet, db } = makeStorage()

    const entryAcks = await observeDuring(
      storageNet,
      msg => isEntryStoredMsg(msg) && msg.qid === 'entry-q',
      async slot => {
        slot.send({
          type: 'entry-append',
          qid: 'entry-q',
          entry: { id: 'e1', space: 'graph', key: 'ops', msg: { body: 1 } },
        })
      }
    )
    const refAcks = await observeDuring(
      storageNet,
      msg => isRefStoredMsg(msg) && msg.qid === 'ref-q',
      async slot => {
        slot.send({
          type: 'ref-set',
          qid: 'ref-q',
          ref: { space: 'graph', name: 'head', target: { kind: 'entry', id: 'e1' } },
        })
      }
    )
    const checkpointAcks = await observeDuring(
      storageNet,
      msg => isCheckpointStoredMsg(msg) && msg.qid === 'checkpoint-q',
      async slot => {
        slot.send({
          type: 'checkpoint-set',
          qid: 'checkpoint-q',
          checkpoint: { space: 'graph', name: 'current', tail: 'e1', state: { ok: true } },
        })
      }
    )
    const entryResults = await observeDuring(
      storageNet,
      msg => isEntryResultMsg(msg) && msg.qid === 'read-q',
      async slot => {
        slot.send({ type: 'entry-read', qid: 'read-q', select: { space: 'graph', key: 'ops' } })
      }
    )

    expect(entryAcks).toHaveLength(1)
    expect(refAcks).toHaveLength(1)
    expect(checkpointAcks).toHaveLength(1)
    expect(entryResults).toHaveLength(1)
    expect(entryResults[0].qid).toBe('read-q')

    db.close()
  })
})
