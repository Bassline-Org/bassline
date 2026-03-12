export const ERR = Symbol.for('channel.err')
export const WAITING = Symbol.for('channel.waiting')
export const CLOSED = Symbol.for('channel.closed')

export function channel() {
  const queue = []
  const waiters = []
  let state = WAITING
  let consumed = false
  let error = null

  function write(value) {
    if (state === CLOSED || state === ERR) return
    if (waiters.length > 0) waiters.shift().resolve({ value, done: false })
    else queue.push(value)
  }

  function close() {
    state = CLOSED
    for (const w of waiters) w.resolve({ value: undefined, done: true })
    waiters.length = 0
  }

  function err(e) {
    state = ERR
    error = e
    if (queue.length === 0) {
      for (const w of waiters) w.reject(e)
      waiters.length = 0
    }
  }

  function consume() {
    if (consumed) throw new Error('cannot consume a channel multiple times!')
    consumed = true
    return {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          if (queue.length > 0) return Promise.resolve({ value: queue.shift(), done: false })
          if (state === ERR) return Promise.reject(error)
          if (state === CLOSED) return Promise.resolve({ value: undefined, done: true })
          return new Promise((resolve, reject) => waiters.push({ resolve, reject }))
        },
        return: () => {
          close()
          return Promise.resolve({ value: undefined, done: true })
        },
      }),
    }
  }

  const send = (...values) => values.forEach(v => write(v))

  const reader = {
    consume,
    sink: fn => sink(reader, fn),
    map: fn => map(reader, fn),
    filter: fn => filter(reader, fn),
    tee: count => tee(reader, count),
    take: n => take(reader, n),
    scan: (fn, seed) => scan(reader, fn, seed),
    tap: fn => reader.map(v => (fn(v), v)),
    thru: cb => cb(reader),
    merge: readers => merge([reader, ...readers])
  }
  const writer = {
    send,
    close,
    err,
  }
  return [reader, writer]
}
export async function sink(reader, fn) {
  for await (const val of reader.consume()) {
    await fn(val)
  }
}
export function map(reader, fn) {
  const [out, writer] = channel()
  reader
    .sink(async v => writer.send(await fn(v)))
    .then(writer.close)
    .catch(writer.err)
  return out
}
export function filter(reader, fn) {
  const [out, writer] = channel()
  reader
    .sink(async v => {
      if (await fn(v)) writer.send(v)
    })
    .then(writer.close)
    .catch(writer.err)
  return out
}
export function tee(reader, count = 2) {
  const channels = []
  for (let i = 0; i < count; i++) channels.push(channel())
  reader
    .sink(v => channels.forEach(([read, write]) => write.send(v)))
    .then(() => channels.forEach(([_, write]) => write.close()))
    .catch(e => channels.forEach(([_, write]) => write.err(e)))
  return channels.map(([read, write]) => read)
}
export function take(reader, n = 10) {
  if (typeof n !== 'number' || n < 1) throw new Error('invalid take: ' + n)
  const [out, writer] = channel()
  ;(async () => {
    try {
      let count = 0
      for await (const v of reader.consume()) {
        writer.send(v)
        if (++count >= n) break
      }
      writer.close()
    } catch (e) {
      writer.err(e)
    }
  })()
  return out
}
export function scan(reader, fn, seed) {
  const [out, write] = channel()
  let last = seed
  reader
    .sink(async v => {
      last = await fn(last, v)
      write.send(last)
    })
    .then(write.close)
    .catch(write.err)
  return out
}
export function merge(readers) {
  const [out, write] = channel()
  Promise.all(readers.map(r => r.sink(write.send)))
         .then(write.close)
         .catch(write.err);
  return out
}
