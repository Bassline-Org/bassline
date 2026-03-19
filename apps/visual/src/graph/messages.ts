import type { Writer } from '@bassline/core'

export type Triple<O = unknown> = { s: string; p: string; o: O }
export type AssertMsg<O = unknown> = { type: 'assert'; s: string; p: string; o: O }
export type RetractMsg = { type: 'retract'; s: string | null; p: string | null; o: unknown }
export type QueryMsg = { type: 'query'; s: string | null; p: string | null; o: unknown; qid: string }
export type ResultMsg<O = unknown> = { type: 'result'; qid: string; triples: Triple<O>[] }

export function graph(writer: Writer) {
  return {
    assert: (s: string, p: string, o: unknown) => writer.send({ type: 'assert', s, p, o }),

    retract: (s: string | null, p: string | null, o: unknown = null) => writer.send({ type: 'retract', s, p, o }),

    query: (s: string | null, p: string | null, o: unknown = null) => {
      const qid = crypto.randomUUID()
      writer.send({ type: 'query', s, p, o, qid })
      return qid
    },

    result: (qid: string, triples: Triple[]) => writer.send({ type: 'result', qid, triples }),

    addNode: (id: string, kind = 'default') => writer.send({ type: 'assert', s: id, p: 'kind', o: kind }),

    position: (id: string, x: number, y: number) => writer.send({ type: 'assert', s: id, p: 'position', o: { x, y } }),

    dimensions: (id: string, w: number, h: number) =>
      writer.send({ type: 'assert', s: id, p: 'dimensions', o: { w, h } }),

    label: (id: string, text: string) => writer.send({ type: 'assert', s: id, p: 'label', o: text }),

    connect: (id: string, source: string, target: string) => {
      writer.send({ type: 'assert', s: id, p: 'kind', o: 'edge' })
      writer.send({ type: 'assert', s: id, p: 'source', o: source })
      writer.send({ type: 'assert', s: id, p: 'target', o: target })
    },

    remove: (id: string) => writer.send({ type: 'retract', s: id, p: null, o: null }),
  } as const
}
