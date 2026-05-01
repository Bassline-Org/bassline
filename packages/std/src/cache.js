import { createController, is, consume } from '@bassline/core'
import { leaf } from './ns.js'
import { invariants, symbolEntries } from './shape.js'
import { createCap } from './caps.js'
import { isVia, isCapable } from './data/index.js'

const assertValidSend = invariants([[is.fn, 'send must be a function']])

export function capCache({ createId = () => crypto.randomUUID() } = {}) {
  const { ctl, close } = createController()
  const byId = new Map()
  const bySend = new Map()

  const storeFor = value => (is.fn(value) ? bySend : byId)
  const get = value => storeFor(value).get(value)
  const has = value => storeFor(value).has(value)
  const revoke = value => {
    const entry = get(value)
    if (entry) entry.close()
  }

  const assertValidId = invariants([
    [is.string, 'id must be a string'],
    [id => !has(id), 'id already parked'],
  ])

  function park(send, id = createId()) {
    assertValidSend(send)
    if (has(send)) return get(send)
    assertValidId(id)

    const entry = { id, ...leaf(send) }
    byId.set(id, entry)
    bySend.set(send, entry)

    entry.ctl.onClose(() => {
      byId.delete(id)
      bySend.delete(send)
    })

    ctl.closes(entry)
    return entry
  }

  return {
    ctl,
    close,
    park: ctl.fn(park),
    get: ctl.fn(get),
    has: ctl.fn(has),
    revoke: ctl.fn(revoke),
  }
}

export function reify(cache, msg, opts = {}) {
  const { strip = true } = opts
  const m = { ...msg }
  for (const [sym, val] of symbolEntries(msg)) {
    if (!is.fn(val)) continue
    const spelling = Symbol.keyFor(sym) ?? sym.description
    if (!spelling) continue
    m.capabilities ??= {}
    const entry = cache.park(val)
    m.capabilities[spelling] = entry.id
    if (strip) delete m[sym]
  }
  return m
}

export function bind(cache, send, msg) {
  if (!isCapable(msg)) return msg
  const { capabilities, ...m } = msg
  let out = m

  for (const [spelling, id] of Object.entries(capabilities)) {
    const cap = createCap(spelling)

    let entry = cache.get(id)
    if (!entry) {
      entry = cache.park(arg => send({ ...arg, via: id }), id)
    }

    out = cap.grant(out, entry.send)
  }

  return out
}

export function dispatchVia(cache, msg) {
  if (!isVia(msg)) return false
  const { via, ...m } = msg
  const entry = cache.get(via)
  if (!entry) return false
  entry.send(m)
  return true
}

export function session(sendRaw, opts = {}) {
  const { ctl, close } = createController()
  const local = capCache(opts.local)
  const remote = capCache(opts.remote)
  ctl.closes(local, remote)

  // these are "outgoing" fns
  // lower lets us go from closure caps to data
  // send allows us to send the data-ified fversion outwards
  const lower = ctl.fn((msg, opts) => reify(local, msg, opts))
  const send = ctl.fn(msg => sendRaw(lower(msg)))
  // these are "incoming" fns
  // lift takes a data message and "lifts" to closure caps
  // dispatch allows us to handle cap invocations by the "via" key
  // otherwise returning a lifted message
  const lift = ctl.fn(msg => bind(remote, send, msg))
  const dispatch = ctl.fn(msg => {
    const lifted = lift(msg)
    return dispatchVia(local, lifted) ? undefined : lifted
  })
  return { lower, lift, send, dispatch, ctl, close }
}

export function sessionConnect({ send, recv }, callback) {
  const sesh = session(send)
  const { to, promise, ctl, close } = consume(recv, (msg, p) => {
    const m = sesh.dispatch(msg)
    if (m) p(m)
  })
  const cleanup = to(callback)
  ctl.closes(sesh)
  ctl.onClose(cleanup)
  return { to, promise, ctl, close, send: sesh.send }
}
