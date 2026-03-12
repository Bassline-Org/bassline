import { channel, merge } from "./actors.js"

const timeout = ms => new Promise(res => setTimeout(res, ms))

const debounce = (reader, ms = 300) => reader.map(async v => {
  await timeout(ms);
  return v
})

const dedup = (diff, seed) => reader => {
  const compare = diff ?? ((acc, curr) => acc !== curr);
  let last = seed;
  return reader.filter(async v => {
    const res = await compare(last, v)
    if(res) {
      last = v
    }
    return res
  })
}

const max = (reader, seed = 0) => reader
      .filter(v => typeof v === 'number')
      .scan((acc, curr) => acc > curr ? acc : curr, seed)
      .thru(dedup(null, seed))

const log = v => console.log('log: ', v)

const [r, w] = channel()
w.send(1,2,3,4,5,6,7,7,7,7,8,9,10);
w.close()

let count = 0;
await merge(r.tee(100))
  .tap(() => count++)
  .thru(max)
  .sink(console.log)

console.log(count)
