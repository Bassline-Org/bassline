export const EOF: unique symbol
export function isEOF(v: unknown): v is typeof EOF

export type Message<T = unknown> = Record<string, unknown> & T
export type Cap<K extends symbol> = { [key in K]: Send }
export type Propagator<T, K> = {
  send: Send<T>,
  close: Close,
  to: (...dests: Send<K>[]) => () => void
}
export type Cell<T, K> = Propagator<T, K> & { value: () => K }
export type Propagate<T, K> = (value: T, propagate: Send<K>) => void | Promise<void>
export type Merge<T, K> = (current: K, incoming: T, propagate: Send<K>) => void | Promise<void>

export type Port<T = Message, K = T> = {
  send: Send<T>
  recv: Recv<K>
  close: Close
}

export type Send<T = Message> = (msg: T) => void
export type Recv<T = Message> = () => Promise<T | typeof EOF>
export type Close = () => void

export type NetJoin<T, K> = {
  (size?: number): Port<T, K>
  close: Close
  send: Send<T>
}

export function port<T = Message, K = T>(size?: number): Port<T, K>
export function net<T = Message, K = T>(): NetJoin<T, K>
export function clock(ms?: number): Omit<Port<{ts: number}>, 'send'>
export function propagator<In = Message, Out = In>(
  fn?: Propagate<In, Out>
): Propagator<In, Out>
export function cell<In = Message, State = In>(
  fn?: Merge<In, State>,
  init: State
): Cell<In, State>


export function consume<T = Message>(
  recv: Recv<T>,
  callback: Send<T>
): Promise<void>

export function message(): Message
export function message(content: undefined): Message
export function message<T extends Message>(content: T): Message<T>
export function message<T>(content: T): Message<{ body: T }>

type Mapping<T, U = T> = (msg: T) => U

export function update<T, U>(
  fn: Mapping<T, U>
): Mapping<T, Message<U>>
export function update<T, U>(
  msg: T,
  fn: Mapping<T, U>
): Message<U>

export function subst(msg: Message<{let: Message, in: Message}>): Message

// --- Capabilities ---

export function hasCap<K extends symbol>(msg: Message, name: K): msg is Message & Cap<K>

export type OfferHandlers = Record<symbol, Send>
export type AcceptHandlers = Record<symbol, (cap: Send, msg: Message) => void | Promise<void>>

export function offer(dest: Send, handlers: OfferHandlers): Send
export function accept(handlers: AcceptHandlers): Send

export function isEmpty(msg: Message): msg is {}
export class Fault extends Error {
  condition: string
  msg: unknown
  context: unknown
  constructor(condition: string, msg?: unknown, context?: unknown)
  toMessage(): Message<Pick<Fault, 'condition' | 'msg' | 'context'>>
}
export function fault(condition: string, msg?: unknown, context?: unknown): Fault

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
export function delay(ms: number): Promise<void>

// --- Transports ---

export function fromWebSocket(ws: unknown): Port<Message>
export function fromPort(port: unknown): Port<Message>

// --- Framing ---

export function readFrame(recv: () => Promise<unknown>, send: (msg: Message) => void): void
export function format(msg: unknown): string
