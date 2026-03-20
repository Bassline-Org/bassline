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

export async function consume(recv, callback) {
  let msg
  while (true) {
    msg = await recv()
    if (isEOF(msg)) break
    await callback(msg)
  }
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
  return join
}

export const clock = (ms = 1000) => {
  const p = port(1)
  const tick = () => p.send({ ts: Date.now() })
  const interval = setInterval(tick, ms)
  tick()
  return {
    recv: p.recv,
    close: () => {
      clearInterval(interval)
      p.close()
    },
  }
}
