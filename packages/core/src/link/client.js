import { ERROR_CODE } from './protocol-v1.js'

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_RECONNECT = {
  maxAttempts: 5,
  minDelayMs: 100,
  maxDelayMs: 2_000,
  factor: 2,
  jitterRatio: 0.2,
}
const DEFAULT_HEARTBEAT = {
  idleMs: 15_000,
  timeoutMs: 3_000,
  probeMessage: {},
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * @param {number} attempt
 * @param {{ minDelayMs: number, maxDelayMs: number, factor: number, jitterRatio: number }} policy
 * @returns {number}
 */
function computeBackoff(attempt, policy) {
  const exp = Math.max(0, attempt - 1)
  const raw = policy.minDelayMs * (policy.factor ** exp)
  const base = Math.min(policy.maxDelayMs, raw)
  const jitter = base * policy.jitterRatio
  const offset = (Math.random() * 2 - 1) * jitter
  return Math.max(0, Math.floor(base + offset))
}

/**
 * @param {string} code
 * @param {string} message
 * @param {'client' | 'link'} source
 * @param {string} [name]
 * @param {unknown} [cause]
 */
function makeError(code, message, source, name = 'Error', cause) {
  const err = new Error(message)
  err.code = code
  err.source = source
  err.name = name
  if (cause !== undefined) err.cause = cause
  return err
}

/**
 * @param {unknown} err
 * @returns {Error & { code: string, source: 'client' | 'link' }}
 */
function normalizeClientError(err) {
  if (err && typeof err === 'object') {
    const code = typeof err.code === 'string' ? err.code : null
    const message = typeof err.message === 'string' ? err.message : 'internal error'
    const source = err.source === 'client' ? 'client' : 'link'
    const name = typeof err.name === 'string' ? err.name : 'Error'
    if (code) return makeError(code, message, source, name, err)
    if (name === 'AbortError') {
      return makeError('E_ABORT', message || 'aborted', 'client', 'AbortError', err)
    }
    if (message.includes('closed')) {
      return makeError(ERROR_CODE.CLOSED, message, 'link', name, err)
    }
  }
  return makeError(ERROR_CODE.INTERNAL, 'internal error', 'link', 'Error', err)
}

/**
 * @param {Promise<unknown>} promise
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [opts]
 * @param {number} defaultTimeoutMs
 * @returns {Promise<unknown>}
 */
function withTimeoutAndAbort(promise, opts = {}, defaultTimeoutMs = DEFAULT_TIMEOUT_MS) {
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? Number(opts.timeoutMs) : defaultTimeoutMs
  const signal = opts.signal

  if (signal?.aborted) {
    return Promise.reject(makeError('E_ABORT', 'aborted', 'client', 'AbortError'))
  }

  return new Promise((resolve, reject) => {
    let settled = false
    let timer = null
    let onAbort = null

    const cleanup = () => {
      if (timer) clearTimeout(timer)
      if (onAbort) signal?.removeEventListener('abort', onAbort)
      timer = null
      onAbort = null
    }

    const settle = (fn, value) => {
      if (settled) return
      settled = true
      cleanup()
      fn(value)
    }

    if (Number.isFinite(timeoutMs) && timeoutMs >= 0) {
      timer = setTimeout(() => {
        settle(reject, makeError(ERROR_CODE.TIMEOUT, 'request timeout', 'client'))
      }, timeoutMs)
    }

    if (signal) {
      onAbort = () => settle(reject, makeError('E_ABORT', 'aborted', 'client', 'AbortError'))
      signal.addEventListener('abort', onAbort, { once: true })
    }

    promise.then(
      value => settle(resolve, value),
      err => settle(reject, err),
    )
  })
}

/**
 * @param {Record<string, unknown> | undefined} options
 */
function normalizeReconnect(options) {
  const input = options ?? {}
  return {
    maxAttempts: Number.isFinite(input.maxAttempts) ? Number(input.maxAttempts) : DEFAULT_RECONNECT.maxAttempts,
    minDelayMs: Number.isFinite(input.minDelayMs) ? Number(input.minDelayMs) : DEFAULT_RECONNECT.minDelayMs,
    maxDelayMs: Number.isFinite(input.maxDelayMs) ? Number(input.maxDelayMs) : DEFAULT_RECONNECT.maxDelayMs,
    factor: Number.isFinite(input.factor) ? Number(input.factor) : DEFAULT_RECONNECT.factor,
    jitterRatio: Number.isFinite(input.jitterRatio) ? Number(input.jitterRatio) : DEFAULT_RECONNECT.jitterRatio,
  }
}

/**
 * @param {Record<string, unknown> | undefined} options
 */
function normalizeHeartbeat(options) {
  if (!options) return null
  return {
    idleMs: Number.isFinite(options.idleMs) ? Number(options.idleMs) : DEFAULT_HEARTBEAT.idleMs,
    timeoutMs: Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs) : DEFAULT_HEARTBEAT.timeoutMs,
    probeMessage: 'probeMessage' in options ? options.probeMessage : DEFAULT_HEARTBEAT.probeMessage,
  }
}

export class ManagedConnection {
  #connect
  #defaultTimeoutMs
  #reconnect
  #heartbeat
  #handle = null
  #closed = false
  #connectPromise = null
  #activeRequests = 0
  #heartbeatTimer = null

  /**
   * @param {object} opts
   * @param {() => Promise<import('../types').LinkHandle>} opts.connect
   * @param {number} [opts.defaultTimeoutMs]
   * @param {Record<string, unknown>} [opts.reconnect]
   * @param {Record<string, unknown>} [opts.heartbeat]
   */
  constructor({ connect, defaultTimeoutMs = DEFAULT_TIMEOUT_MS, reconnect, heartbeat } = {}) {
    if (typeof connect !== 'function') throw new Error('connect() required')
    this.#connect = connect
    this.#defaultTimeoutMs = Number.isFinite(defaultTimeoutMs) ? Number(defaultTimeoutMs) : DEFAULT_TIMEOUT_MS
    this.#reconnect = normalizeReconnect(reconnect)
    this.#heartbeat = normalizeHeartbeat(heartbeat)
  }

  get connected() {
    return Boolean(this.#handle && !this.#handle.closed && !this.#closed)
  }

  get closed() {
    return this.#closed
  }

  /**
   * @param {unknown} msg
   * @param {{ timeoutMs?: number, signal?: AbortSignal }} [opts]
   * @returns {Promise<unknown>}
   */
  async send(msg, opts = {}) {
    return this.#sendInternal(msg, opts, true)
  }

  async close() {
    if (this.#closed) return
    this.#closed = true
    this.#clearHeartbeatTimer()
    await this.#invalidateAndCloseHandle()
  }

  /**
   * @param {unknown} msg
   * @param {{ timeoutMs?: number, signal?: AbortSignal }} opts
   * @param {boolean} allowReconnect
   * @returns {Promise<unknown>}
   */
  async #sendInternal(msg, opts, allowReconnect) {
    if (this.#closed) throw makeError(ERROR_CODE.CLOSED, 'connection closed', 'client')
    this.#activeRequests += 1
    this.#clearHeartbeatTimer()

    try {
      const operation = (async () => {
        const handle = allowReconnect ? await this.#ensureConnected() : this.#requireConnectedHandle()
        return handle.remoteScope(msg)
      })()

      return await withTimeoutAndAbort(Promise.resolve(operation), opts, this.#defaultTimeoutMs)
    } catch (err) {
      const normalized = normalizeClientError(err)
      if (normalized.code === ERROR_CODE.CLOSED || normalized.code === ERROR_CODE.PROTOCOL) {
        await this.#invalidateAndCloseHandle()
      }
      throw normalized
    } finally {
      this.#activeRequests -= 1
      this.#scheduleHeartbeat()
    }
  }

  /**
   * @returns {import('../types').LinkHandle}
   */
  #requireConnectedHandle() {
    const handle = this.#handle
    if (!handle || handle.closed) {
      throw makeError(ERROR_CODE.CLOSED, 'link closed', 'link')
    }
    return handle
  }

  /**
   * @returns {Promise<import('../types').LinkHandle>}
   */
  async #ensureConnected() {
    if (this.#closed) throw makeError(ERROR_CODE.CLOSED, 'connection closed', 'client')
    if (this.#handle && !this.#handle.closed) return this.#handle

    this.#handle = null
    if (this.#connectPromise) return this.#connectPromise

    this.#connectPromise = this.#connectWithRetry().finally(() => {
      this.#connectPromise = null
    })
    return this.#connectPromise
  }

  /**
   * @returns {Promise<import('../types').LinkHandle>}
   */
  async #connectWithRetry() {
    let attempts = 0
    let lastError = makeError(ERROR_CODE.CLOSED, 'connection closed', 'client')

    while (!this.#closed) {
      attempts += 1
      try {
        const handle = await this.#connect()
        if (!handle || typeof handle.remoteScope !== 'function' || typeof handle.close !== 'function') {
          throw new Error('connect() must resolve to a LinkHandle')
        }

        if (this.#closed) {
          try {
            handle.close()
          } catch {
            // ignore close errors while shutting down
          }
          throw makeError(ERROR_CODE.CLOSED, 'connection closed', 'client')
        }

        this.#handle = handle
        this.#scheduleHeartbeat()
        return handle
      } catch (err) {
        lastError = normalizeClientError(err)
        if (this.#closed) break
        if (attempts >= this.#reconnect.maxAttempts) break
        const delay = computeBackoff(attempts, this.#reconnect)
        await sleep(delay)
      }
    }

    throw lastError
  }

  async #invalidateAndCloseHandle() {
    const handle = this.#handle
    this.#handle = null
    if (!handle) return
    try {
      handle.close()
    } catch {
      // ignore close errors while invalidating
    }
  }

  #clearHeartbeatTimer() {
    if (this.#heartbeatTimer) {
      clearTimeout(this.#heartbeatTimer)
      this.#heartbeatTimer = null
    }
  }

  #scheduleHeartbeat() {
    if (!this.#heartbeat || this.#closed) return
    if (!this.connected) return
    if (this.#activeRequests > 0) return

    this.#clearHeartbeatTimer()
    this.#heartbeatTimer = setTimeout(() => {
      void this.#runHeartbeat()
    }, this.#heartbeat.idleMs)
  }

  async #runHeartbeat() {
    this.#heartbeatTimer = null
    if (!this.#heartbeat || this.#closed || !this.connected || this.#activeRequests > 0) return
    try {
      await this.#sendInternal(
        this.#heartbeat.probeMessage,
        { timeoutMs: this.#heartbeat.timeoutMs },
        false,
      )
    } catch {
      await this.#invalidateAndCloseHandle()
    }
  }
}

/** @param {import('../types').Platform} platform */
export default function client(platform) {
  platform.client = {
    ManagedConnection,
  }
}
