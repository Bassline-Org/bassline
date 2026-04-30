import { is } from '@bassline/core'
import { conforms, ensure } from '../shape.js'

// ==== capabilities as data ====
export const isCapable = conforms({
  capabilities: ensure([is.object, v => Object.values(v).every(is.string)]),
})
// ==== invoking a cap ====
export const isVia = conforms({ via: is.string })
