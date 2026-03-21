// --- Communication ---

export const EOF: unique symbol
export function isEOF(v: unknown): v is typeof EOF

export interface Port<T = unknown> {
  send(msg: T): void
  recv(): Promise<T | typeof EOF>
  close(): void
}

export type NetJoin<T = unknown> = {
  (size?: number): Port<T>
  close: Port<T>['close']
  send: Port<T>['send']
}

export function port<T = unknown>(size?: number): Port<T>
export function net<T = unknown>(): NetJoin<T>
export function clock(ms?: number): { recv(): Promise<{ ts: number } | typeof EOF>; close(): void }
export function consume<T>(
  recv: () => Promise<T | typeof EOF>,
  callback: (msg: T) => void | Promise<void>
): Promise<void>

// --- Messages ---

export type MessageShape = Record<string, unknown>
export type Message<T extends object = MessageShape> = MessageShape & T
type MessagePatch<T> = T extends MessageShape ? T : {}

export function message(): Message
export function message(content: undefined): Message
export function message<T extends MessageShape>(content: T): Message<T>
export function message<T>(content: T): Message<{ body: T }>

export function updateWith<T extends MessageShape, U>(
  msg: Message<T>,
  fn: (msg: Message<T>) => U
): Message<T & MessagePatch<U>>

export function update<T extends MessageShape, U>(
  fn: (msg: Message<T>) => U
): (msg: Message<T>) => Message<T & MessagePatch<U>>

export function update<T extends MessageShape, U>(
  msg: Message<T>,
  fn: (msg: Message<T>) => U
): Message<T & MessagePatch<U>>

export function isEmpty(msg: Message): msg is {}
export function warning(reason: string): Message<{ type: 'warning'; body: string }>
export class Fault extends Error {
  condition: string
  msg: unknown
  context: unknown
  constructor(condition: string, msg?: unknown, context?: unknown)
}
export function fault(condition: string, msg?: unknown, context?: unknown): never

// --- Utils ---

export function isArray(x: unknown): x is unknown[]
export function isNil(x: unknown): x is null | undefined
export function isPromise(x: unknown): x is Promise<unknown>
export function isNumber(x: unknown): x is number
export function isString(x: unknown): x is string
export function isFunction(x: unknown): x is Function
export function isPlainObject(x: unknown): x is Record<string, unknown>
export function isNull(x: unknown): x is null
export function hasKeys<const K extends readonly string[]>(obj: unknown, keys: K): obj is Record<K[number], unknown>
export function castArr<T>(x: T | T[]): T[]

// --- Transports ---

export function fromWebSocket(ws: unknown): Port<Message>
export function fromPort(port: unknown): Port<Message>

// --- Framing ---

export function readFrame(recv: () => Promise<unknown>, send: (msg: Message) => void): void
export function format(msg: unknown): string
