import { hasKeys, isString, isNull, isArray } from '@bassline/core'
import type { AssertMsg, QueryMsg, ResultMsg, RetractMsg } from './messages'
import { hasType } from '@/utils'

export type GraphMutationMsg = AssertMsg | RetractMsg
export type GraphWriteMsg = GraphMutationMsg | QueryMsg
export type GraphReadMsg = GraphMutationMsg | ResultMsg

function isTriple(value: unknown): value is { s: string; p: string; o: unknown } {
  return hasKeys(value, ['s', 'p', 'o']) && isString(value.s) && isString(value.p)
}

export function isGraphAssertMsg(value: unknown): value is AssertMsg {
  return isTriple(value) && hasType(value, 'assert')
}

export function isGraphRetractMsg(value: unknown): value is RetractMsg {
  return isTriple(value) && hasType(value, 'retract')
}

export function isGraphQueryMsg(value: unknown): value is QueryMsg {
  const isQuerySp = (v: unknown) => isString(v) || isNull(v)
  return (
    hasType(value, 'query') &&
    hasKeys(value, ['qid', 's', 'p', 'o']) &&
    isString(value.qid) &&
    isQuerySp(value.s) &&
    isQuerySp(value.p)
  )
}
export function isGraphResultMsg(value: unknown): value is ResultMsg {
  return hasType(value, 'result') && hasKeys(value, ['qid', 'triples']) && isString(value.qid) && isArray(value.triples)
}

export const isGraphMutationMsg = (value: unknown) => isGraphAssertMsg(value) || isGraphRetractMsg(value)
export const isGraphWriteMsg = (value: unknown) => isGraphMutationMsg(value) || isGraphQueryMsg(value)
export const isGraphReadMsg = (value: unknown) =>
  isGraphAssertMsg(value) || isGraphRetractMsg(value) || isGraphResultMsg(value)
