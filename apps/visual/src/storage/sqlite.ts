import type { Reader, Writer } from '@bassline/core'
import { nullWriter } from '@bassline/core'
import type BetterSqlite3 from 'better-sqlite3'
import {
  isCheckpointReadMsg,
  isCheckpointSetMsg,
  isEntryAppendMsg,
  isEntryReadMsg,
  isRefReadMsg,
  isRefSetMsg,
  type Checkpoint,
  type CheckpointReadMsg,
  type CheckpointSetMsg,
  type Entry,
  type EntryAppendMsg,
  type EntryReadMsg,
  type EntryReadSelector,
  type Ref,
  type RefReadMsg,
  type RefSetMsg,
  type StorageMsg,
} from './messages'

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

export function createSqliteStorage(
  [reader, writer]: [Reader<StorageMsg>, Writer<StorageMsg>],
  db: BetterSqlite3.Database,
  warn: Warn = console.warn
) {
  ensureStorageSchema(db)
  const ops = prepareDbOps(db, warn)

  function setRef(ref: Ref) {
    try {
      ops.upsertRef.run(ref.space, ref.name, ref.target?.kind ?? null, ref.target?.id ?? null)
      return ref
    } catch (error) {
      warn('storage.ref-set: failed to set ref', { ref, error })
      return null
    }
  }

  function readRef(space: string, name: string) {
    const row = ops.selectRef.get(space, name)
    if (!row) return null
    return {
      space: row.space,
      name: row.name,
      target: row.target_kind && row.target_id ? { kind: row.target_kind, id: row.target_id } : null,
    } satisfies Ref
  }

  function setCheckpoint(checkpoint: Checkpoint) {
    const stateJson = serializeJson('storage.checkpoint-set', checkpoint.state, warn)
    if (stateJson == null) return null

    try {
      ops.upsertCheckpoint.run(checkpoint.space, checkpoint.name, checkpoint.tail, stateJson)
      return checkpoint
    } catch (error) {
      warn('storage.checkpoint-set: failed to set checkpoint', { checkpoint, error })
      return null
    }
  }

  function readCheckpoint(space: string, name: string) {
    const row = ops.selectCheckpoint.get(space, name)
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

  function handleEntryAppend(msg: EntryAppendMsg) {
    const entry = ops.appendEntry(msg.entry)
    if (entry) writer.send({ type: 'entry-stored', entry, qid: msg.qid })
  }

  function handleEntryRead(msg: EntryReadMsg) {
    writer.send({ type: 'entry-result', qid: msg.qid, entries: ops.readEntries(msg.select) })
  }

  function handleRefSet(msg: RefSetMsg) {
    const ref = setRef(msg.ref)
    if (ref) writer.send({ type: 'ref-stored', ref, qid: msg.qid })
  }

  function handleRefRead(msg: RefReadMsg) {
    writer.send({ type: 'ref-result', qid: msg.qid, ref: readRef(msg.space, msg.name) })
  }

  function handleCheckpointSet(msg: CheckpointSetMsg) {
    const checkpoint = setCheckpoint(msg.checkpoint)
    if (checkpoint) writer.send({ type: 'checkpoint-stored', checkpoint, qid: msg.qid })
  }

  function handleCheckpointRead(msg: CheckpointReadMsg) {
    writer.send({ type: 'checkpoint-result', qid: msg.qid, checkpoint: readCheckpoint(msg.space, msg.name) })
  }

  reader
    .gate(isEntryAppendMsg, handleEntryAppend)
    .gate(isEntryReadMsg, handleEntryRead)
    .gate(isRefSetMsg, handleRefSet)
    .gate(isRefReadMsg, handleRefRead)
    .gate(isCheckpointReadMsg, handleCheckpointRead)
    .gate(isCheckpointSetMsg, handleCheckpointSet)
    .sink(nullWriter())
}

function prepareDbOps(db: BetterSqlite3.Database, warn: Warn) {
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
  const selectRef = db.prepare<[string, string], RefRow | undefined>(
    'SELECT space, name, target_kind, target_id FROM refs WHERE space = ? AND name = ?'
  )
  const upsertCheckpoint = db.prepare(`
    INSERT INTO checkpoints (space, name, tail_entry_id, state_json)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(space, name) DO UPDATE SET
      tail_entry_id = excluded.tail_entry_id,
      state_json = excluded.state_json
  `)
  const selectCheckpoint = db.prepare<[string, string], CheckpointRow | undefined>(
    'SELECT space, name, tail_entry_id, state_json FROM checkpoints WHERE space = ? AND name = ?'
  )

  function appendEntry(entry: Entry) {
    const msgJson = serializeJson('storage.entry-append', entry.msg, warn)
    if (msgJson == null) return null

    try {
      insertEntry.run(entry.id, entry.space, entry.key, entry.prev ?? null, msgJson)
      return { ...entry, prev: entry.prev ?? null } satisfies Entry
    } catch (error) {
      warn('storage.entry-append: failed to insert entry', { entry, error })
      return null
    }
  }

  function getAfterSeq(after?: string) {
    if (!after) return null
    const row = selectEntrySeq.get(after)
    if (!row) {
      warn('storage.entry-read: missing after entry', { after })
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

    const rows = db.prepare<typeof params, EntryRow>(sql).all(...params)
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
  return {
    insertEntry,
    selectEntrySeq,
    upsertRef,
    selectRef,
    upsertCheckpoint,
    selectCheckpoint,
    appendEntry,
    getAfterSeq,
    readEntries,
  } as const
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
