import { is } from '@bassline/core'
import { conforms, invariants } from '../shape.js'

export const assertDocs = invariants([
  [conforms({ docs: is.string }), 'invalid docs'],
])
export const isDocumented = assertDocs.test

export function docs(desc) {
  const m = { docs: desc }
  assertDocs(m)
  return m
}
