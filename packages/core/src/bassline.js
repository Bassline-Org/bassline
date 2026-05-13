// [[file:../book/v2.org::*Predicates][Predicates:1]]
export const EOF = Symbol.for('$$BASSLINE_EOF$$')

export const is = {
  eof: v => v === EOF,
  null: v => v === null,
  undefined: v => v === undefined,

  number: v => typeof v === 'number' && !is.nan(v),
  string: v => typeof v === 'string',
  boolean: v => typeof v === 'boolean',
  symbol: v => typeof v === 'symbol',
  fn: v => typeof v === 'function',

  nan: v => Number.isNaN(v),
  array: v => Array.isArray(v),
  arrayOf: pred => v => is.array(v) && v.every(pred),
  promise: v => v instanceof Promise,
  msg: v => v instanceof Msg,

  nil: v => is.null(v) || is.undefined(v) || isNaN(v),
  scalar: v => is.number(v) || is.string(v) || is.null(v) || is.boolean(v),
  object: v => typeof v === 'object' && !is.null(v) && !is.array(v),
}
// Predicates:1 ends here

// [[file:../book/v2.org::*Object Manipulation][Object Manipulation:1]]
function get(obj, keys) {
  if (is.undefined(obj)) return []
  if (is.array(keys)) return keys.forEach(k => obj?.[k])
  if (is.string(keys)) return obj?.[keys]
  throw failure('get: keys must be a string or an array of strings')
}

function has(obj, keys) {
  if (is.undefined(obj)) return false
  if (is.array(keys)) return keys.every(k => has(obj, k))
  if (is.string(keys)) return Object.hasOwn(obj, keys)
  throw failure('has: keys must be a string or an array of strings')
}

function remove(obj, keys) {
  if (is.undefined(obj)) return {}
  if (is.array(keys)) keys.forEach(k => delete obj?.[k])
  else if (is.string(keys)) delete obj?.[keys]
  else throw failure('remove: keys must be a string or an array of strings')
  return obj
}

function merge(obj, data) {
  if (is.undefined(obj)) return merge({}, data)
  if (is.undefined(data)) return obj
  if (!is.object(data)) throw failure('data must be an object')
  for (const [k, v] of Object.entries(data)) obj[k] = v
  return obj
}

function defaults(obj, data) {
  if (is.undefined(obj)) return defaults({}, data)
  if (!is.object(data)) throw failure('data must be an object')
  for (const [k, v] of Object.entries(data)) {
    if (is.undefined(obj[k])) obj[k] = v
  }
  return obj
}

function pick(obj, keys) {
  if (is.undefined(obj)) return {}
  if (is.array(keys)) {
    return Object.fromEntries(keys.map(k => [k, obj[k]]))
  } else if (is.string(keys)) {
    return { [keys]: obj[keys] }
  } else {
    throw failure('pick: keys must be a string or an array of strings')
  }
}
// Object Manipulation:1 ends here

// [[file:../book/v2.org::*Assertions][Assertions:1]]
export class AssertionFailure extends Error {}
/**
 * @param {string} msg
 */
export function failure(msg) {
  return new AssertionFailure(msg)
}
// Assertions:1 ends here

// [[file:../book/v2.org::*Controller][Controller:1]]
export class Controller {
  controller = new AbortController()
  signal = this.controller.signal
  close = (reason = 'closed') => {
    if (!this.closed) {
      this.controller.abort(reason)
    }
    return this
  }
  onClose(fn, aSignal) {
    if (this.closed) void fn()
    else
      this.signal.addEventListener('abort', fn, { once: true, signal: aSignal })
    return this
  }
  closeGroup(...controllers) {
    this.closedBy(...controllers)
    this.closes(...controllers)
    return this
  }
  closedBy(...controllers) {
    controllers.forEach(c => c.closes(this))
    return this
  }
  closes(...controllers) {
    for (const c of controllers) {
      this.onClose(() => c.close(), c?.signal)
    }
    return this
  }
  get closed() {
    return this.signal.aborted
  }
}
// Controller:1 ends here

// [[file:../book/v2.org::*Concretely][Concretely:1]]
export function msg(data = {}) {
  return new Msg().merge(data)
}

export class Msg extends Controller {
  data = {}
  caps = {}
  constructor() {
    super()
    this.onClose(() => {
      this.delete(this.keys)
      this.revokeCaps(this.capKeys)
    })
  }

  get keys() {
    return Object.keys(this.data)
  }

  get capKeys() {
    return Object.keys(this.caps)
  }

  // pure access
  get(keys) {
    return get(this.data, keys)
  }

  has(keys) {
    return has(this.data, keys)
  }

  pick(keys) {
    return pick(this.data, keys)
  }

  // mutating methods
  delete(keys) {
    remove(this.data, keys)
    return this
  }

  defaults(defaultsObj) {
    defaults(this.data, defaultsObj)
    return this
  }

  merge(data) {
    merge(this.data, data)
    return this
  }

  // pure cap methods
  capableOf(keys) {
    return has(this.caps, keys)
  }

  invoke(spelling, arg = new Msg()) {
    this.caps?.[spelling]?.(arg)
    return this
  }

  send(msg) {
    return this.invoke('send', msg)
  }

  // mutating cap methods
  revokeCaps(keys) {
    remove(this.caps, keys)
    return this
  }

  defaultCaps(defaultsObj) {
    if (!Object.values(defaultsObj).every(is.fn)) {
      throw failure('defaultCaps: requires all values to be a fn')
    }
    defaults(this.caps, defaultsObj)
    return this
  }

  grantCaps(caps) {
    if (!Object.values(caps).every(is.fn)) {
      throw failure('grantCaps: requires all values to be a fn')
    }
    merge(this.caps, caps)
    return this
  }

  // message manipulation
  copy(data = {}) {
    return new Msg().defaults(this.data).defaultCaps(this.caps).merge(data)
  }

  do(fn, ...args) {
    return fn(this, ...args)
  }

  map(fn, ...args) {
    return fn(this.copy(), ...args)
  }

  with(fn, ...args) {
    return fn(...args, this)
  }

  // lifecycle
  child() {
    return new Msg().closedBy(this)
  }
}
// Concretely:1 ends here

// [[file:../book/v2.org::*Port implementation][Port implementation:1]]
export function port(size = Infinity) {
  const buffer = [],
    waiters = []
  const description = 'I am a port. I support buffered communication.'
  function recv() {
    if (buffer.length > 0) return Promise.resolve(buffer.shift())
    if (m.closed) return Promise.resolve(EOF)
    return new Promise(resolve => waiters.push(resolve))
  }
  const m = new Msg()
  m.defaults({ description })
    .grantCaps({
      send: msg => {
        if (is.eof(msg)) throw failure('Bassline EOF is reserved')
        // resolve the promise if we have a waiter
        if (waiters.length > 0) return waiters.shift()(msg)
        // drop a message if we are over capabity
        if (buffer.length >= size) buffer.shift()
        // add the message to the buffer if we have capacity
        if (size > 0) buffer.push(msg)
      },
      close: () => m.close(),
    })
    .onClose(() => {
      for (const w of waiters) w(EOF)
      waiters.length = 0
    })
  return [m, recv]
}
// Port implementation:1 ends here

// [[file:../book/v2.org::*Propagator][Propagator:1]]
export function propagator(fn = (v, p) => p(v)) {
  const description = 'I am a propagator. I am a reactive inference machine.'
  const targets = new Set()
  const propagate = value => targets.forEach(t => t(value))
  const to = (...dests) => {
    dests.forEach(d => targets.add(d))
    return () => dests.forEach(d => targets.delete(d))
  }

  const m = new Msg()
  m.defaults({ description })
    .grantCaps({
      send: val => {
        Promise.resolve(fn(val, propagate)).catch(e => {
          throw e
        })
      },
      close: m.close,
    })
    .onClose(() => targets.clear())

  return [m, to]
}
// Propagator:1 ends here

// [[file:../book/v2.org::*Cell][Cell:1]]
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
// Cell:1 ends here

// [[file:../book/v2.org::*Consume][Consume:1]]
export function consume(recv, callback) {
  const description = `\
I am a consumed port.
Internally I am a propagator driven by a port's recv.`

  const [prop, to] = propagator(callback)
  prop.merge({ description })

  const promise = (async () => {
    const closed = new Promise(resolve => prop.onClose(() => resolve(EOF)))
    while (!prop.closed) {
      const msg = await Promise.race([recv(), closed])
      if (is.eof(msg)) break
      prop.invoke('send', msg)
    }
    prop.close()
  })()

  return [prop, { to, promise }]
}
// Consume:1 ends here

// [[file:../book/v2.org::*Net][Net:1]]
export function net() {
  const description = `\
I am a net.
I implement seamless multi-party communication.`
  const ports = new Set()
  const netm = new Msg()

  netm.defaults({ description }).grantCaps({
    send: msg => ports.forEach(p => p.send(msg)),
    close: netm.close,
  })

  const join = size => {
    const [fromNet, recv] = port(size)
    const toNet = fromNet.copy().grantCaps({
      send: msg => {
        for (const p of ports) {
          if (p === fromNet) continue
          p.send(msg)
        }
      },
    })

    ports.add(fromNet)
    fromNet
      .closedBy(netm)
      .closeGroup(toNet)
      .onClose(() => ports.delete(fromNet))

    return [toNet, recv]
  }

  return [netm, join]
}
// Net:1 ends here
