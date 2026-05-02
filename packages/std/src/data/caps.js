import { is, satisfiesAll } from '@bassline/core'

export const isCapable = msg =>
  msg.conforms({
    capabilities: satisfiesAll([
      is.object,
      v => Object.values(v).every(is.string),
    ]),
  })

export const isVia = msg => msg.conforms({ via: is.string })
