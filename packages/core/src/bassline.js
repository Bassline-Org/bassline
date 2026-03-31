export const EOF = Symbol.for('$$BASSLINE_EOF$$')
export function kindOf(v) {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (v instanceof Promise) return 'promise'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

export const table = {
  keys: o => (is.nil(o) ? [] : Object.keys(o)),
  values: o => (is.nil(o) ? [] : Object.values(o)),
  entries: o => (is.nil(o) ? [] : Object.entries(o)),
  syms: o => (is.nil(o) ? [] : Object.getOwnPropertySymbols(o)),
  index: (table, keys) => keys.map(k => table[k]),
  has: (table, keys) => keys.every(k => is.defined(table[k])),
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

export const delay = async (ms = 1000) => await new Promise(res => setTimeout(res, ms))

export class Fault extends Error {
  constructor(condition, msg, context = {}) {
    super(`fault: ${condition}`)
    this.condition = condition
    this.msg = msg
    this.context = context
  }
  toMessage() {
    return message({ condition: this.condition, msg: this.msg, ...this.context })
  }
}
export const fault = (condition, msg, context) => new Fault(condition, msg, context)
export function port(size = Infinity) {
  const buffer = []
  const waiters = []
  let closed = false
  const close = () => {
    closed = true
    for (const w of waiters) w(EOF)
    waiters.length = 0
  }
  const send = msg => {
    if (is.eof(msg)) throw new Error('Bassline EOF is reserved')
    if (closed) return
    if (waiters.length > 0) return waiters.shift()(msg)
    if (buffer.length >= size) buffer.shift() // sliding buffer
    if (size > 0) buffer.push(msg) // no buffer
  }
  const recv = () => {
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
  async function send(value) {
    if (closed) return
    await fn(value, propagate)
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
      await p.send(msg)
    }
    p.close()
  })()
  return { to: p.to, promise }
}

export function net() {
  const ports = new Set()
  function join(size) {
    const p = port(size)
    let closed = false
    ports.add(p)
    const send = msg => {
      if (closed) return
      ports.forEach(port => port !== p && port.send(msg))
    }
    const close = () => {
      closed = true
      ports.delete(p)
      p.close()
    }

    return {
      recv: p.recv,
      send,
      close,
    }
  }
  join.close = () => [...ports].forEach(p => p.close())
  join.send = msg => [...ports].forEach(p => p.send(msg))
  return join
}

export function clock(ms = 1000, eager = true) {
  const { send, to, close } = propagator((_, p) => p({ ts: Date.now() }))
  const interval = setInterval(send, ms)
  if (eager) send({})
  return {
    to,
    close: () => {
      clearInterval(interval)
      close()
    },
  }
}

export function message(content) {
  if (is.undefined(content)) return {}
  if (is.msg(content)) return { ...content }
  return { body: content }
}

export const hasCap = (msg, name) => table.has(msg, [name]) && is.fn(msg[name])

function assertHandlers(handlers) {
  const syms = table.syms(handlers)
  for (const sym of syms) {
    if (!is.symbol(sym)) throw new Error('invalid handler key, must be a symbol!')
    if (!is.fn(handlers[sym])) throw new Error('invalid handler,  must be a function')
  }
  return syms
}

export function offer(handlers) {
  const syms = assertHandlers(handlers)
  return propagator((msg, propagate) => {
    const enriched = { ...msg }
    for (const sym of syms) {
      enriched[sym] = m => void handlers[sym](m)
    }
    propagate(enriched)
  })
}

export function accept(handlers) {
  const syms = assertHandlers(handlers)
  return propagator(async (msg, propagate) => {
    for (const sym of syms) {
      if (hasCap(msg, sym)) await handlers[sym](msg, msg[sym])
    }
    propagate(msg)
  })
}
