import type { Triple } from './schema.js'

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
