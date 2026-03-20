import type { AssertMsg, RetractMsg, Triple } from './messages'

export type GraphCheckpointState = {
  subjects: Record<string, Record<string, unknown>>
}

type Predicates = Map<string, unknown>

export function createGraphState() {
  const subjects = new Map<string, Predicates>()

  function ensureSubject(subject: string) {
    if (!subjects.has(subject)) subjects.set(subject, new Map())
    return subjects.get(subject)!
  }

  function assertTriple(s: string, p: string, o: unknown) {
    ensureSubject(s).set(p, o)
  }

  function retractTriple(s: string | null, p: string | null) {
    if (s == null) {
      for (const [subject] of subjects) retractTriple(subject, p)
      return
    }

    const predicates = subjects.get(s)
    if (!predicates) return

    if (p == null) {
      subjects.delete(s)
      return
    }

    predicates.delete(p)
    if (predicates.size === 0) subjects.delete(s)
  }

  return {
    apply(msg: AssertMsg | RetractMsg) {
      switch (msg.type) {
        case 'assert':
          assertTriple(msg.s, msg.p, msg.o)
          break
        case 'retract':
          retractTriple(msg.s, msg.p)
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
        for (const [predicate, value] of selectedPredicates) {
          if (o != null && value !== o) continue
          results.push({ s: subject, p: predicate, o: value })
        }
      }

      return results
    },

    load(state: GraphCheckpointState) {
      subjects.clear()
      for (const [subject, predicates] of Object.entries(state.subjects)) {
        const mapped = new Map<string, unknown>()
        for (const [predicate, value] of Object.entries(predicates)) mapped.set(predicate, value)
        subjects.set(subject, mapped)
      }
    },

    snapshot(): GraphCheckpointState {
      const snapshot: GraphCheckpointState = { subjects: {} }
      for (const [subject, predicates] of subjects) {
        snapshot.subjects[subject] = {}
        for (const [predicate, value] of predicates) snapshot.subjects[subject][predicate] = value
      }
      return snapshot
    },

    emitAsserts(writer: { send: (msg: AssertMsg) => void }) {
      for (const [subject, predicates] of subjects) {
        for (const [predicate, value] of predicates) {
          writer.send({ type: 'assert', s: subject, p: predicate, o: value })
        }
      }
    },
  }
}
