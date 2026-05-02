export const EOF = Symbol.for('$$BASSLINE_EOF$$')

const scalarTypes = ['string', 'boolean', 'symbol', 'number']
export const is = {
  eof: v => v === EOF,
  nil: v => v == null || Number.isNaN(v),
  null: v => v === null,
  undefined: v => v === undefined,
  promise: v => v instanceof Promise,
  boolean: v => typeof v === 'boolean',
  number: v => typeof v === 'number' && !Number.isNaN(v),
  string: v => typeof v === 'string',
  fn: v => typeof v === 'function',
  symbol: v => typeof v === 'symbol',
  array: v => Array.isArray(v),
  object: v => typeof v === 'object' && v !== null,
  msg: v => v instanceof Msg,
  scalar: v => is.null(v) || scalarTypes.includes(typeof v),
}

export class AssertionFailure extends Error {}
export function failure(msg) {
  return new AssertionFailure(msg)
}

export function invariants(preds) {
  function assert(value) {
    for (const [pred, msg = _v => 'assertion failed'] of preds) {
      if (!pred(value)) {
        if (is.fn(msg)) throw failure(msg(value))
        throw failure(msg)
      }
    }
    return value
  }
  assert.test = value => {
    try {
      assert(value)
      return true
    } catch (e) {
      if (e instanceof AssertionFailure) return false
      throw e
    }
  }
  return assert
}

export const satisfiesAll = preds => val => preds.every(p => p(val))

export function conforms(description) {
  if (!is.object(description)) throw failure('conform: invalid description')

  const predicates = [is.object]

  for (const [key, val] of Object.entries(description)) {
    if (is.fn(val)) {
      predicates.push(obj => val(obj[key], obj))
      continue
    }
    if (is.scalar(val)) {
      predicates.push(obj => obj[key] === val)
      continue
    }
    throw failure(`conform: unknown descriptor key: ${key}, val: ${val}`)
  }

  return satisfiesAll(predicates)
}

export function createController() {
  const controller = new AbortController()
  const signal = controller.signal
  const ctl = {
    onClose(fn, aSignal) {
      if (ctl.closed) return void fn()
      signal.addEventListener('abort', fn, { once: true, signal: aSignal })
    },
    closes(...controllers) {
      for (const c of controllers) {
        ctl.onClose(() => c.close(), c?.ctl?.signal)
      }
    },
    get closed() {
      return signal.aborted
    },
    signal,
  }
  function close(reason = 'closed') {
    if (ctl.closed) return
    controller.abort(reason)
  }
  return { close, ctl }
}

export const delay = (ms = 1000) => new Promise(res => setTimeout(res, ms))
const validCapName = invariants([[is.string, 'cap spelling must be a string']])
const validCapFn = invariants([[is.fn, 'cap fn must be a function']])
const validCaps = invariants([
  [v => Object.keys(v).every(is.string), 'cap keys must be strings'],
  [v => Object.values(v).every(is.fn), 'cap values must be functions'],
])

const validData = invariants([
  [is.object, 'data must be an object'],
  [v => !is.array(v), 'data cannot be an array'],
])

export class Msg {
  data = {}
  caps = new Map()

  constructor(data = {}, caps = {}) {
    validData(data)
    validCaps(caps)
    const { ctl, close } = createController()
    this.ctl = ctl
    this.close = close
    this.merge(data)
    this.grantAll(caps)
    this.ctl.onClose(() => {
      this.caps.clear()
    })
  }

  copy(data = {}) {
    const msg = new Msg({ ...this.data, ...data })
    for (const [k, v] of this.caps) {
      msg.grant(k, v)
    }
    return msg
  }

  store(cache) {
    for (const [spelling, fn] of this.caps) {
      cache.storeCap(this, spelling, fn)
    }
  }

  merge(data) {
    this.data = { ...this.data, ...data }
    return this
  }

  has(key) {
    return key in this.data
  }

  hasKeys(keys) {
    return keys.every(k => this.has(k))
  }

  get(key) {
    return this.data[key]
  }

  delete(key) {
    delete this.data[key]
    return this
  }

  hasCap(key) {
    return this.caps.has(key)
  }

  hasCaps(keys) {
    return keys.every(k => this.hasCap(k))
  }

  revoke(spelling) {
    this.caps.delete(spelling)
    return this
  }

  grant(spelling, fn) {
    validCapName(spelling)
    validCapFn(fn)
    this.caps.set(spelling, fn)
    return this
  }

  grantAll(obj) {
    Object.entries(obj).forEach(([k, v]) => this.grant(k, v))
    return this
  }

  invoke(spelling, arg = new Msg()) {
    validCapName(spelling)
    const cap = this.caps.get(spelling)
    if (cap) cap(arg)
    return this
  }

  send(msg) {
    return this.invoke('send', msg)
  }

  conforms(description) {
    return conforms(description)(this.data)
  }
}

export function msg(data = {}, caps = {}) {
  if (is.msg(data)) return data.grantAll(caps)
  return new Msg(data, caps)
}
export function port(size = Infinity) {
  const buffer = [],
    waiters = []
  const description = 'I am a port. I support buffered communication.'
  const m = new Msg({ description })
  m.grantAll({
    send: msg => {
      if (is.eof(msg)) throw new Error('Bassline EOF is reserved')
      // resolve the promise if we have a waiter
      if (waiters.length > 0) return waiters.shift()(msg)
      // drop a message if we are over capabity
      if (buffer.length >= size) buffer.shift()
      // add the message to the buffer if we have capacity
      if (size > 0) buffer.push(msg)
    },
    close: m.close,
  })
  m.ctl.onClose(() => {
    for (const w of waiters) w(EOF)
    waiters.length = 0
  })
  function recv() {
    if (buffer.length > 0) return Promise.resolve(buffer.shift())
    if (m.ctl.closed) return Promise.resolve(EOF)
    return new Promise(resolve => waiters.push(resolve))
  }
  return [m, recv]
}

export function propagator(fn = (v, p) => p(v)) {
  const description = 'I am a propagator. I am a reactive inference machine.'
  const m = new Msg({ description })
  const targets = new Set()
  const propagate = value => targets.forEach(t => t(value))
  m.ctl.onClose(() => targets.clear())

  const to = (...dests) => {
    dests.forEach(d => targets.add(d))
    return () => dests.forEach(d => targets.delete(d))
  }

  m.grantAll({
    send: val => {
      Promise.resolve(fn(val, propagate)).catch(e => {
        throw e
      })
    },
    close: m.close,
  })

  return [m, to]
}

export function cell(merge, init) {
  const description = 'I am a cell. I am a propagator with state'
  let current = init
  const [m, to] = propagator((incoming, propagate) => {
    merge(current, incoming, value => {
      current = value
      propagate(value)
    })
  })
  m.merge({ description })
  return [m, { to, value: () => current }]
}

export function consume(recv, callback) {
  const [m, to] = propagator(callback)
  const description =
    'I am a consumed port. I am a propagator driven by a port.'
  m.merge({ description })
  const promise = (async () => {
    const closed = new Promise(resolve => m.ctl.onClose(() => resolve(EOF)))
    while (!m.ctl.closed) {
      const msg = await Promise.race([recv(), closed])
      if (is.eof(msg)) break
      m.invoke('send', msg)
    }
    m.close()
    m.invoke('close')
  })()
  return [m, { to, promise }]
}

export function net() {
  const description =
    'I am a net. I implement seamless multi-party communication.'
  const ports = new Set()
  const netm = new Msg({ description })

  netm.grantAll({
    send: msg => ports.forEach(p => p.invoke('send', msg)),
    close: netm.close,
  })

  const join = size => {
    const [fromNet, recv] = port(size)
    const toNet = fromNet.copy().grant('send', msg => {
      for (const p of ports) {
        if (p === fromNet) continue
        p.send(msg)
      }
    })
    ports.add(fromNet)
    netm.ctl.closes(fromNet)
    fromNet.ctl.closes(toNet)
    toNet.ctl.closes(fromNet)
    fromNet.ctl.onClose(() => ports.delete(fromNet))
    return [toNet, recv]
  }

  return [netm, join]
}
