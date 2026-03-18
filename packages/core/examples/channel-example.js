import { channel, merge } from '../src/channel.js'

const timeout = ms => new Promise(res => setTimeout(res, ms))

export const debounce =
  (ms = 300) =>
  reader =>
    reader.map(async v => {
      await timeout(ms)
      return v
    })

export const dedup = (diff, seed) => reader => {
  const compare = diff ?? ((acc, curr) => acc !== curr)
  let last = seed
  return reader.filter(async v => {
    const res = await compare(last, v)
    if (res) {
      last = v
    }
    return res
  })
}

export const max =
  (seed = 0) =>
  reader =>
    reader
      .filter(v => typeof v === 'number')
      .scan((acc, curr) => (acc > curr ? acc : curr), seed)
      .thru(dedup(null, seed))

const [r, w] = channel()
w.send(1, 2, 3, 4, 5, 6, 7, 7, 7, 7, 8, 9, 10)
w.close()

let count = 0
await merge(r.tee(100))
  .tap(() => count++)
  .thru(max())
  .sink(console.log)

console.log(count)
