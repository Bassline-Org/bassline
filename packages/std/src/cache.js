/**
 * @import {Send, Recv} from "@bassline/core"
 */
import { is, invariants, Msg, propagator, consume } from '@bassline/core'

const description = `\
I am a cache.
I allow messages with capabilities to be shared across process boundaries.
Later binding raw messages to invoke those caps.

I also perform simple "routing".
If you send to me with a {via: string} message,
I will dispatch that to a parked cap (if it exists).`

/**
 *
 * @param {string[]} ids
 * @returns {string}
 */
const entryDescription = ids => `\
I am a cached message.
I am storing ${ids.length} caps.
Those caps are: [
${ids.map(v => `- ${v}`).join('\n')}
]
`
const convDescription = `\
I am a conversation.
I allow for easy sharing of messages & caps.
Messages sent to me will be cached and shared.
I will automatically route incoming messages to their caps.
I only propagate messages that weren't routed to caps.
`
export const assertMsg = invariants([[is.msg, 'expected msg']])
export const isCommit = invariants([
  [is.msg, 'expected msg'],
  [m => m.caps.size === 0, 'has caps, not a commit'],
  [m => m.has('capabilities'), 'no capability data'],
])

/**
 *
 * @returns {[
 * Msg<{description: string}, {send: Send}>,
 * {
 * onMsg: (...dests: Send<unknown>[]) => () => void
 * dispatch: (aMsg: Msg) => Msg | undefined
 * toData: (aMsg: Msg) => Msg | undefined
 * entries: () => Msg[]
 * }
 * ]}
 */
export function createCache() {
  const byMsg = new Map()
  const byId = new Map()
  const entries = () => Array.from(byMsg.values())

  const [cache, onMsg] = propagator((aMsg, fwd) => {
    const result = dispatch(aMsg)
    if (result) fwd(result)
  })
  cache.merge({ description })

  const closed = () => cache.ctl.closed

  cache.ctl.onClose(() => {
    for (const msg of byMsg.keys()) msg.close()
    byId.clear()
    byMsg.clear()
  })

  /**
   *
   * @param {Msg} aMsg
   * @returns {Msg | undefined}
   */
  function dispatch(aMsg) {
    const via = aMsg.get('via')
    if (!via) return aMsg
    const parked = byId.get(via)
    if (!parked) return aMsg
    const withoutVia = aMsg.map(m => m.delete('via'))
    parked(withoutVia)
  }

  /**
   *
   * @param {Msg} aMsg
   * @returns {Msg | undefined}
   */
  function toData(aMsg) {
    if (closed()) return
    assertMsg(aMsg)
    let cached = byMsg.get(aMsg)
    if (cached) return cached

    const ids = []
    const capabilities = {}
    cached = new Msg()
    byMsg.set(aMsg, cached)
    aMsg.closes(cached)

    for (const spelling of aMsg.caps.keys()) {
      const id = crypto.randomUUID()
      ids.push(id)
      byId.set(id, m => aMsg.invoke(spelling, m))
      capabilities[spelling] = id
    }

    cached.ctl.onClose(() => {
      byMsg.delete(aMsg)
      ids.forEach(id => byId.delete(id))
    })

    cached.merge({
      description: entryDescription(ids),
      capabilities,
    })

    return cached
  }

  const locals = { onMsg, dispatch, toData, entries }
  return [cache, locals]
}

/**
 *
 * @param {Msg} aMsg
 * @param {Msg} delegate
 * @returns {Msg}
 */
export function bindRawCaps(aMsg, delegate) {
  assertMsg(aMsg)
  assertMsg(delegate)
  const caps = aMsg.get('capabilities')
  if (!caps) return aMsg
  return aMsg.map(copy => {
    aMsg.closes(copy)
    delegate.closes(copy)
    copy.delete('capabilities')
    for (const [spelling, id] of Object.entries(caps)) {
      copy.grant(spelling, msg => delegate.send(msg.copy({ via: id })))
    }
    return copy
  })
}

export function conversation(delegate, { recv, toData, dispatch }) {
  const [msgs, { to: onMsg }] = consume(recv, (aMsg, send) => {
    const r = bindRawCaps(aMsg, delegate).do(dispatch)
    if (r) send(r)
  })
  const conv = new Msg({ description: convDescription })
  conv.grantAll({
    send: aMsg => {
      const raw = toData(aMsg)
      delegate.send(raw)
    },
    close: conv.close,
  })
  conv.closes(msgs)
  return [conv, onMsg]
}

/**
 *
 * @param {[Msg, Recv]} portLike
 */
export function dialogue([delegate, recv]) {
  const [cache, { toData, dispatch }] = createCache()
  const [conv, onMsg] = conversation(delegate, { recv, toData, dispatch })
  conv.closes(cache, delegate)
  delegate.closes(conv)
  return [conv, onMsg]
}
