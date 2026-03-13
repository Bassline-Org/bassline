import { fault } from './messages.js'

export const ERR = Symbol.for('channel.err')
export const WAITING = Symbol.for('channel.waiting')
export const CLOSED = Symbol.for('channel.closed')

export class ConsumedChannelError extends Error {
  constructor() {
    super('Cannot consume a channel more than once!')
  }
}

export class Channel {
  queue = []
  waiters = []
  state = WAITING
  consumed = false
  error = null

  write(value) {
    if (this.state === CLOSED || this.state === ERR) return
    if (this.waiters.length > 0) this.waiters.shift().resolve({ value, done: false })
    else this.queue.push(value)
  }
  close() {
    if (this.state !== WAITING) return
    this.state = CLOSED
    for (const w of this.waiters) w.resolve({ value: undefined, done: true })
    this.waiters.length = 0
  }
  err(e) {
    if (this.state !== WAITING) return
    this.state = ERR
    this.error = e
    if (this.queue.length === 0) {
      for (const w of this.waiters) w.reject(e)
      this.waiters.length = 0
    }
  }
  consume() {
    if (this.consumed) throw new ConsumedChannelError()
    this.consumed = true
    return {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          if (this.queue.length > 0) return Promise.resolve({ value: this.queue.shift(), done: false })
          if (this.state === ERR) return Promise.reject(this.error)
          if (this.state === CLOSED) return Promise.resolve({ value: undefined, done: true })
          return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }))
        },
        return: value => {
          this.close()
          return Promise.resolve({ value, done: true })
        },
        throw: e => {
          this.err(e)
          return Promise.resolve({ value: e, done: true })
        },
      }),
    }
  }
  send(...values) {
    values.forEach(v => this.write(v))
  }
  reader() {
    const reader = {
      consume: () => this.consume(),
      sink: fn => sink(reader, fn),
      map: fn => map(reader, fn),
      filter: fn => filter(reader, fn),
      guard: (pred, cb) => guard(reader, pred, cb),
      tee: count => tee(reader, count),
      take: n => take(reader, n),
      scan: (fn, seed) => scan(reader, fn, seed),
      tap: fn => reader.map(v => (fn(v), v)),
      thru: cb => cb(reader),
      merge: readers => merge([reader, ...readers]),
    }
    return reader
  }
  writer() {
    const writer = {
      send: (...values) => this.send(...values),
      close: () => this.close(),
      err: e => this.err(e),
    }
    return writer
  }
}

export class SlidingChannel extends Channel {
  constructor(size = 1) {
    super()
    this.size = size
  }
  write(value) {
    if (this.state === CLOSED || this.state === ERR) return
    if (this.waiters.length > 0) this.waiters.shift().resolve({ value, done: false })
    else {
      while (this.queue.length >= this.size) this.queue.shift()
      this.queue.push(value)
    }
  }
}

export class ClockChannel extends SlidingChannel {
  constructor(ms, size = 1) {
    super(size)
    this.interval = setInterval(() => this.write(Date.now()), ms)
  }
  close() {
    clearInterval(this.interval)
    super.close()
  }
  err(e) {
    clearInterval(this.interval)
    super.err(e)
  }
  writer() {
    const w = super.writer()
    return { close: w.close }
  }
}

export const channel = () => {
  const chan = new Channel()
  return [chan.reader(), chan.writer()]
}

export const slidingChannel = (size = 1) => {
  const chan = new SlidingChannel(size)
  return [chan.reader(), chan.writer()]
}

export const clock = (ms = 1000, size = 1) => {
  const chan = new ClockChannel(ms, size)
  return [chan.reader(), chan.writer()]
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

const defaultGuard = (value, _writer) => fault('guard clause failed, exiting', value)

export function guard(reader, predicate, ifFalse = defaultGuard) {
  const [out, writer] = channel()
  reader
    .sink(async v => {
      if (await predicate(v)) writer.send(v)
      else await ifFalse(v, writer)
    })
    .then(writer.close)
    .catch(writer.err)
  return out
}

export function filter(reader, fn) {
  return guard(reader, fn, () => {})
}

export function tee(reader, count = 2) {
  const channels = []
  for (let i = 0; i < count; i++) channels.push(channel())
  reader
    .sink(v => channels.forEach(([_, write]) => write.send(v)))
    .then(() => channels.forEach(([_, write]) => write.close()))
    .catch(e => channels.forEach(([_, write]) => write.err(e)))
  return channels.map(([read, _]) => read)
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
    .catch(write.err)
  return out
}
