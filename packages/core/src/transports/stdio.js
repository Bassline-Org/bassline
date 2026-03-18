import readline from 'node:readline'
import { channel } from '../channel.js'
import defaultFrame from '../frame/jsonl.js'

export function fromStdio(frame = defaultFrame) {
  const rl = readline.createInterface({ input: process.stdin })
  const [lines, lineWriter] = channel()
  rl.on('line', line => lineWriter.send(line + '\n'))
  rl.on('close', () => lineWriter.close())

  const [outgoing, outgoingWriter] = channel()
  outgoing
    .map(frame.format)
    .sink(data => process.stdout.write(data))
    .then(outgoingWriter.close)
    .catch(outgoingWriter.err)

  return [lines.thru(frame.read), outgoingWriter]
}
