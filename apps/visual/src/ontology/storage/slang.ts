import type { Entry, EntryReadSelector, Ref, Checkpoint, StorageMsg } from './messages'

export function storage(send: (msg: StorageMsg) => void) {
  return {
    appendEntry: (entry: Entry, qid?: string) => send({ type: 'entry-append', entry, qid }),
    readEntries: (select: EntryReadSelector) => {
      const qid = crypto.randomUUID()
      send({ type: 'entry-read', qid, select })
      return qid
    },
    setRef: (ref: Ref, qid?: string) => send({ type: 'ref-set', ref, qid }),
    readRef: (space: string, name: string) => {
      const qid = crypto.randomUUID()
      send({ type: 'ref-read', qid, space, name })
      return qid
    },
    setCheckpoint: (checkpoint: Checkpoint, qid?: string) => send({ type: 'checkpoint-set', checkpoint, qid }),
    readCheckpoint: (space: string, name: string) => {
      const qid = crypto.randomUUID()
      send({ type: 'checkpoint-read', qid, space, name })
      return qid
    },
  } as const
}
