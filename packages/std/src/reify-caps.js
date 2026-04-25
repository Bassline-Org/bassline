import { createController, is } from '@bassline/core'
import { isCapable, isVia } from './data.js'
import { enrich, createCap } from './caps.js'
import { entries, symbolEntries } from './shape.js'
/**
 * @import { Send, Ctl, Close } from "@bassline/core"
 */

/**
 * @param {{send: Send, ctl: Ctl}} outgoing
 */
export function cacheCaps(outgoing) {
  const { ctl, close } = createController()
  outgoing.ctl.closes({ close })
  const byId = new Map()
  const caps = new Map()
  const getCap = spelling => {
    if (!caps.has(spelling)) {
      caps.set(spelling, createCap(spelling))
    }

    return caps.get(spelling)
  }

  const revoke = ctl.fn(id => {
    if (byId.has(id)) {
      const entry = byId.get(id)
      entry?.close?.()
    }
  })

  const bind = ctl.fn(msg => {
    if (!isCapable(msg)) return msg
    const { capabilities, ...m } = msg
    const enrichments = []
    for (const [name, id] of entries(capabilities)) {
      // we store the caps by cap id, not by name
      if (byId.has(id)) {
        const entry = byId.get(id)
        enrichments.push([entry.cap, entry.fn])
        continue
      }
      const capControl = createController()
      const entry = {
        cap: getCap(name),
        fn: capControl.ctl.fn(m => outgoing.send({ ...m, via: id })),
        ctl: capControl.ctl,
        close: capControl.close,
      }
      ctl.closes(entry)
      entry.ctl.onClose(() => byId.delete(id))
      enrichments.push([entry.cap, entry.fn])
    }
    return enrich(m, enrichments)
  })
  return { ctl, close, bind, revoke }
}

export function routeCaps() {
  const { ctl, close } = createController()
  const bySend = new Map()
  const byId = new Map()

  /**
   *
   * @param {Send} send
   * @returns {{id: string, ctl: Ctl, close: Close, send: Send}}
   */
  function park(send) {
    if (bySend.has(send)) return bySend.get(send)
    const c = createController()
    const id = crypto.randomUUID()
    const entry = { id, send, ctl: c.ctl, close: c.close }
    bySend.set(send, entry)
    byId.set(id, entry)
    const cleanup = () => {
      bySend.delete(send)
      byId.delete(id)
    }
    c.ctl.onClose(cleanup)
    ctl.onClose(cleanup)
    return entry
  }

  function reify(msg, strip = true) {
    const m = { ...msg }
    for (const [sym, val] of symbolEntries(msg)) {
      if (is.symbol(sym) && is.fn(val)) {
        m.capabilities ??= {}
        const entry = park(val)
        m.capabilities[sym.description] = entry.id
        if (strip) delete m[sym]
      }
    }
    return m
  }

  function dispatch(msg) {
    if (!isVia(msg)) return
    const { via, ...m } = msg
    if (!byId.has(via)) return
    const entry = byId.get(via)
    entry.send(m)
  }

  const revoke = ctl.fn(id => {
    if (byId.has(id)) {
      byId.get(id)?.close()
    }
  })

  return {
    ctl,
    close,
    park: ctl.fn(park),
    reify: ctl.fn(reify),
    revoke: ctl.fn(revoke),
    dispatch: ctl.fn(dispatch),
  }
}
