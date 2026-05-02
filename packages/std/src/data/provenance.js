import { is } from '@bassline/core'

export const isSourced = m =>
  m.conforms({
    source: is.string,
  })
