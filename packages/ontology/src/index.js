import { isEOF, consume } from '@bassline/core'

export const guard = schema => msg => schema.safeParse(msg).success

export async function request(join, msg, match) {
  const slot = join()
  try {
    slot.send(msg)
    while (true) {
      const m = await slot.recv()
      if (isEOF(m)) return null
      if (match(m)) return m
    }
  } finally {
    slot.close()
  }
}

export async function query(join, msg, match) {
  const qid = crypto.randomUUID()
  return request(join, { ...msg, qid }, m => match(m, qid))
}

export function dispatch(recv, handlers) {
  consume(recv, async msg => {
    for (const [guard, handler] of handlers) {
      if (guard(msg)) {
        await handler(msg)
        return
      }
    }
  })
}
