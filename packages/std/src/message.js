//@ts-check
/**
 * @import { Message } from "@bassline/core"
 */
import { is, createController } from '@bassline/core'
import { isCapable } from './data/index.js'
import { invariants, failure, conforms } from './shape.js'

const validCapName = invariants([[is.string, 'cap spelling must be a string']])
const validCapFn = invariants([[is.fn, 'cap fn must be a function']])

/** @type {(val: unknown) => val is Msg} */
const isMsg = val => val instanceof Msg

/**
 * @typedef {(m: Msg) => void} Send
 * @typedef {{send: Send, spelling: string, id: string, msg: Msg}} CacheEntry
 * @typedef {Set<CacheEntry>} Entries
 * @typedef {Record<string, Send>} CapObj
 */

export class Cache {
  /** @type {Map<Msg, Entries>} */
  byMsg = new Map()
  /** @type {Map<string, CacheEntry>} */
  byId = new Map()

  clear() {
    for (const msg of this.byMsg.keys()) {
      msg.close()
    }
    this.byId.clear()
    this.byMsg.clear()
  }

  /**
   * @param {Msg} msg
   */
  toRaw(msg) {
    if (!isMsg(msg)) throw failure('expected Msg')
    if (!this.byMsg.has(msg)) {
      this.store(msg)
    }
    const data = { ...msg.data }
    const entries = this.entriesFor(msg)

    if (entries.size === 0) return data
    /** @type {Record<string, string>} */
    const caps = {}
    for (const { spelling, id } of entries) {
      caps[spelling] = id
    }
    data.capabilities = caps
    return data
  }

  /**
   * takes a raw message and attaches capabilities
   * It's important to note that the referenced capability from the data
   * message is late bound and the underlying implementation isn't
   * "owned" by that message. Instead the message owns a closure
   * that dispatches via the cache.
   * @param {Message & {capabilities?: Record<string, string>, via?: string}} rawData
   * @param {Send | null} [delegate]
   */
  fromRaw(rawData, delegate = null) {
    const { capabilities, ...raw } = rawData
    /** @type {CapObj} */
    const caps = {}
    if (isCapable(rawData) && capabilities) {
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

  /**
   *
   * @param {Msg} msg
   * @param {Send} send
   */
  sendRaw(msg, send) {
    send(this.toRaw(msg))
    return this
  }

  /**
   *
   * @param {Msg & {data: {via: string | undefined}}} msg
   */
  dispatchVia(msg) {
    const { via } = msg.data
    if (!via) return this
    const send = this.sendFor(via)
    if (!send) return this
    const m = msg.copy().delete('via')
    send(m)
  }

  /**
   *
   * @param {string} id
   */
  sendFor(id) {
    const entry = this.byId.get(id)
    if (entry) return entry.send
  }

  /**
   * @param {unknown} value
   */
  storeFor(value) {
    if (isMsg(value)) return this.byMsg
    if (is.string(value)) return this.byId
    throw failure('invalid storeFor')
  }

  /**
   *
   * @param {Msg} msg
   * @returns {Entries}
   */
  entriesFor(msg) {
    if (!isMsg(msg)) throw failure('expected Msg')
    /** @todo Probably should change this */
    if (msg.ctl.closed) throw failure('storing closed message')
    let entries = this.byMsg.get(msg)
    if (!entries) {
      entries = new Set()
      this.byMsg.set(msg, entries)
      msg.ctl.onClose(() => {
        const entries = this.entriesFor(msg)
        for (const entry of entries) {
          this.byId.delete(entry.id)
          entries.delete(entry)
        }
        this.byMsg.delete(msg)
      })
    }
    return entries
  }

  /**
   *
   * @param {Msg} msg
   * @param {string} spelling
   * @param {Send} send
   * @returns {CacheEntry}
   */
  storeCap(msg, spelling, send) {
    if (!isMsg(msg)) throw failure('msg must be a Msg!')
    const entries = this.entriesFor(msg)
    for (const e of entries) {
      if (e.send === send && e.spelling === spelling) return e
    }
    const id = crypto.randomUUID()
    const entry = { id, send, msg, spelling }
    entries.add(entry)
    this.byId.set(entry.id, entry)
    return entry
  }

  /**
   *
   * @param {Msg} msg
   */
  store(msg) {
    if (!isMsg(msg)) throw failure('expected Msg')
    msg.store(this)
  }
}

export class Msg {
  /** @type {Record<string, unknown>} */
  data = {}
  /** @type {Map<string, Send>} */
  caps = new Map()

  constructor(data = {}, caps = {}) {
    const { ctl, close } = createController()
    this.ctl = ctl
    this.close = close
    this.merge(data)
    this.grantAll(caps)
    this.ctl.onClose(() => {
      this.caps.clear()
    })
  }

  /**
   * @param {Record<string, unknown>} [data]
   */
  copy(data = {}) {
    const msg = new Msg({ ...this.data, ...data })
    for (const [k, v] of this.caps) {
      msg.grant(k, v)
    }
    return msg
  }

  /**
   * @param {Cache} cache
   */
  store(cache) {
    for (const [spelling, fn] of this.caps) {
      cache.storeCap(this, spelling, fn)
    }
  }

  /**
   * @template {typeof this['data']} T
   * @param {T} data
   */
  merge(data) {
    /** @type { typeof this.data & T} */
    this.data = { ...this.data, ...data }
    return this
  }

  /**
   * @param {string} key
   */
  get(key) {
    return this.data[key]
  }

  /**
   * @param {string} key
   */
  delete(key) {
    delete this.data[key]
    return this
  }

  /**
   * @param {string} key
   */
  has(key) {
    return key in this.data
  }

  /**
   *
   * @param  {string[]} keys
   */
  hasKeys(keys) {
    return keys.every(k => this.has(k))
  }

  /**
   * @param {string} key
   */
  hasCap(key) {
    return this.caps.has(key)
  }

  /**
   * @param {string[]} keys
   */
  hasCaps(keys) {
    return keys.every(k => this.hasCap(k))
  }

  /**
   *
   * @param {string} spelling
   */
  revoke(spelling) {
    this.caps.delete(spelling)
    return this
  }

  /**
   *
   * @param {string} spelling
   * @param {Send} fn
   */
  grant(spelling, fn) {
    validCapName(spelling)
    validCapFn(fn)
    this.caps.set(spelling, fn)
    return this
  }

  /**
   * @param {object} obj
   */
  grantAll(obj) {
    Object.entries(obj).forEach(([k, v]) => this.grant(k, v))
    return this
  }

  /**
   *
   * @param {string} spelling
   * @param {Message | Msg} arg
   */
  invoke(spelling, arg) {
    validCapName(spelling)
    const cap = this.caps.get(spelling)
    if (cap) {
      const m = msg(arg)
      cap(m)
    }
    return this
  }

  /**
   *
   * @param {unknown} description
   */
  conforms(description) {
    return conforms(description)(this.data)
  }
}

/**
 *
 * @param {Message | Msg} data
 * @param {object} caps
 * @returns {Msg}
 */
export function msg(data = {}, caps = {}) {
  if (isMsg(data)) return data.grantAll(caps)
  return new Msg(data, caps)
}
