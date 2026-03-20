export type Triple<O = unknown> = { s: string; p: string; o: O }
export type AssertMsg<O = unknown> = { type: 'assert'; s: string; p: string; o: O }
export type RetractMsg = { type: 'retract'; s: string | null; p: string | null; o: unknown }
export type QueryMsg = { type: 'query'; s: string | null; p: string | null; o: unknown; qid: string }
export type ResultMsg<O = unknown> = { type: 'result'; qid: string; triples: Triple<O>[] }

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

    addNode: (id: string, kind = 'default') => send({ type: 'assert', s: id, p: 'kind', o: kind }),

    position: (id: string, x: number, y: number) => send({ type: 'assert', s: id, p: 'position', o: { x, y } }),

    dimensions: (id: string, w: number, h: number) => send({ type: 'assert', s: id, p: 'dimensions', o: { w, h } }),

    label: (id: string, text: string) => send({ type: 'assert', s: id, p: 'label', o: text }),

    connect: (id: string, source: string, target: string) => {
      send({ type: 'assert', s: id, p: 'kind', o: 'edge' })
      send({ type: 'assert', s: id, p: 'source', o: source })
      send({ type: 'assert', s: id, p: 'target', o: target })
    },

    remove: (id: string) => send({ type: 'retract', s: id, p: null, o: null }),
  } as const
}
