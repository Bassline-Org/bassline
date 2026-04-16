import readline from 'node:readline'
import { port, createController } from '../bassline.js'
import defaultFrame from '../frame/jsonl.js'

export function fromStdio(frame = defaultFrame) {
  const { ctl, close } = createController()
  const raw = port()
  const msgs = port()
  const rl = readline.createInterface({ input: process.stdin })

  const send = ctl.fn(msg => process.stdout.write(frame.format(msg)))

  ctl.closes(raw, msgs, rl)

  rl.on('line', line => raw.send(line + '\n'))
  rl.on('close', close)
  frame.read(raw.recv).to(msgs.send)

  return { recv: msgs.recv, send, ctl, close }
}
