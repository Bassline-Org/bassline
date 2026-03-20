import { hasType } from '@/utils'
import { type Writer } from '@bassline/core'

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

export type EntryAppendMsg = { type: 'entry-append'; entry: Entry; qid?: string }
export type EntryStoredMsg = { type: 'entry-stored'; entry: Entry; qid?: string }
export type EntryReadMsg = { type: 'entry-read'; qid: string; select: EntryReadSelector }
export type EntryResultMsg = { type: 'entry-result'; qid: string; entries: Entry[] }

export type RefSetMsg = { type: 'ref-set'; ref: Ref; qid?: string }
export type RefStoredMsg = { type: 'ref-stored'; ref: Ref; qid?: string }
export type RefReadMsg = { type: 'ref-read'; qid: string; space: string; name: string }
export type RefResultMsg = { type: 'ref-result'; qid: string; ref: Ref | null }

export type CheckpointSetMsg = { type: 'checkpoint-set'; checkpoint: Checkpoint; qid?: string }
export type CheckpointStoredMsg = { type: 'checkpoint-stored'; checkpoint: Checkpoint; qid?: string }
export type CheckpointReadMsg = { type: 'checkpoint-read'; qid: string; space: string; name: string }
export type CheckpointResultMsg = { type: 'checkpoint-result'; qid: string; checkpoint: Checkpoint | null }

export type StorageRequestMsg =
  | EntryAppendMsg
  | EntryReadMsg
  | RefSetMsg
  | RefReadMsg
  | CheckpointSetMsg
  | CheckpointReadMsg

export type StorageResponseMsg =
  | EntryStoredMsg
  | EntryResultMsg
  | RefStoredMsg
  | RefResultMsg
  | CheckpointStoredMsg
  | CheckpointResultMsg

export type StorageMsg = StorageRequestMsg | StorageResponseMsg

export type EntryWriter = Writer<Entry>

export function entryWriter(writer: Writer<StorageMsg>): EntryWriter {
  return {
    send: (...entries: Entry[]) => {
      for (const entry of entries) writer.send({ type: 'entry-append', entry })
    },
    close: () => writer.close(),
    err: e => writer.err(e),
  }
}

export function isEntryAppendMsg(msg: unknown): msg is EntryAppendMsg {
  return hasType(msg, 'entry-append')
}

export function isEntryStoredMsg(msg: unknown): msg is EntryStoredMsg {
  return hasType(msg, 'entry-stored')
}

export function isEntryReadMsg(msg: unknown): msg is EntryReadMsg {
  return hasType(msg, 'entry-read')
}

export function isEntryResultMsg(msg: unknown): msg is EntryResultMsg {
  return hasType(msg, 'entry-result')
}

export function isRefSetMsg(msg: unknown): msg is RefSetMsg {
  return hasType(msg, 'ref-set')
}

export function isRefStoredMsg(msg: unknown): msg is RefStoredMsg {
  return hasType(msg, 'ref-stored')
}

export function isRefReadMsg(msg: unknown): msg is RefReadMsg {
  return hasType(msg, 'ref-read')
}

export function isRefResultMsg(msg: unknown): msg is RefResultMsg {
  return hasType(msg, 'ref-result')
}

export function isCheckpointSetMsg(msg: unknown): msg is CheckpointSetMsg {
  return hasType(msg, 'checkpoint-set')
}

export function isCheckpointStoredMsg(msg: unknown): msg is CheckpointStoredMsg {
  return hasType(msg, 'checkpoint-stored')
}

export function isCheckpointReadMsg(msg: unknown): msg is CheckpointReadMsg {
  return hasType(msg, 'checkpoint-read')
}

export function isCheckpointResultMsg(msg: unknown): msg is CheckpointResultMsg {
  return hasType(msg, 'checkpoint-result')
}

export function isStorageRequestMsg(msg: unknown): msg is StorageRequestMsg {
  return (
    isEntryAppendMsg(msg) ||
    isEntryReadMsg(msg) ||
    isRefSetMsg(msg) ||
    isRefReadMsg(msg) ||
    isCheckpointSetMsg(msg) ||
    isCheckpointReadMsg(msg)
  )
}

export function isStorageResponseMsg(msg: unknown): msg is StorageResponseMsg {
  return (
    isEntryStoredMsg(msg) ||
    isEntryResultMsg(msg) ||
    isRefStoredMsg(msg) ||
    isRefResultMsg(msg) ||
    isCheckpointStoredMsg(msg) ||
    isCheckpointResultMsg(msg)
  )
}

export function isStorageMsg(msg: unknown): msg is StorageMsg {
  return isStorageRequestMsg(msg) || isStorageResponseMsg(msg)
}
