import type { Reader, Writer } from '@bassline/core'
import { graph } from './messages'
import type { GraphMsg } from './messages'

export function store([reader, writer]: [Reader<GraphMsg>, Writer]) {
  const g = graph(writer)
  const spo = new Map<string, Map<string, any>>()

  function assertTriple(s: string, p: string, o: any) {
    if (!spo.has(s)) spo.set(s, new Map())
    spo.get(s)!.set(p, o)
  }

  function retractTriple(s: string | null, p: string | null, _o: any) {
    if (s == null) {
      for (const [subj] of spo) retractTriple(subj, p, _o)
      return
    }
    if (!spo.has(s)) return
    const preds = spo.get(s)!
    if (p == null) {
      spo.delete(s)
    } else {
      preds.delete(p)
      if (preds.size === 0) spo.delete(s)
    }
  }

  function queryTriples(s: string | null, p: string | null, o: any) {
    const results: { s: string; p: string; o: any }[] = []
    const subjects = s != null ? (spo.has(s) ? [[s, spo.get(s)!] as const] : []) : [...spo.entries()]
    for (const [subj, preds] of subjects) {
      const predicates = p != null ? (preds.has(p) ? [[p, preds.get(p)!] as const] : []) : [...preds.entries()]
      for (const [pred, val] of predicates) {
        if (o != null && val !== o) continue
        results.push({ s: subj, p: pred, o: val })
      }
    }
    return results
  }

  reader.sink((msg: GraphMsg) => {
    switch (msg.type) {
      case 'assert':
        assertTriple(msg.s, msg.p, msg.o)
        break
      case 'retract':
        if (msg.s != null) retractTriple(msg.s, msg.p, msg.o)
        else retractTriple(null, msg.p, msg.o)
        break
      case 'query':
        g.result(msg.qid, queryTriples(msg.s, msg.p, msg.o))
        break
    }
  })
}
