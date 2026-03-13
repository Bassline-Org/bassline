import readline from 'node:readline'
import { channel } from '../channel.js'
import { readFrame, writeFrame } from '../frame/jsonl.js'

export function fromStdio() {
  const rl = readline.createInterface({ input: process.stdin })
  const [read, write] = channel()
  rl.on('line', line => write.send(line + '\n'))
  rl.on('close', () => write.close())

  const [outRead, outWrite] = channel()
  outRead
    .map(writeFrame)
    .sink(data => process.stdout.write(data))
    .then(outWrite.close)
    .catch(outWrite.err)

  return [read.thru(readFrame), outWrite]
}
