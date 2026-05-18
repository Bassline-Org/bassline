/**
 * @import { Msg, Recv, Send, Fwd, PortLike } from "@bassline/core"
 * @import { MintId, ResolveId } from "./wire.js"
 */
import { is, failure, msg, consume } from '@bassline/core'
import { mold, load } from './wire.js'

/**
 * @typedef {{
 *   mintId: MintId,
 *   resolveId: ResolveId,
 *   dispatch: (m: Msg) => Msg | undefined,
 *   clear: () => void,
 *   entries: () => string[],
 * }} Context
 */

/**
 * @typedef {PortLike<{ send: Send, close: () => void }>} ConversationMsg
 */

const convDescription = `\
I am a conversation.
I park caps on outgoing messages so they can be invoked from afar via my context.
I bind caps on incoming messages so my participants can invoke them directly.
Plain (non-loadMessage) messages pass through me untouched.`

/**
 * @param {unknown} m
 * @returns {Msg}
 */
export const assertMsg = m => {
  if (!is.msg(m)) throw failure('expected msg')
  return m
}

/**
 * A registry that brokers between runtime cap closures and wire ids.
 * @returns {Context}
 */
export function context() {
  /** @type {Map<string, Send>} */
  const byId = new Map()
  return { mintId, resolveId, dispatch, clear, entries }

  /** @type {MintId} */
  function mintId(capFn) {
    if (!is.fn(capFn)) throw failure('mintId: expected function')
    const id = crypto.randomUUID()
    byId.set(id, capFn)
    return id
  }

  /** @type {ResolveId} */
  function resolveId(anId) {
    return byId.get(anId)
  }

  /**
   * @param {Msg} aMsg
   * @returns {Msg | undefined}
   */
  function dispatch(aMsg) {
    assertMsg(aMsg)
    const via = aMsg.get('via')
    if (!via) return aMsg
    const parked = byId.get(/** @type {string} */ (via))
    if (!parked) return aMsg
    parked(aMsg.map(m => m.delete('via')))
  }

  function clear() {
    byId.clear()
  }

  /** @returns {string[]} */
  function entries() {
    return Array.from(byId.keys())
  }
}

/**
 * Wires a delegate Msg + Recv into a participant surface that molds outgoing
 * messages and loads + dispatches incoming ones via the supplied context.
 * @param {Msg} delegate
 * @param {{ recv: Recv, mintId: MintId, dispatch: (m: Msg) => Msg | undefined }} opts
 * @returns {[ConversationMsg, Fwd]}
 */
export function conversation(delegate, { recv, mintId, dispatch }) {
  assertMsg(delegate)

  /** @type {Send} */
  const send = aMsg => delegate.send(msg(mold(aMsg, mintId)))
  /** @type {ResolveId} */
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
 * Two-party convenience: creates a fresh context, wires a conversation, and
 * cascades close in both directions.
 * @param {[Msg, Recv]} portLike
 * @returns {[ConversationMsg, Fwd]}
 */
export function dialogue([delegate, recv]) {
  const { mintId, dispatch, clear } = context()
  const [conv, onMsg] = conversation(delegate, { recv, mintId, dispatch })
  conv.closeGroup(delegate).onClose(clear)
  return [conv, onMsg]
}
