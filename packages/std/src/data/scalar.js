import { is, msg, failure } from '@bassline/core'

export const isScalar = m => m.conforms({ scalar: is.scalar })
export function scalar(value) {
  if (isScalar(value)) return value
  const m = msg()
  if (is.scalar(value)) return m.merge({ scalar: value })
  throw failure(`Invalid scalar: ${JSON.stringify(value)}`)
}
