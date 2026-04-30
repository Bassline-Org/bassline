import { is } from '@bassline/core'
import { failure, conforms, isScalarType } from '../shape.js'

export const isCollection = conforms({ items: is.array })
export function collection(value) {
  const fmt = items => ({ items })
  if (isCollection(value)) return value

  if (is.array(value)) return fmt(value)
  if (isScalarType(value)) throw failure('expected non scalar type')

  if (conforms({ [Symbol.iterator]: is.fn })(value)) {
    return fmt(Array.from(value))
  }
  throw failure('invalid collection type')
}
