import { channel, net } from '@bassline/core'
import type { Reader, Writer } from '@bassline/core'
import type BetterSqlite3 from 'better-sqlite3'
import { type Checkpoint, type Entry } from '../storage/messages'
import { createSqliteStorage } from '../storage/sqlite'
import { graph } from './messages'
import type { QueryMsg } from './messages'
import {
  cloneGraphReadMsg,
  isGraphMutationMsg,
  isGraphQueryMsg,
  normalizeGraphMutationMsg,
  normalizeQueryMsg,
  type GraphMutationMsg,
  type GraphReadMsg,
  type GraphWriteMsg,
} from './shapes'
import { createGraphState, isGraphCheckpointState } from './state'

type Warn = (message: string, context?: unknown) => void

export type GraphService = {
  join(): [Reader<GraphReadMsg>, Writer<GraphWriteMsg>]
  isEmpty(): boolean
}

type GraphState = ReturnType<typeof createGraphState>

function broadcastResult(msg: QueryMsg, state: GraphState) {
  const query = normalizeQueryMsg(msg)
  return {
    type: 'result',
    qid: query.qid,
    triples: state.query(query.s, query.p, query.o),
  } as const
}

export function createGraphService(db: BetterSqlite3.Database, warn: Warn = console.warn): GraphService {
  const storage = createSqliteStorage(db, warn)
  const state = createGraphState()
  const internalNet = net<GraphReadMsg>()
  const readers = new Set<Writer<GraphReadMsg>>()
  let head: string | null = null

  const [internalReader] = internalNet.join()
  internalReader.sink((msg: GraphReadMsg) => {
    const cloned = cloneGraphReadMsg(msg)
    for (const reader of readers) reader.send(cloned)
  })

  const checkpoint = storage.readCheckpoint('graph', 'current')
  let checkpointTail: string | null = null

  if (checkpoint) {
    if (isGraphCheckpointState(checkpoint.state)) {
      state.load(checkpoint.state)
      checkpointTail = checkpoint.tail
      head = checkpoint.tail
    } else {
      warn('graph.service: invalid checkpoint state, replaying from history', { checkpoint })
    }
  }

  const entries = storage.readEntries({
    space: 'graph',
    key: 'ops',
    after: checkpointTail ?? undefined,
  })

  for (const entry of entries) {
    if (!isGraphMutationMsg(entry.msg)) {
      warn('graph.service: skipping invalid graph history entry', { entry })
      continue
    }

    const msg = normalizeGraphMutationMsg(entry.msg)
    state.apply(msg)
    head = entry.id
  }

  if (head == null) {
    const headRef = storage.readRef('graph', 'head')
    if (headRef?.target?.kind === 'entry') head = headRef.target.id
  }

  function emit(msg: GraphReadMsg) {
    internalNet.send(msg)
  }

  function updateStorage(entry: Entry) {
    if (!storage.setRef({ space: 'graph', name: 'head', target: { kind: 'entry', id: entry.id } })) {
      warn('graph.service: failed to update head ref', { entry })
    }

    const checkpoint: Checkpoint = {
      space: 'graph',
      name: 'current',
      tail: entry.id,
      state: state.snapshot(),
    }

    if (!storage.setCheckpoint(checkpoint)) {
      warn('graph.service: failed to update checkpoint', { checkpoint })
    }
  }

  function persistMutation(msg: GraphMutationMsg) {
    const mutation = normalizeGraphMutationMsg(msg)
    const entry: Entry = {
      id: crypto.randomUUID(),
      space: 'graph',
      key: 'ops',
      msg: mutation,
      prev: head,
    }

    if (!storage.appendEntry(entry)) {
      throw new Error('graph.service: failed to persist graph mutation')
    }

    head = entry.id
    state.apply(mutation)
    emit(mutation)
    updateStorage(entry)
  }

  function join(): [Reader<GraphReadMsg>, Writer<GraphWriteMsg>] {
    const [reader, output] = channel<GraphReadMsg>()
    state.emitAsserts(output)
    readers.add(output)

    const writer: Writer<GraphWriteMsg> = {
      send: (...values: GraphWriteMsg[]) => {
        for (const value of values) {
          if (isGraphMutationMsg(value)) {
            persistMutation(value)
          } else if (isGraphQueryMsg(value)) {
            emit(broadcastResult(value, state))
          } else {
            throw new Error(`graph.service: invalid graph write: ${JSON.stringify(value)}`)
          }
        }
      },
      close: () => {
        readers.delete(output)
        output.close()
      },
      err: e => {
        readers.delete(output)
        output.err(e)
      },
    }

    return [reader, writer]
  }

  function isEmpty() {
    return storage.readEntries({ space: 'graph', key: 'ops', limit: 1 }).length === 0
  }

  return { join, isEmpty }
}

export function seedDefaultGraph(writer: Writer<GraphWriteMsg>) {
  const g = graph(writer)
  g.addNode('n1')
  g.position('n1', 100, 150)
  g.label('n1', 'Hello')
  g.addNode('n2')
  g.position('n2', 350, 200)
  g.label('n2', 'World')
}
