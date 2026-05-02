import { invariants, msg } from '../shape.js'

export const isUri = m => m.conforms({ href: v => URL.canParse(v) })
export const assertUri = invariants([[isUri, 'cannot parse href']])
export function uri(href) {
  if (isUri(href)) return href
  const m = msg({ href })
  assertUri(m)
  return m
}
