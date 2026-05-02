import { is, Msg, failure } from '@bassline/core'

export class Cache {
  byMsg = new Map()
  byId = new Map()

  clear() {
    for (const msg of this.byMsg.keys()) {
      msg.close()
    }
    this.byId.clear()
    this.byMsg.clear()
  }

  toRaw(msg) {
    if (!is.msg(msg)) throw failure('expected Msg')
    if (!this.byMsg.has(msg)) {
      this.store(msg)
    }
    const data = { ...msg.data }
    const entries = this.entriesFor(msg)

    if (entries.size === 0) return data
    const caps = {}
    for (const { spelling, id } of entries) {
      caps[spelling] = id
    }
    data.capabilities = caps
    return data
  }

  /*
   * takes a raw message and attaches capabilities
   * It's important to note that the referenced capability from the data
   * message is late bound and the underlying implementation isn't
   * "owned" by that message. Instead the message owns a closure
   * that dispatches via the cache.
   */
  fromRaw(rawData, delegate = null) {
    const { capabilities, ...raw } = rawData
    const caps = {}
    if (capabilities) {
      for (const [spelling, id] of Object.entries(capabilities)) {
        caps[spelling] = msg => {
          const m = msg.copy({ via: id })
          if (delegate) delegate(m)
          else this.dispatchVia(m)
        }
      }
    }
    const m = new Msg(raw, caps)
    this.store(m)
    return m
  }

  sendRaw(msg, send) {
    send(this.toRaw(msg))
    return this
  }

  dispatchVia(msg) {
    const { via } = msg.data
    if (!via) return this
    const send = this.sendFor(via)
    if (!send) return this
    const m = msg.copy().delete('via')
    send(m)
  }

  sendFor(id) {
    const entry = this.byId.get(id)
    if (entry) return entry.send
  }

  storeFor(value) {
    if (is.msg(value)) return this.byMsg
    if (is.string(value)) return this.byId
    throw failure('invalid storeFor')
  }

  entriesFor(msg) {
    if (!is.msg(msg)) throw failure('expected Msg')
    let entries = this.byMsg.get(msg)
    if (entries) return entries
    if (!entries && msg.ctl.closed) return
    entries = new Set()
    this.byMsg.set(msg, entries)
    msg.ctl.onClose(() => {
      const entries = this.entriesFor(msg)
      if (!entries) return
      for (const entry of entries) {
        this.byId.delete(entry.id)
        entries.delete(entry)
      }
      this.byMsg.delete(msg)
    })
    return entries
  }

  storeCap(msg, spelling, send) {
    if (!is.msg(msg)) throw failure('msg must be a Msg!')
    const entries = this.entriesFor(msg)
    if (!entries) return
    for (const e of entries) {
      if (e.send === send && e.spelling === spelling) return e
    }
    const id = crypto.randomUUID()
    const entry = { id, send, msg, spelling }
    entries.add(entry)
    this.byId.set(entry.id, entry)
    return entry
  }

  store(msg) {
    if (!is.msg(msg)) throw failure('expected Msg')
    msg.store(this)
  }
}
