import readline from 'node:readline'
import { port } from '../bassline.js'
import defaultFrame from '../frame/jsonl.js'

export function fromStdio(frame = defaultFrame) {
  const raw = port()
  const msgs = port()
  const rl = readline.createInterface({ input: process.stdin })

  const { ctl, close } = raw
  const { recv } = msgs
  const send = msg => process.stdout.write(frame.format(msg))

  ctl.closes(msgs, rl)

  rl.on('line', line => raw.send(line + '\n'))
  rl.on('close', () => raw.close())

  frame.read(raw.recv).to(msgs.send)

  return { recv, send, ctl, close }
}
