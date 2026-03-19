import { isPlainObject } from '@bassline/core'
import type { AssertMsg, QueryMsg, ResultMsg, RetractMsg } from './messages'

export type GraphMutationMsg = AssertMsg | RetractMsg
export type GraphWriteMsg = GraphMutationMsg | QueryMsg
export type GraphReadMsg = GraphMutationMsg | ResultMsg

export function isGraphAssertMsg(value: unknown): value is AssertMsg {
  return (
    isPlainObject(value) &&
    value.type === 'assert' &&
    typeof value.s === 'string' &&
    typeof value.p === 'string' &&
    'o' in value
  )
}

export function isGraphRetractMsg(value: unknown): value is RetractMsg {
  return (
    isPlainObject(value) &&
    value.type === 'retract' &&
    (typeof value.s === 'string' || value.s === null) &&
    (typeof value.p === 'string' || value.p === null) &&
    'o' in value
  )
}

export function isGraphQueryMsg(value: unknown): value is QueryMsg {
  return (
    isPlainObject(value) &&
    value.type === 'query' &&
    (typeof value.s === 'string' || value.s === null) &&
    (typeof value.p === 'string' || value.p === null) &&
    typeof value.qid === 'string' &&
    'o' in value
  )
}

export function isGraphResultMsg(value: unknown): value is ResultMsg {
  return (
    isPlainObject(value) && value.type === 'result' && typeof value.qid === 'string' && Array.isArray(value.triples)
  )
}

export function isGraphMutationMsg(value: unknown): value is GraphMutationMsg {
  return isGraphAssertMsg(value) || isGraphRetractMsg(value)
}

export function isGraphReadMsg(value: unknown): value is GraphReadMsg {
  return isGraphAssertMsg(value) || isGraphRetractMsg(value) || isGraphResultMsg(value)
}

export function normalizeAssertMsg(msg: AssertMsg): AssertMsg {
  return { type: 'assert', s: msg.s, p: msg.p, o: msg.o }
}

export function normalizeRetractMsg(msg: RetractMsg): RetractMsg {
  return { type: 'retract', s: msg.s, p: msg.p, o: msg.o }
}

export function normalizeQueryMsg(msg: QueryMsg): QueryMsg {
  return { type: 'query', s: msg.s, p: msg.p, o: msg.o, qid: msg.qid }
}

export function normalizeGraphMutationMsg(msg: GraphMutationMsg): GraphMutationMsg {
  return msg.type === 'assert' ? normalizeAssertMsg(msg) : normalizeRetractMsg(msg)
}

export function cloneGraphReadMsg(msg: GraphReadMsg): GraphReadMsg {
  switch (msg.type) {
    case 'assert':
      return normalizeAssertMsg(msg)
    case 'retract':
      return normalizeRetractMsg(msg)
    case 'result':
      return {
        type: 'result',
        qid: msg.qid,
        triples: msg.triples.map(triple => ({ s: triple.s, p: triple.p, o: triple.o })),
      }
  }
}
