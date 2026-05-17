import { is, failure, msg } from '@bassline/core'

const LOAD = 'loadMessage'

export function isLoadMsg(aMsg) {
  return is.msg(aMsg) && aMsg.has(LOAD)
}

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

export function mold(aMsg, mintId) {
  if (!is.msg(aMsg)) throw failure('mold: expected Msg')
  if (!is.fn(mintId)) throw failure('mold: mintId must be a function')

  if (aMsg.capKeys.length === 0 && aMsg.keys.length === 1 && aMsg.has(LOAD)) {
    return aMsg.data
  }

  const data = moldData(aMsg.data, mintId)
  const caps = {}
  for (const spelling of aMsg.capKeys) {
    caps[spelling] = mintId(aMsg.caps[spelling])
  }
  return { [LOAD]: { data, caps } }
}

export function load(toBind, resolveId) {
  if (!is.msg(toBind)) {
    if (!is.object(toBind)) throw failure('load: expected msg or object')
    return load(msg(toBind), resolveId)
  }
  if (!isLoadMsg(toBind)) return toBind
  if (!is.fn(resolveId)) throw failure('load: resolveId must be a function')

  const payload = toBind.get(LOAD)
  if (!is.object(payload)) {
    throw failure('load: loadMessage payload must be an object')
  }
  const { data = {}, caps = {} } = payload

  const loadedData = loadData(data, resolveId)
  const loadedCaps = {}
  for (const [spelling, id] of Object.entries(caps)) {
    loadedCaps[spelling] = resolveId(id)
  }
  return toBind.delete(LOAD).merge(loadedData).grantCaps(loadedCaps)
}
