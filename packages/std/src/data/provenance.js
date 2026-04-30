import { is } from '@bassline/core'
import { conforms } from '../shape.js'

export const isSourced = conforms({
  source: is.string,
})
