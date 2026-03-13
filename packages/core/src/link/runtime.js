import { Garage } from '../infra/garage.js'
import {
  OPCODE,
  ERROR_CODE,
  encodeRequest,
  encodeResponseSuccess,
  encodeResponseError,
  parseEnvelope,
} from './protocol-v1.js'

const kResource = Symbol.for('bassline.resource')
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

class LinkError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

/**
 * Create an in-memory transport pair for testing.
 * Returns two symmetric endpoints: messages sent on one arrive on the other.
 * Close propagates to both ends. Send-after-close throws.
 *
 * @returns {{
 *   a: import('../types').Transport,
 *   b: import('../types').Transport
 * }}
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
    onMessage(cb) {
      this._handler = cb
    },
    close() {
      if (closed) return
      closed = true
      for (const cb of a._closeHandlers) cb()
      for (const cb of b._closeHandlers) cb()
    },
    onClose(cb) {
      this._closeHandlers.push(cb)
    },
  }
  const b = {
    _handler: null,
    _closeHandlers: [],
    send(msg) {
      if (closed) throw new Error('transport closed')
      a._handler?.(msg)
    },
    onMessage(cb) {
      this._handler = cb
    },
    close() {
      if (closed) return
      closed = true
      for (const cb of a._closeHandlers) cb()
      for (const cb of b._closeHandlers) cb()
    },
    onClose(cb) {
      this._closeHandlers.push(cb)
    },
  }
  return { a, b }
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function codeForError(err) {
  if (err instanceof LinkError) return err.code
  if (err instanceof Error) {
    if (err.message.includes('invalid token')) return ERROR_CODE.TARGET
    if (err.message.includes('transport closed')) return ERROR_CODE.CLOSED
  }
  return ERROR_CODE.INTERNAL
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function messageForError(err) {
  if (err instanceof Error) return err.message
  return 'internal error'
}

/**
 * @param {unknown} obj
 * @returns {boolean}
 */
function isPlainObject(obj) {
  return obj !== null && typeof obj === 'object'
    && !Array.isArray(obj) && Object.getPrototypeOf(obj) === Object.prototype
}

/**
 * Create a remote resource function that forwards messages over a transport.
 * @param {Function} sendRequest
 * @param {string} [targetRef]
 * @returns {Function}
 */
function makeRemoteResource(sendRequest, targetRef) {
  const impl = {
    accept(visitor) {
      return visitor.visitRemoteResource?.(impl) ?? visitor.visitResource?.(impl)
    },
  }
  const fn = (msg = {}) => {
    if ('put' in msg) {
      const { put, ...rest } = msg
      return sendRequest({ put, ...rest }, targetRef)
    }
    return sendRequest(msg, targetRef)
  }
  fn[kResource] = impl
  return fn
}

/** @param {import('../types').Platform} platform */
export default function link(platform) {
  /**
   * @param {object} opts
   * @param {import('../types').Transport} opts.transport
   * @param {import('../types').ResourceFn} [opts.localScope]
   */
  function open({ transport, localScope = platform.root } = {}) {
    if (!transport) throw new Error('transport required')
    if (typeof localScope !== 'function') throw new Error('localScope must be a resource function')

    const garage = new Garage()
    const pending = new Map()
    const proxies = new Map()
    const state = {
      closed: false,
    }

    /**
     * @param {string} ref
     */
    function getProxy(ref) {
      if (proxies.has(ref)) return proxies.get(ref)
      const fn = makeRemoteResource(sendRequest, ref)
      proxies.set(ref, fn)
      return fn
    }

    /**
     * @param {unknown} value
     * @returns {unknown}
     */
    function encodeRefs(value) {
      if (typeof value === 'function' && value[kResource]) {
        return { $ref: garage.park(value) }
      }
      if (Array.isArray(value)) return value.map(v => encodeRefs(v))
      if (isPlainObject(value)) {
        const out = {}
        for (const [k, v] of Object.entries(value)) out[k] = encodeRefs(v)
        return out
      }
      return value
    }

    /**
     * @param {unknown} value
     * @returns {unknown}
     */
    function decodeRefs(value) {
      if (isPlainObject(value)) {
        const keys = Object.keys(value)
        if (keys.length === 1 && keys[0] === '$ref' && typeof value.$ref === 'string') {
          return getProxy(value.$ref)
        }
        const out = {}
        for (const [k, v] of Object.entries(value)) out[k] = decodeRefs(v)
        return out
      }
      if (Array.isArray(value)) return value.map(v => decodeRefs(v))
      return value
    }

    /**
     * @param {string} code
     * @param {string} message
     */
    function closeInternal(code = ERROR_CODE.CLOSED, message = 'link closed') {
      if (state.closed) return
      state.closed = true

      for (const [, item] of pending) {
        clearTimeout(item.timer)
        item.reject(new LinkError(code, message))
      }
      pending.clear()

      try {
        transport.close()
      } catch {
        // ignore close errors
      }
    }

    /**
     * @param {object} frame
     */
    function sendFrame(frame) {
      if (state.closed) throw new LinkError(ERROR_CODE.CLOSED, 'link closed')
      transport.send(frame)
    }

    /**
     * @param {unknown} msg
     * @param {string} [targetRef]
     * @returns {Promise<unknown>}
     */
    function sendRequest(msg, targetRef) {
      if (state.closed) return Promise.reject(new LinkError(ERROR_CODE.CLOSED, 'link closed'))

      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID()
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new LinkError(ERROR_CODE.TIMEOUT, 'request timeout'))
        }, DEFAULT_REQUEST_TIMEOUT_MS)

        pending.set(id, { resolve, reject, timer })

        try {
          const frame = encodeRequest({
            id,
            msg: encodeRefs(msg),
            targetRef,
          })
          sendFrame(frame)
        } catch (err) {
          clearTimeout(timer)
          pending.delete(id)
          reject(err)
        }
      })
    }

    /**
     * @param {{ id: string, ok: boolean, result?: unknown, error?: { code: string, message: string } }} frame
     */
    function handleResponse(frame) {
      const pendingReq = pending.get(frame.id)
      if (!pendingReq) return

      clearTimeout(pendingReq.timer)
      pending.delete(frame.id)

      if (frame.ok) {
        pendingReq.resolve(decodeRefs(frame.result))
        return
      }

      pendingReq.reject(new LinkError(frame.error.code, frame.error.message))
    }

    /**
     * @param {{ id: string, msg: unknown, targetRef?: string }} frame
     */
    async function handleRequest(frame) {
      try {
        const target = frame.targetRef ? garage.resolve(frame.targetRef) : localScope
        const dispatchMsg = decodeRefs(frame.msg)
        let result = typeof target === 'function' ? target(dispatchMsg) : target
        if (result instanceof Promise) result = await result

        return encodeResponseSuccess({
          id: frame.id,
          result: encodeRefs(result),
        })
      } catch (err) {
        return encodeResponseError({
          id: frame.id,
          code: codeForError(err),
          message: messageForError(err),
        })
      }
    }

    /**
     * @param {unknown} raw
     */
    async function onMessage(raw) {
      if (state.closed) return

      const parsed = parseEnvelope(raw)
      if (!parsed.ok) {
        closeInternal(parsed.code ?? ERROR_CODE.PROTOCOL, parsed.message ?? 'protocol error')
        return
      }

      if (parsed.frame.op === OPCODE.RESPONSE) {
        handleResponse(parsed.frame)
        return
      }

      const response = await handleRequest(parsed.frame)
      try {
        sendFrame(response)
      } catch {
        closeInternal(ERROR_CODE.CLOSED, 'transport closed while sending response')
      }
    }

    const remoteScope = makeRemoteResource(sendRequest)

    transport.onMessage(raw => {
      void onMessage(raw)
    })
    transport.onClose(() => {
      closeInternal(ERROR_CODE.CLOSED, 'link closed')
    })

    return {
      localScope,
      remoteScope,
      close() {
        closeInternal(ERROR_CODE.CLOSED, 'link closed')
      },
      get closed() {
        return state.closed
      },
    }
  }

  platform.link = { open }
}
