import readline from 'node:readline'
import { connect } from '../../src/transports/socket.js'
import { message } from '../../src/messages.js'

const [read, write] = connect({ path: '/tmp/bl-demo.sock' })
const id = `cli-${process.pid}`

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' })

console.log(`connected as ${id}`)
rl.prompt()

rl.on('line', line => {
  if (line.trim()) write.send(message({ from: id, body: line.trim() }))
  rl.prompt()
})
rl.on('close', write.close)

read.sink(msg => {
  process.stdout.clearLine(0)
  process.stdout.cursorTo(0)
  console.log(JSON.stringify(msg))
  rl.prompt()
})
