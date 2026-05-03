import { is, invariants, Msg } from '@bassline/core'

const description = `\
I am a cache.
I allow messages with capabilities to be shared across process boundaries.
Later binding raw messages to invoke those caps.

I also perform simple "routing".
If you send to me with a {via: string} message,
I will dispatch that to a parked cap (if it exists).`

const committedDescription = ids => `\
I am a committed message.
I am storing ${ids.length} caps.
Those caps are: [
${ids.map(v => `- ${v}`).join('\n')}
]
`

export const assertMsg = invariants([[is.msg, 'expected msg']])
export const isCommit = invariants([
  [is.msg, 'expected msg'],
  [m => m.caps.size === 0, 'has caps, not a commit'],
  [m => m.has('capabilities'), 'no capability data'],
])

export function createCache() {
  const byMsg = new Map()
  const byId = new Map()
  const m = new Msg({ description })
  m.grantAll({
    send: dispatch,
    close: m.close,
  })
  const commits = () => Array.from(byMsg.values())
  const closed = () => m.ctl.closed

  m.ctl.onClose(() => {
    for (const msg of byMsg.keys()) msg.close()
    byId.clear()
    byMsg.clear()
  })

  function dispatch(aMsg) {
    const via = aMsg.get('via')
    if (!via) return aMsg
    const send = byId.get(via)
    if (!send) return aMsg
    send(aMsg.copy().delete('via'))
  }

  function toData(aMsg) {
    if (closed()) return
    assertMsg(aMsg)
    let commitment = byMsg.get(aMsg)
    if (commitment) return commitment

    const ids = []
    const capabilities = {}
    commitment = new Msg()
    byMsg.set(aMsg, commitment)
    aMsg.ctl.closes(commitment)

    for (const spelling of aMsg.caps.keys()) {
      const id = crypto.randomUUID()
      ids.push(id)
      byId.set(id, m => aMsg.invoke(spelling, m))
      capabilities[spelling] = id
    }

    commitment.ctl.onClose(() => {
      byMsg.delete(aMsg)
      ids.forEach(id => byId.delete(id))
    })

    commitment.merge({
      description: committedDescription(ids),
      capabilities,
    })

    return commitment
  }

  function fromData(aMsg, delegate = m) {
    assertMsg(aMsg)
    assertMsg(delegate)
    const caps = aMsg.get('capabilities')
    if (!caps) return aMsg
    const copy = aMsg.copy()
    aMsg.ctl.closes(copy)
    copy.delete('capabilities')
    for (const [spelling, id] of Object.entries(caps)) {
      copy.grant(spelling, m => delegate.send(m.copy({ via: id })))
    }
    return copy
  }

  const locals = { dispatch, fromData, toData, commits }
  return [m, locals]
}
