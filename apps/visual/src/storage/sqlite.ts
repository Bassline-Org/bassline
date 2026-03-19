import { net } from '@bassline/core'
import type BetterSqlite3 from 'better-sqlite3'
import {
  isStorageRequestMsg,
  isStorageResultMsg,
  type Checkpoint,
  type CheckpointReadMsg,
  type CheckpointResultMsg,
  type CheckpointSetMsg,
  type Entry,
  type EntryReadMsg,
  type EntryReadSelector,
  type EntryResultMsg,
  type EntryAppendMsg,
  type Ref,
  type RefReadMsg,
  type RefResultMsg,
  type RefSetMsg,
  type StorageMsg,
  type StorageReader,
  type StorageRequestMsg,
  type StorageWriter,
} from './messages'

type Warn = (message: string, context?: unknown) => void

type EntryRow = {
  entry_id: string
  space: string
  key: string
  prev_entry_id: string | null
  msg_json: string
}

type RefRow = {
  space: string
  name: string
  target_kind: 'entry' | 'checkpoint' | null
  target_id: string | null
}

type CheckpointRow = {
  space: string
  name: string
  tail_entry_id: string | null
  state_json: string
}

export function ensureStorageSchema(db: BetterSqlite3.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id TEXT UNIQUE NOT NULL,
      space TEXT NOT NULL,
      key TEXT NOT NULL,
      prev_entry_id TEXT,
      msg_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refs (
      space TEXT NOT NULL,
      name TEXT NOT NULL,
      target_kind TEXT,
      target_id TEXT,
      PRIMARY KEY (space, name)
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
      space TEXT NOT NULL,
      name TEXT NOT NULL,
      tail_entry_id TEXT,
      state_json TEXT NOT NULL,
      PRIMARY KEY (space, name)
    );

    CREATE INDEX IF NOT EXISTS idx_entries_space_key_seq ON entries (space, key, seq);
  `)
}

function serializeJson(label: string, value: unknown, warn: Warn) {
  try {
    return JSON.stringify(value)
  } catch (error) {
    warn(`${label}: failed to serialize JSON`, { value, error })
    return null
  }
}

function parseJson<T>(label: string, value: string, warn: Warn) {
  try {
    return JSON.parse(value) as T
  } catch (error) {
    warn(`${label}: failed to parse JSON`, { value, error })
    return null
  }
}

export function createSqliteStorage(db: BetterSqlite3.Database, warn: Warn = console.warn) {
  ensureStorageSchema(db)

  const storageNet = net<StorageMsg>()

  const insertEntry = db.prepare(
    'INSERT INTO entries (entry_id, space, key, prev_entry_id, msg_json) VALUES (?, ?, ?, ?, ?)'
  )
  const selectEntrySeq = db.prepare('SELECT seq FROM entries WHERE entry_id = ?') as BetterSqlite3.Statement<
    [string],
    { seq: number } | undefined
  >
  const upsertRef = db.prepare(`
    INSERT INTO refs (space, name, target_kind, target_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(space, name) DO UPDATE SET
      target_kind = excluded.target_kind,
      target_id = excluded.target_id
  `)
  const selectRef = db.prepare(
    'SELECT space, name, target_kind, target_id FROM refs WHERE space = ? AND name = ?'
  ) as BetterSqlite3.Statement<[string, string], RefRow | undefined>
  const upsertCheckpoint = db.prepare(`
    INSERT INTO checkpoints (space, name, tail_entry_id, state_json)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(space, name) DO UPDATE SET
      tail_entry_id = excluded.tail_entry_id,
      state_json = excluded.state_json
  `)
  const selectCheckpoint = db.prepare(
    'SELECT space, name, tail_entry_id, state_json FROM checkpoints WHERE space = ? AND name = ?'
  ) as BetterSqlite3.Statement<[string, string], CheckpointRow | undefined>

  function appendEntry(entry: Entry) {
    const msgJson = serializeJson('storage.entry-append', entry.msg, warn)
    if (msgJson == null) return false

    try {
      insertEntry.run(entry.id, entry.space, entry.key, entry.prev ?? null, msgJson)
      return true
    } catch (error) {
      warn('storage.entry-append: failed to insert entry', { entry, error })
      return false
    }
  }

  function getAfterSeq(after?: string) {
    if (!after) return null
    const row = selectEntrySeq.get(after)
    if (!row) {
      warn('storage.entry-read: missing after entry, replaying from start', { after })
      return null
    }
    return row.seq
  }

  function readEntries(select: EntryReadSelector) {
    const clauses = ['space = ?']
    const params: Array<string | number> = [select.space]

    if (select.key) {
      clauses.push('key = ?')
      params.push(select.key)
    }

    if (select.prefix) {
      clauses.push('(key = ? OR key LIKE ?)')
      params.push(select.prefix, `${select.prefix}/%`)
    }

    const afterSeq = getAfterSeq(select.after)
    if (afterSeq != null) {
      clauses.push('seq > ?')
      params.push(afterSeq)
    }

    let sql = `
      SELECT entry_id, space, key, prev_entry_id, msg_json
      FROM entries
      WHERE ${clauses.join(' AND ')}
      ORDER BY seq
    `
    if (select.limit != null && select.limit > 0) {
      sql += ' LIMIT ?'
      params.push(select.limit)
    }

    const rows = db.prepare(sql).all(...params) as EntryRow[]
    const entries: Entry[] = []

    for (const row of rows) {
      const msg = parseJson<unknown>('storage.entry-read', row.msg_json, warn)
      if (msg == null) continue
      entries.push({
        id: row.entry_id,
        space: row.space,
        key: row.key,
        msg,
        prev: row.prev_entry_id,
      })
    }

    return entries
  }

  function setRef(ref: Ref) {
    try {
      upsertRef.run(ref.space, ref.name, ref.target?.kind ?? null, ref.target?.id ?? null)
      return true
    } catch (error) {
      warn('storage.ref-set: failed to set ref', { ref, error })
      return false
    }
  }

  function readRef(space: string, name: string) {
    const row = selectRef.get(space, name)
    if (!row) return null
    return {
      space: row.space,
      name: row.name,
      target: row.target_kind && row.target_id ? { kind: row.target_kind, id: row.target_id } : null,
    } satisfies Ref
  }

  function setCheckpoint(checkpoint: Checkpoint) {
    const stateJson = serializeJson('storage.checkpoint-set', checkpoint.state, warn)
    if (stateJson == null) return false

    try {
      upsertCheckpoint.run(checkpoint.space, checkpoint.name, checkpoint.tail, stateJson)
      return true
    } catch (error) {
      warn('storage.checkpoint-set: failed to set checkpoint', { checkpoint, error })
      return false
    }
  }

  function readCheckpoint(space: string, name: string) {
    const row = selectCheckpoint.get(space, name)
    if (!row) return null
    const state = parseJson<unknown>('storage.checkpoint-read', row.state_json, warn)
    if (state == null) return null
    return {
      space: row.space,
      name: row.name,
      tail: row.tail_entry_id,
      state,
    } satisfies Checkpoint
  }

  function handleEntryRead(msg: EntryReadMsg): EntryResultMsg {
    return { type: 'entry-result', qid: msg.qid, entries: readEntries(msg.select) }
  }

  function handleRefRead(msg: RefReadMsg): RefResultMsg {
    return { type: 'ref-result', qid: msg.qid, ref: readRef(msg.space, msg.name) }
  }

  function handleCheckpointRead(msg: CheckpointReadMsg): CheckpointResultMsg {
    return { type: 'checkpoint-result', qid: msg.qid, checkpoint: readCheckpoint(msg.space, msg.name) }
  }

  const [storageReader, storageWriter] = storageNet.join()
  storageReader.sink((msg: StorageMsg) => {
    try {
      switch (msg.type) {
        case 'entry-append':
          appendEntry((msg as EntryAppendMsg).entry)
          break
        case 'entry-read':
          storageWriter.send(handleEntryRead(msg))
          break
        case 'ref-set':
          setRef((msg as RefSetMsg).ref)
          break
        case 'ref-read':
          storageWriter.send(handleRefRead(msg))
          break
        case 'checkpoint-set':
          setCheckpoint((msg as CheckpointSetMsg).checkpoint)
          break
        case 'checkpoint-read':
          storageWriter.send(handleCheckpointRead(msg))
          break
        case 'entry-result':
        case 'ref-result':
        case 'checkpoint-result':
          break
      }
    } catch (error) {
      warn('storage.participant: failed to handle message', { msg, error })
    }
  })

  function join(): [StorageReader, StorageWriter] {
    const [reader, rawWriter] = storageNet.join()
    const writer: StorageWriter = {
      send: (...values: StorageRequestMsg[]) => {
        for (const value of values) {
          if (!isStorageRequestMsg(value)) throw new Error(`invalid storage request: ${JSON.stringify(value)}`)
        }
        rawWriter.send(...values)
      },
      close: () => rawWriter.close(),
      err: e => rawWriter.err(e),
    }

    return [reader.filter(isStorageResultMsg) as StorageReader, writer]
  }

  return {
    appendEntry,
    readEntries,
    setRef,
    readRef,
    setCheckpoint,
    readCheckpoint,
    join,
  }
}
