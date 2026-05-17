/**
 * @import {Recv} from "@bassline/core"
 */
import { is, failure, msg, consume } from '@bassline/core'
import { mold, load } from './wire.js'

const convDescription = `\
I am a conversation.
I park caps on outgoing messages so they can be invoked from afar via my context.
I bind caps on incoming messages so my participants can invoke them directly.
Plain (non-loadMessage) messages pass through me untouched.`

export const assertMsg = m => {
  if (!is.msg(m)) throw failure('expected msg')
  return m
}

export function context() {
  const byId = new Map()
  return { mintId, resolveId, dispatch, clear, entries }

  function mintId(capFn) {
    if (!is.fn(capFn)) throw failure('mintId: expected function')
    const id = crypto.randomUUID()
    byId.set(id, capFn)
    return id
  }

  function resolveId(anId) {
    return byId.get(anId)
  }

  function dispatch(aMsg) {
    assertMsg(aMsg)
    const via = aMsg.get('via')
    if (!via) return aMsg
    const parked = byId.get(via)
    if (!parked) return aMsg
    parked(aMsg.map(m => m.delete('via')))
  }

  function clear() {
    byId.clear()
  }

  function entries() {
    return Array.from(byId.keys())
  }
}

export function conversation(delegate, { recv, mintId, dispatch }) {
  assertMsg(delegate)

  const send = aMsg => delegate.send(msg(mold(aMsg, mintId)))
  const resolveId = id => m => send(m.copy({ via: id }))

  const [msgs, { to }] = consume(recv, (rawMsg, fwd) => {
    const aMsg = load(rawMsg, resolveId)
    const undispatched = dispatch(aMsg)
    if (undispatched) fwd(undispatched)
  })

  const conv = msg({ description: convDescription })
    .grantCaps({
      send,
      close: () => conv.close(),
    })
    .closes(msgs)

  return [conv, to]
}

/**
 * @param {[import('@bassline/core').Msg, Recv]} portLike
 */
export function dialogue([delegate, recv]) {
  const { mintId, dispatch, clear } = context()
  const [conv, onMsg] = conversation(delegate, { recv, mintId, dispatch })
  conv.closeGroup(delegate).onClose(clear)
  return [conv, onMsg]
}
