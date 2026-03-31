import readline from 'node:readline'
import { port } from '../bassline.js'
import defaultFrame from '../frame/jsonl.js'

export function fromStdio(frame = defaultFrame) {
  const raw = port()
  const msgs = port()
  const rl = readline.createInterface({ input: process.stdin })

  rl.on('line', line => raw.send(line + '\n'))
  rl.on('close', () => raw.close())

  frame.read(raw.recv, msgs.send)

  return {
    recv: msgs.recv,
    send: msg => process.stdout.write(frame.format(msg)),
    close: () => {
      msgs.close()
      raw.close()
      rl.close()
    },
  }
}
