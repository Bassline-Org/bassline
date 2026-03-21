import type { AssertMsg, RetractMsg, Triple } from './schema.js'

export type GraphCheckpointState = {
  subjects: Record<string, Record<string, unknown[]>>
}

type Predicates = Map<string, Set<unknown>>

export function createGraphState() {
  const subjects = new Map<string, Predicates>()

  function ensureSubject(subject: string) {
    if (!subjects.has(subject)) subjects.set(subject, new Map())
    return subjects.get(subject)!
  }

  function assertTriple(s: string, p: string, o: unknown) {
    const preds = ensureSubject(s)
    if (!preds.has(p)) preds.set(p, new Set())
    preds.get(p)!.add(o)
  }

  function retractTriple(s: string | null, p: string | null, o: unknown) {
    if (s == null) {
      for (const [subject] of subjects) retractTriple(subject, p, o)
      return
    }

    const predicates = subjects.get(s)
    if (!predicates) return

    if (p == null) {
      subjects.delete(s)
      return
    }

    const values = predicates.get(p)
    if (!values) return

    if (o != null) {
      values.delete(o)
    } else {
      predicates.delete(p)
    }

    if (values && values.size === 0) predicates.delete(p)
    if (predicates.size === 0) subjects.delete(s)
  }

  return {
    apply(msg: AssertMsg | RetractMsg) {
      switch (msg.type) {
        case 'assert':
          assertTriple(msg.s, msg.p, msg.o)
          break
        case 'retract':
          retractTriple(msg.s, msg.p, msg.o)
          break
      }
    },

    query(s: string | null, p: string | null, o: unknown): Triple[] {
      const results: Triple[] = []
      const selectedSubjects =
        s != null ? (subjects.has(s) ? [[s, subjects.get(s)!] as const] : []) : [...subjects.entries()]

      for (const [subject, predicates] of selectedSubjects) {
        const selectedPredicates =
          p != null ? (predicates.has(p) ? [[p, predicates.get(p)!] as const] : []) : [...predicates.entries()]
        for (const [predicate, values] of selectedPredicates) {
          for (const value of values) {
            if (o != null && value !== o) continue
            results.push({ s: subject, p: predicate, o: value })
          }
        }
      }

      return results
    },

    load(state: GraphCheckpointState) {
      subjects.clear()
      for (const [subject, predicates] of Object.entries(state.subjects)) {
        const mapped = new Map<string, Set<unknown>>()
        for (const [predicate, values] of Object.entries(predicates)) {
          mapped.set(predicate, new Set(values))
        }
        subjects.set(subject, mapped)
      }
    },

    snapshot(): GraphCheckpointState {
      const snapshot: GraphCheckpointState = { subjects: {} }
      for (const [subject, predicates] of subjects) {
        snapshot.subjects[subject] = {}
        for (const [predicate, values] of predicates) {
          snapshot.subjects[subject][predicate] = [...values]
        }
      }
      return snapshot
    },

    emitAsserts(writer: { send: (msg: AssertMsg) => void }) {
      for (const [subject, predicates] of subjects) {
        for (const [predicate, values] of predicates) {
          for (const value of values) {
            writer.send({ type: 'assert', s: subject, p: predicate, o: value })
          }
        }
      }
    },
  }
}
