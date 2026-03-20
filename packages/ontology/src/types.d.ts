import type { z } from 'zod'
import type { Port, EOF } from '@bassline/core'

export function guard<T>(schema: z.ZodType<T>): (msg: unknown) => msg is T

export function request<Res>(
  join: (size?: number) => Port,
  msg: Record<string, unknown>,
  match: (msg: unknown) => msg is Res
): Promise<Res | null>

export function query<Res>(
  join: (size?: number) => Port,
  msg: Record<string, unknown>,
  match: (msg: unknown, qid: string) => msg is Res
): Promise<Res | null>

export function dispatch<T>(
  recv: () => Promise<T | typeof EOF>,
  handlers: Array<[(msg: unknown) => boolean, (msg: any) => void | Promise<void>]>
): void
