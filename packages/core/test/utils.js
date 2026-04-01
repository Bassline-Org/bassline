import { port, cell, consume } from '../src/bassline.js'

export async function collect(recv) {
  const c = cell((current, incoming, update) => update([...current, incoming]), [])
  const prop = consume(recv, c.send)
  await prop.promise
  return c.value()
}

export function filledPort(values) {
  const p = port()
  values.forEach(p.send)
  p.close()
  return p
}
