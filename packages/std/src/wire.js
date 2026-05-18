/**
 * @import { Msg, Send } from "@bassline/core"
 */
import { is, failure, msg } from '@bassline/core'

const LOAD = 'loadMessage'

/**
 * @typedef {{ loadMessage: { data: Record<string, unknown>, caps: Record<string, string> } }} LoadShape
 */

/**
 * @typedef {(cap: Send) => string} MintId
 */

/**
 * @typedef {(id: string) => Send | undefined} ResolveId
 */

/**
 * @param {unknown} aMsg
 * @returns {aMsg is Msg<{ loadMessage: LoadShape['loadMessage'] }>}
 */
export function isLoadMsg(aMsg) {
  return is.msg(aMsg) && aMsg.has(LOAD)
}

/**
 * @param {unknown} v
 * @param {MintId} mintId
 * @returns {unknown}
 */
function moldData(v, mintId) {
  if (is.msg(v)) return mold(v, mintId)
  if (is.array(v)) return v.map(x => moldData(x, mintId))
  if (is.object(v)) {
    const out = {}
    for (const [k, x] of Object.entries(v)) out[k] = moldData(x, mintId)
    return out
  }
  return v
}

/**
 * @param {unknown} v
 * @param {ResolveId} resolveId
 * @returns {unknown}
 */
function loadData(v, resolveId) {
  if (is.msg(v)) return load(v, resolveId)
  if (is.array(v)) return v.map(x => loadData(x, resolveId))
  if (is.object(v)) {
    if (LOAD in v) return load(v, resolveId)
    const out = {}
    for (const [k, x] of Object.entries(v)) out[k] = loadData(x, resolveId)
    return out
  }
  return v
}

/**
 * Lowers a Msg to its JSON form, parking each cap via mintId.
 * @param {Msg} aMsg
 * @param {MintId} mintId
 * @returns {LoadShape}
 */
export function mold(aMsg, mintId) {
  if (!is.msg(aMsg)) throw failure('mold: expected Msg')
  if (!is.fn(mintId)) throw failure('mold: mintId must be a function')

  if (aMsg.capKeys.length === 0 && aMsg.keys.length === 1 && aMsg.has(LOAD)) {
    return /** @type {LoadShape} */ (aMsg.data)
  }

  const data = /** @type {Record<string, unknown>} */ (
    moldData(aMsg.data, mintId)
  )
  /** @type {Record<string, string>} */
  const caps = {}
  for (const spelling of aMsg.capKeys) {
    caps[String(spelling)] = mintId(aMsg.caps[spelling])
  }
  return { [LOAD]: { data, caps } }
}

/**
 * Raises a load-shape Msg (or plain object) into a Msg with live caps via resolveId.
 *
 * Idempotent: a Msg without `loadMessage` data is returned untouched.
 * Throws on scalar, array, null, or undefined input.
 * @param {Msg | object} toBind
 * @param {ResolveId} resolveId
 * @returns {Msg}
 */
export function load(toBind, resolveId) {
  if (!is.msg(toBind)) {
    if (!is.object(toBind)) throw failure('load: expected msg or object')
    return load(msg(/** @type {Record<string, unknown>} */ (toBind)), resolveId)
  }
  if (!isLoadMsg(toBind)) return toBind
  if (!is.fn(resolveId)) throw failure('load: resolveId must be a function')

  const payload = toBind.get(LOAD)
  if (!is.object(payload)) {
    throw failure('load: loadMessage payload must be an object')
  }
  const { data = {}, caps = {} } = /** @type {LoadShape['loadMessage']} */ (
    payload
  )

  const loadedData = /** @type {Record<string, unknown>} */ (
    loadData(data, resolveId)
  )
  /** @type {Record<string, Send | undefined>} */
  const loadedCaps = {}
  for (const [spelling, id] of Object.entries(caps)) {
    loadedCaps[spelling] = resolveId(id)
  }
  return toBind.delete(LOAD).merge(loadedData).grantCaps(loadedCaps)
}
