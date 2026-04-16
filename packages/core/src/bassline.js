export const EOF = Symbol.for('$$BASSLINE_EOF$$')
function kindOf(v) {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (v instanceof Promise) return 'promise'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

const isa = kind => v => kindOf(v) === kind
export const is = {
  eof: v => v === EOF,
  nil: v => v == null,
  null: isa('null'),
  undefined: isa('undefined'),
  defined: v => !is.undefined(v),
  promise: isa('promise'),
  number: isa('number'),
  string: isa('string'),
  fn: isa('function'),
  symbol: isa('symbol'),
  array: isa('array'),
  object: isa('object'),
  msg: v => is.object(v) && Object.getPrototypeOf(v) === Object.prototype,
}

export const lazy = fn => {
  let value, called
  return () => {
    if (is.undefined(called)) ((value = fn()), (called = true))
    return value
  }
}

export function cap(ctl, aFn) {
  if (!is.fn(aFn)) {
    throw new Error('invalid cap, must be a function!')
  }
  let fn = aFn
  ctl.onClose(() => (fn = null))
  return function (...args) {
    if (fn === null) return
    return fn(...args)
  }
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
    cap: fn => cap(ctl, fn),
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
export function port(size = Infinity) {
  const buffer = [],
    waiters = []
  const { close, ctl } = createController()
  ctl.onClose(() => {
    for (const w of waiters) w(EOF)
    waiters.length = 0
  })
  const send = ctl.cap(msg => {
    if (is.eof(msg)) throw new Error('Bassline EOF is reserved')
    // resolve the promise if we have a waiter
    if (waiters.length > 0) return waiters.shift()(msg)
    // drop a message if we are over capabity
    if (buffer.length >= size) buffer.shift()
    // add the message to the buffer if we have capacity
    if (size > 0) buffer.push(msg)
  })
  function recv() {
    if (buffer.length > 0) return Promise.resolve(buffer.shift())
    if (ctl.closed) return Promise.resolve(EOF)
    return new Promise(resolve => waiters.push(resolve))
  }
  return { send, recv, close, ctl }
}

export function propagator(fn = (v, p) => p(v)) {
  const { close, ctl } = createController()
  const targets = lazy(() => new Set())
  const propagate = value => targets().forEach(t => t(value))
  ctl.onClose(() => targets().clear())
  const send = ctl.cap(val => {
    Promise.resolve(fn(val, propagate))
  })
  const to = ctl.cap((...dests) => {
    dests.forEach(d => targets().add(d))
    return () => dests.forEach(d => targets().delete(d))
  })
  return { send, to, close, ctl }
}

export function cell(merge, init) {
  let current = init
  const { send, to, close, ctl } = propagator((incoming, propagate) => {
    merge(current, incoming, value => {
      current = value
      propagate(value)
    })
  })
  return { send, to, close, ctl, value: () => current }
}

export function consume(recv, callback) {
  const { send, to, ctl, close } = propagator(callback)
  const promise = (async () => {
    const closed = new Promise(resolve => ctl.onClose(() => resolve(EOF)))
    while (!ctl.closed) {
      const msg = await Promise.race([recv(), closed])
      if (is.eof(msg)) break
      send(msg)
    }
    close()
  })()
  return { to, ctl, close, promise }
}

export function net() {
  const ports = new Set()
  const nc = createController()

  const join = nc.ctl.cap(size => {
    const fromNet = port(size)
    const { recv, ctl, close } = fromNet
    const send = ctl.cap(msg => {
      ports.forEach(p => p !== fromNet && p.send(msg))
    })
    ports.add(fromNet)
    nc.ctl.closes(fromNet)
    ctl.onClose(() => ports.delete(fromNet))
    return { recv, ctl, close, send }
  })

  const send = nc.ctl.cap(msg => ports.forEach(p => p.send(msg)))

  return { join, send, ctl: nc.ctl, close: nc.close }
}

export function message(content) {
  if (is.undefined(content)) return {}
  if (is.msg(content)) return { ...content }
  return { body: content }
}

export const hasCap = (msg, name) => is.defined(msg[name]) && is.fn(msg[name])

export function offer(handlers) {
  const syms = Object.getOwnPropertySymbols(handlers)
  return propagator((msg, propagate) => {
    const enriched = { ...msg }
    for (const sym of syms) {
      enriched[sym] = m => void handlers[sym](m)
    }
    propagate(enriched)
  })
}

export function accept(handlers) {
  const syms = Object.getOwnPropertySymbols(handlers)
  return propagator(async (msg, propagate) => {
    for (const sym of syms) {
      if (hasCap(msg, sym)) await handlers[sym](msg, msg[sym])
    }
    propagate(msg)
  })
}
