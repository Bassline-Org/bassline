export const EOF = Symbol.for('$$BASSLINE_EOF$$')
export function kindOf(v) {
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

export const delay = (ms = 1000) => new Promise(res => setTimeout(res, ms))
export function port(size = Infinity) {
  const buffer = [],
    waiters = []
  let closed = false
  function close() {
    closed = true
    for (const w of waiters) w(EOF)
    waiters.length = 0
  }
  function send(msg) {
    if (is.eof(msg)) throw new Error('Bassline EOF is reserved')
    if (closed) return
    // resolve the promise if we have a waiter
    if (waiters.length > 0) return waiters.shift()(msg)
    // drop a message if we are over capabity
    if (buffer.length >= size) buffer.shift()
    // add the message to the buffer if we have capacity
    if (size > 0) buffer.push(msg)
  }
  function recv() {
    if (buffer.length > 0) return Promise.resolve(buffer.shift())
    if (closed) return Promise.resolve(EOF)
    return new Promise(resolve => waiters.push(resolve))
  }
  return { send, recv, close }
}

export function propagator(fn = (v, p) => p(v)) {
  let closed = false
  const targets = lazy(() => new Set())
  const propagate = value => targets().forEach(t => t(value))
  function send(value) {
    if (closed) return
    Promise.resolve(fn(value, propagate))
  }
  function to(...dests) {
    dests.forEach(d => targets().add(d))
    return () => dests.forEach(d => targets().delete(d))
  }
  function close() {
    closed = true
    targets().clear()
  }
  return { send, to, close }
}

export function cell(merge, init) {
  let current = init
  const { send, to, close } = propagator((incoming, propagate) => {
    merge(current, incoming, value => {
      current = value
      propagate(value)
    })
  })
  return { send, to, close, value: () => current }
}

export function consume(recv, callback) {
  const p = propagator(callback)
  const promise = (async () => {
    while (true) {
      const msg = await recv()
      if (is.eof(msg)) break
      p.send(msg)
    }
    p.close()
  })()
  return { to: p.to, promise }
}

export function net() {
  const ports = new Set()
  function join(size) {
    const fromNet = port(size)
    ports.add(fromNet)
    return {
      recv: fromNet.recv,
      send(msg) {
        ports.forEach(p => p !== fromNet && p.send(msg))
      },
      close() {
        fromNet.close()
        ports.delete(fromNet)
      },
    }
  }
  join.close = () => [...ports].forEach(p => p.close())
  join.send = msg => [...ports].forEach(p => p.send(msg))
  return join
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
