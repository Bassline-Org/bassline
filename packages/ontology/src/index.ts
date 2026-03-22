import type { z } from 'zod'
import type { Port, EOF } from '@bassline/core'
import { isEOF, consume } from '@bassline/core'

export function guard<T>(schema: z.ZodType<T>): (msg: unknown) => msg is T {
  return (msg: unknown): msg is T => schema.safeParse(msg).success
}

export async function request<Res>(
  join: (size?: number) => Port,
  msg: Record<string, unknown>,
  match: (msg: unknown) => msg is Res
): Promise<Res | null> {
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

export async function query<Res>(
  join: (size?: number) => Port,
  msg: Record<string, unknown>,
  match: (msg: unknown, qid: string) => msg is Res
): Promise<Res | null> {
  const qid = crypto.randomUUID()
  return request(join, { ...msg, qid }, (m): m is Res => match(m, qid))
}

export function dispatch<T>(
  recv: () => Promise<T | typeof EOF>,
  handlers: Array<[(msg: unknown) => boolean, (msg: any) => void | Promise<void>]>
): void {
  consume(recv, async (msg: T) => {
    for (const [guard, handler] of handlers) {
      if (guard(msg)) {
        await handler(msg)
        return
      }
    }
  })
}

export * from './property-graph/index.js'
