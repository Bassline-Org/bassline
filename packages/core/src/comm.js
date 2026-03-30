export const EOF = Symbol.for('$$BASSLINE_EOF$$')
export const isEOF = v => v === EOF
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
    if (isEOF(msg)) throw new Error('Bassline EOF is reserved')
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
  const targets = new Set()
  let closed = false
  const propagate = value => targets.forEach(t => t(value))
  async function send(value) {
    if (closed) return
    await fn(value, propagate)
  }
  function to(...dests) {
    dests.forEach(d => targets.add(d))
    return () => dests.forEach(d => targets.delete(d))
  }
  function close() {
    closed = true
    targets.clear()
  }
  return { send, to, close }
}

function defaultCell(current, incoming, update) {
  if (current !== incoming) update(incoming)
}
export function cell(merge = defaultCell, init = undefined) {
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
      if (isEOF(msg)) break
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
  const p = port(1)
  const tick = () => p.send({ ts: Date.now() })
  const interval = setInterval(tick, ms)
  if (eager) tick()
  return {
    recv: p.recv,
    close: () => {
      clearInterval(interval)
      p.close()
    },
  }
}
