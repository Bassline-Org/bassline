import type { Writer } from '@bassline/core'

export type Triple = { s: string; p: string; o: any }

export type AssertMsg = { type: 'assert'; s: string; p: string; o: any }
export type RetractMsg = { type: 'retract'; s: string | null; p: string | null; o: any }
export type QueryMsg = { type: 'query'; s: string | null; p: string | null; o: any; qid: string }
export type ResultMsg = { type: 'result'; qid: string; triples: Triple[] }
export type GraphMsg = AssertMsg | RetractMsg | QueryMsg | ResultMsg

export function graph(writer: Writer) {
  const send = (...msgs: any[]) => msgs.forEach(m => writer.send(m))

  return {
    assert: (s: string, p: string, o: any) => send({ type: 'assert', s, p, o }),

    retract: (s: string | null, p: string | null, o: any = null) => send({ type: 'retract', s, p, o }),

    query: (s: string | null, p: string | null, o: any = null) => {
      const qid = crypto.randomUUID()
      send({ type: 'query', s, p, o, qid })
      return qid
    },

    result: (qid: string, triples: Triple[]) => send({ type: 'result', qid, triples }),

    addNode: (id: string, kind = 'default') => send({ type: 'assert', s: id, p: 'kind', o: kind }),

    position: (id: string, x: number, y: number) => send({ type: 'assert', s: id, p: 'position', o: { x, y } }),

    dimensions: (id: string, w: number, h: number) => send({ type: 'assert', s: id, p: 'dimensions', o: { w, h } }),

    label: (id: string, text: string) => send({ type: 'assert', s: id, p: 'label', o: text }),

    connect: (id: string, source: string, target: string) =>
      send(
        { type: 'assert', s: id, p: 'kind', o: 'edge' },
        { type: 'assert', s: id, p: 'source', o: source },
        { type: 'assert', s: id, p: 'target', o: target }
      ),

    remove: (id: string) => send({ type: 'retract', s: id, p: null, o: null }),
  }
}
