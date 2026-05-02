import readline from 'node:readline'
import { port, msg } from '../bassline.js'
import defaultFrame from '../frame/jsonl.js'

const description = 'I am a stdio port'

export function fromStdio(frame = defaultFrame) {
  const rl = readline.createInterface({ input: process.stdin })

  const [reader, onRead] = frame.reader()
  const [msgs, recv] = port()

  onRead(v => msgs.send(v))

  const outgoing = msg({ description }).grant('send', m =>
    process.stdout.write(frame.format(m))
  )

  outgoing.ctl.closes(msgs, rl, reader)

  rl.on('line', line => reader.send(msg({ scalar: line + '\n' })))
  rl.on('close', () => outgoing.close())
  return [outgoing, recv]
}
