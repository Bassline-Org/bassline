import type { Reader, Writer } from '@bassline/core'

export type Entry = {
  id: string
  space: string
  key: string
  msg: unknown
  prev?: string | null
}

export type RefTarget = { kind: 'entry' | 'checkpoint'; id: string } | null

export type Ref = {
  space: string
  name: string
  target: RefTarget
}

export type Checkpoint = {
  space: string
  name: string
  tail: string | null
  state: unknown
}

export type EntryReadSelector = {
  space: string
  key?: string
  prefix?: string
  after?: string
  limit?: number
}

export type EntryAppendMsg = { type: 'entry-append'; entry: Entry }
export type EntryReadMsg = { type: 'entry-read'; qid: string; select: EntryReadSelector }
export type EntryResultMsg = { type: 'entry-result'; qid: string; entries: Entry[] }

export type RefSetMsg = { type: 'ref-set'; ref: Ref }
export type RefReadMsg = { type: 'ref-read'; qid: string; space: string; name: string }
export type RefResultMsg = { type: 'ref-result'; qid: string; ref: Ref | null }

export type CheckpointSetMsg = { type: 'checkpoint-set'; checkpoint: Checkpoint }
export type CheckpointReadMsg = { type: 'checkpoint-read'; qid: string; space: string; name: string }
export type CheckpointResultMsg = { type: 'checkpoint-result'; qid: string; checkpoint: Checkpoint | null }

export type StorageRequestMsg =
  | EntryAppendMsg
  | EntryReadMsg
  | RefSetMsg
  | RefReadMsg
  | CheckpointSetMsg
  | CheckpointReadMsg

export type StorageResultMsg = EntryResultMsg | RefResultMsg | CheckpointResultMsg
export type StorageMsg = StorageRequestMsg | StorageResultMsg

export type StorageReader = Reader<StorageResultMsg>
export type StorageWriter = Writer<StorageRequestMsg>

export function storage(writer: StorageWriter) {
  return {
    appendEntry(entry: Entry) {
      writer.send({ type: 'entry-append', entry })
    },

    readEntries(select: EntryReadSelector) {
      const qid = crypto.randomUUID()
      writer.send({ type: 'entry-read', qid, select })
      return qid
    },

    setRef(ref: Ref) {
      writer.send({ type: 'ref-set', ref })
    },

    readRef(space: string, name: string) {
      const qid = crypto.randomUUID()
      writer.send({ type: 'ref-read', qid, space, name })
      return qid
    },

    setCheckpoint(checkpoint: Checkpoint) {
      writer.send({ type: 'checkpoint-set', checkpoint })
    },

    readCheckpoint(space: string, name: string) {
      const qid = crypto.randomUUID()
      writer.send({ type: 'checkpoint-read', qid, space, name })
      return qid
    },
  } as const
}

export function isStorageRequestMsg(msg: unknown): msg is StorageRequestMsg {
  if (!msg || typeof msg !== 'object') return false
  const type = (msg as { type?: unknown }).type
  return (
    type === 'entry-append' ||
    type === 'entry-read' ||
    type === 'ref-set' ||
    type === 'ref-read' ||
    type === 'checkpoint-set' ||
    type === 'checkpoint-read'
  )
}

export function isStorageResultMsg(msg: unknown): msg is StorageResultMsg {
  if (!msg || typeof msg !== 'object') return false
  const type = (msg as { type?: unknown }).type
  return type === 'entry-result' || type === 'ref-result' || type === 'checkpoint-result'
}
