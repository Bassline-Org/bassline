import readline from 'node:readline'
import { connect } from '../../src/transports/socket.js'
import { message } from '../../src/messages.js'

const endpoint = process.argv[2]

const [read, write] = connect({ path: endpoint ?? '/tmp/bl-demo.sock' })

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '>' })

rl.prompt()

rl.on('line', line => {
  if (line.trim()) write.send(message(line.trim()))
  rl.prompt()
})
rl.on('close', write.close)

read
  .sink(msg => {
    process.stdout.clearLine(0)
    process.stdout.cursorTo(0)
    console.log(JSON.stringify(msg))
    rl.prompt()
  })
  .finally(() => rl.close())
