import { invariants, conforms } from '../shape.js'

export const isUri = conforms({ href: v => URL.canParse(v) })
export const assertUri = invariants([[isUri, 'cannot parse href']])
export function uri(href) {
  if (isUri(href)) return href

  const m = { href }
  assertUri(m)
  return m
}
