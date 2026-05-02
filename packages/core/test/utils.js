import { port, consume } from '../src/bassline.js'

export async function collect(recv) {
  const values = []
  const [_, { promise }] = consume(recv, v => values.push(v))
  await promise
  return values
}

export function filledPort(values) {
  const [p, recv] = port()
  values.forEach(v => p.send(v))
  p.close()
  return [p, recv]
}
