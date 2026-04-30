import { isScalarType, conforms, failure } from '../shape.js'

export const isScalar = conforms({ scalar: isScalarType })
export function scalar(value) {
  const fmt = val => ({ scalar: val })

  if (isScalar(value)) return value
  if (isScalarType(value)) return fmt(value)
  throw failure(`Invalid scalar: ${JSON.stringify(value)}`)
}
