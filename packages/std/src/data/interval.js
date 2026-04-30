import { is } from '@bassline/core'
import { invariants, conforms } from '../shape.js'

export const assertInterval = invariants([
  [conforms({ min: is.number, max: is.number }), 'invalid interval shape'],
  [({ min, max }) => min <= max, 'min must be <= max'],
])
export const isInterval = assertInterval.test

export function interval(min, max) {
  const m = { min, max }
  assertInterval(m)
  return m
}
