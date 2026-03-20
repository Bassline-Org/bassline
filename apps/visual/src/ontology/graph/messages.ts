import { z } from 'zod'
import { guard } from '@bassline/ontology'

// --- Schemas ---

const TripleSchema = z.object({ s: z.string(), p: z.string(), o: z.unknown() })
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
const ResultMsgSchema = z.object({ type: z.literal('result'), qid: z.string(), triples: z.array(TripleSchema) })

// --- Types ---

export type Triple = z.infer<typeof TripleSchema>
export type AssertMsg = z.infer<typeof AssertMsgSchema>
export type RetractMsg = z.infer<typeof RetractMsgSchema>
export type QueryMsg = z.infer<typeof QueryMsgSchema>
export type ResultMsg = z.infer<typeof ResultMsgSchema>

// --- Guards ---

export const isGraphAssertMsg = guard(AssertMsgSchema)
export const isGraphRetractMsg = guard(RetractMsgSchema)
export const isGraphQueryMsg = guard(QueryMsgSchema)
export const isGraphResultMsg = guard(ResultMsgSchema)

const GraphMutationMsgSchema = z.union([AssertMsgSchema, RetractMsgSchema])
export type GraphMutationMsg = AssertMsg | RetractMsg
export const isGraphMutationMsg = guard(GraphMutationMsgSchema)

const GraphWriteMsgSchema = z.union([AssertMsgSchema, RetractMsgSchema, QueryMsgSchema])
export type GraphWriteMsg = GraphMutationMsg | QueryMsg
export const isGraphWriteMsg = guard(GraphWriteMsgSchema)

// --- Protocol DSL ---

export function graph(send: (...args: any[]) => void) {
  return {
    assert: (s: string, p: string, o: unknown) => send({ type: 'assert', s, p, o }),
    retract: (s: string | null, p: string | null, o: unknown = null) => send({ type: 'retract', s, p, o }),
    query: (s: string | null, p: string | null, o: unknown = null) => {
      const qid = crypto.randomUUID()
      send({ type: 'query', s, p, o, qid })
      return qid
    },
    result: (qid: string, triples: Triple[]) => send({ type: 'result', qid, triples }),
  } as const
}
