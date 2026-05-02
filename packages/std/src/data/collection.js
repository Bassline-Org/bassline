import { is, failure, msg, conforms } from '@bassline/core'

export const isCollection = m => m.conforms({ items: is.array })
export function collection(value) {
  const m = msg()
  if (isCollection(value)) return value

  if (is.array(value)) return m.merge({ items: value })
  if (is.scalar(value)) throw failure('expected non scalar type')

  if (conforms({ [Symbol.iterator]: is.fn })(value)) {
    return m.merge({ items: Array.from(value) })
  }
  throw failure('invalid collection type')
}
