import { is, invariants, msg } from '@bassline/core'

export const assertInterval = invariants([
  [
    m => m.conforms({ min: is.number, max: is.number }),
    'invalid interval shape',
  ],
  [
    m => {
      const { min, max } = m.data
      return min <= max
    },
    'min must be <= max',
  ],
])
export const isInterval = assertInterval.test

export function interval(min, max) {
  const m = msg({ min, max })
  assertInterval(m)
  return m
}
