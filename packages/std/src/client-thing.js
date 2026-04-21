import { factotum, persistFile } from './exchange.js'

const { cache, materialize, close, live } = factotum(
  persistFile('/tmp/records.json')
)

const conn = materialize({
  kind: 'connect:id',
  id: '95d1f64d-0c4a-4e13-937e-554e89f57602',
})

const _mod = await materialize({ kind: 'connect:id', id: 'some-module' })

conn.send({ kind: 'factotum:sync', cache })
conn.send({ kind: 'connect:id', id: 'some-module' })
console.log(conn)

console.log(live)

process.on('SIGINT', exit)
process.on('SIGTERM', exit)

function exit() {
  close()
  process.exit(0)
}
