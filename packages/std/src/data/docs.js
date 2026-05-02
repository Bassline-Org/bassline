import { is, msg, invariants } from '@bassline/core'

export const assertDocs = invariants([
  [m => m.conforms({ docs: is.string }), 'invalid docs'],
])
export const isDocumented = assertDocs.test

export function docs(desc) {
  const m = msg({ docs: desc })
  assertDocs(m)
  return m
}
