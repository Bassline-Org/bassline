import { Garage } from './garage.js'

const kResource = Symbol.for('bassline.resource')

/**
 * @typedef {{
 *   send: (msg: unknown) => void,
 *   onMessage: (cb: (msg: unknown) => void) => void,
 *   close: () => void,
 *   onClose: (cb: () => void) => void
 * }} Transport
 */

/**
 * Create an in-memory transport pair for testing.
 * Returns two symmetric endpoints: messages sent on one arrive on the other.
 * Close propagates to both ends. Send-after-close throws.
 *
 * @returns {{ a: Transport, b: Transport }}
 */
export function memoryTransport() {
  let closed = false
  const a = {
    _handler: null,
    _closeHandlers: [],
    send(msg) {
      if (closed) throw new Error('transport closed')
      b._handler?.(msg)
    },
    onMessage(cb) { this._handler = cb },
    close() {
      if (closed) return
      closed = true
      for (const cb of a._closeHandlers) cb()
      for (const cb of b._closeHandlers) cb()
    },
    onClose(cb) { this._closeHandlers.push(cb) },
  }
  const b = {
    _handler: null,
    _closeHandlers: [],
    send(msg) {
      if (closed) throw new Error('transport closed')
      a._handler?.(msg)
    },
    onMessage(cb) { this._handler = cb },
    close() {
      if (closed) return
      closed = true
      for (const cb of a._closeHandlers) cb()
      for (const cb of b._closeHandlers) cb()
    },
    onClose(cb) { this._closeHandlers.push(cb) },
  }
  return { a, b }
}

/** @param {import('../types').Platform} platform */
export default function session(platform) {
  const {
    classes: { Resource },
    utils: { isPlainObject },
  } = platform

  /**
   * RemoteResource — proxy for a resource on the other side of a session.
   * Not platform.define'd — users get these from session responses, not directly.
   */
  class RemoteResource extends Resource {
    #session
    #ref

    constructor(session, ref) {
      super()
      this.#session = session
      this.#ref = ref
    }

    get(msg = {}) {
      return this.#session._sendTargeted(this.#ref, msg)
    }

    put(body, headers = {}) {
      return this.#session._sendTargeted(this.#ref, { put: body, ...headers })
    }

    accept(visitor) {
      return visitor.visitRemoteResource?.(this) ?? super.accept(visitor)
    }
  }

  /**
   * Session — BSP session over a transport.
   *
   * Both peers create a Session. Both can send requests and serve requests.
   * A Session with a root serves incoming requests against that root.
   * A Session without a root rejects incoming requests.
   *
   * Wire format (BSP):
   *   Request:        { T: <uuid>, msg: <any> }
   *   Response:       { R: <uuid>, msg: <any> }
   *   Error response: { R: <uuid>, error: <string> }
   *
   * Extensions inside msg:
   *   - { target: <uuid> } — address a garaged resource (absent = root)
   *   - { "$ref": <uuid> } — resource reference (replaced with proxy on decode)
   */
  class Session extends Resource {
    #transport
    #root
    #garage = new Garage()
    #pending = new Map()
    #proxies = new Map()
    closed = false

    /**
     * @param {object} opts
     * @param {Transport} opts.transport
     * @param {import('../types').ResourceFn} [opts.root]
     */
    constructor({ transport, root = null } = {}) {
      super()
      this.#transport = transport
      this.#root = root
      transport.onMessage(raw => this.#onMessage(raw))
      transport.onClose(() => this.#onClose())
    }

    get(msg = {}) {
      return this.#send(this.#encodeRefs(msg))
    }

    put(body, headers = {}) {
      return this.#send(this.#encodeRefs({ put: body, ...headers }))
    }

    /**
     * Send a targeted message to a garaged resource on the remote peer.
     * Used by RemoteResource — not part of the public API.
     */
    _sendTargeted(ref, msg) {
      return this.#send(this.#encodeRefs({ target: ref, ...msg }))
    }

    #send(encodedMsg) {
      if (this.closed) return Promise.reject(new Error('session closed'))
      return new Promise((resolve, reject) => {
        const tag = crypto.randomUUID()
        this.#pending.set(tag, { resolve, reject })
        try {
          this.#transport.send({ T: tag, msg: encodedMsg })
        } catch (err) {
          this.#pending.delete(tag)
          reject(err)
        }
      })
    }

    async #onMessage(raw) {
      if (this.closed) return

      // Response
      if ('R' in raw) {
        const pending = this.#pending.get(raw.R)
        if (!pending) return
        this.#pending.delete(raw.R)
        if ('error' in raw) {
          pending.reject(new Error(raw.error))
        } else {
          pending.resolve(this.#decodeRefs(raw.msg))
        }
        return
      }

      // Request
      if ('T' in raw) {
        const { T, msg } = raw
        try {
          if (!this.#root) throw new Error('no root')

          let target, dispatchMsg
          if (msg.target) {
            target = this.#garage.resolve(msg.target)
            const { target: _, ...rest } = msg
            dispatchMsg = this.#decodeRefs(rest)
          } else {
            target = this.#root
            dispatchMsg = this.#decodeRefs(msg)
          }

          let result = typeof target === 'function' ? target(dispatchMsg) : target
          if (result instanceof Promise) result = await result

          this.#transport.send({ R: T, msg: this.#encodeRefs(result) })
        } catch (err) {
          try {
            this.#transport.send({ R: T, error: err.message })
          } catch {
            // Transport closed during response — nothing we can do
          }
        }
      }
    }

    #onClose() {
      this.closed = true
      for (const [, { reject }] of this.#pending) {
        reject(new Error('session closed'))
      }
      this.#pending.clear()
    }

    #encodeRefs(value) {
      if (typeof value === 'function' && value[kResource]) {
        return { $ref: this.#garage.park(value) }
      }
      if (Array.isArray(value)) return value.map(v => this.#encodeRefs(v))
      if (isPlainObject(value)) {
        const out = {}
        for (const [k, v] of Object.entries(value)) out[k] = this.#encodeRefs(v)
        return out
      }
      return value
    }

    #decodeRefs(value) {
      if (isPlainObject(value)) {
        const keys = Object.keys(value)
        if (keys.length === 1 && keys[0] === '$ref' && typeof value.$ref === 'string') {
          return this.#getProxy(value.$ref)
        }
        const out = {}
        for (const [k, v] of Object.entries(value)) out[k] = this.#decodeRefs(v)
        return out
      }
      if (Array.isArray(value)) return value.map(v => this.#decodeRefs(v))
      return value
    }

    #getProxy(ref) {
      if (this.#proxies.has(ref)) return this.#proxies.get(ref)
      const remote = new RemoteResource(this, ref)
      const fn = this.platform.resource(remote)
      this.#proxies.set(ref, fn)
      return fn
    }

    get garage() { return this.#garage }

    accept(visitor) {
      return visitor.visitSession?.(this) ?? super.accept(visitor)
    }
  }

  platform.define({ Session })
  platform.memoryTransport = memoryTransport
}
