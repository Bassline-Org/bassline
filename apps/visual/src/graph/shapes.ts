import { z } from 'zod'
import type { AssertMsg, QueryMsg, ResultMsg, RetractMsg } from './messages'
import { guard } from '../storage/messages'

const AssertMsgSchema = z.object({ type: z.literal('assert'), s: z.string(), p: z.string(), o: z.unknown() })
const RetractMsgSchema = z.object({
  type: z.literal('retract'),
  s: z.string().nullable(),
  p: z.string().nullable(),
  o: z.unknown(),
})
const QueryMsgSchema = z.object({
  type: z.literal('query'),
  s: z.string().nullable(),
  p: z.string().nullable(),
  o: z.unknown(),
  qid: z.string(),
})
const ResultMsgSchema = z.object({
  type: z.literal('result'),
  qid: z.string(),
  triples: z.array(z.object({ s: z.string(), p: z.string(), o: z.unknown() })),
})

export const isGraphAssertMsg = guard<AssertMsg>(AssertMsgSchema as z.ZodType<AssertMsg>)
export const isGraphRetractMsg = guard<RetractMsg>(RetractMsgSchema as z.ZodType<RetractMsg>)
export const isGraphQueryMsg = guard<QueryMsg>(QueryMsgSchema as z.ZodType<QueryMsg>)
export const isGraphResultMsg = guard<ResultMsg>(ResultMsgSchema as z.ZodType<ResultMsg>)

const GraphMutationMsgSchema = z.union([AssertMsgSchema, RetractMsgSchema])
export type GraphMutationMsg = AssertMsg | RetractMsg
export const isGraphMutationMsg = guard<GraphMutationMsg>(GraphMutationMsgSchema as z.ZodType<GraphMutationMsg>)

const GraphWriteMsgSchema = z.union([AssertMsgSchema, RetractMsgSchema, QueryMsgSchema])
export type GraphWriteMsg = GraphMutationMsg | QueryMsg
export const isGraphWriteMsg = guard<GraphWriteMsg>(GraphWriteMsgSchema as z.ZodType<GraphWriteMsg>)
