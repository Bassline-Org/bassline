/** @import { IsShaped } from "./types" */
import { is } from '@bassline/core'
import { conforms, ensure } from '../shape.js'

// ==== capabilities as data ====
/**
 * @type {IsShaped<{capabilities: Record<string, string>}>}
 */
export const isCapable = conforms({
  capabilities: ensure([is.object, v => Object.values(v).every(is.string)]),
})
// ==== invoking a cap ====
/**
 * @type {IsShaped<{via: string}>}
 */
export const isVia = conforms({ via: is.string })
