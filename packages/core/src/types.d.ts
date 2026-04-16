export const EOF: symbol

type Shaped<T> = (value: unknown) => value is T
export const is: {
  eof: Shaped<typeof EOF>
  nil: Shaped<null | undefined>
  null: Shaped<null>
  undefined: Shaped<undefined>
  defined: Shaped<Exclude<unknown, undefined>>
  promise: Shaped<Promise<unknown>>
  number: Shaped<number>
  string: Shaped<string>
  fn: Shaped<Function>
  symbol: Shaped<Symbol>
  array: Shaped<Array<unknown>>
  object: Shaped<Exclude<object, null>>
  msg: Shaped<Message>
}

export function lazy<T>(fn: () => T): () => T
export interface Ctl {
  closed: boolean
  signal: AbortSignal
  cap<T>(fn: T): Revocable<T>
  onClose(fn: () => void, signal?: AbortSignal): void
  closes(...controllers: Array<Ctl & { close: Close }>): void
}
export function createController(): { close: Close; ctl: Ctl }
export function cap<T>(ctl: Ctl, fn: T): Revocable<T>

export type Message<T = unknown> = Record<string, unknown> & T
export type Cap<K extends symbol> = { [key in K]: Send }
export type Propagator<T = Message, K = T> = {
  send: Send<T>
  ctl: Ctl
  close: Close
  to: (...dests: Send<K>[]) => () => void
}
export type Cell<T = Message, K = unknown> = Propagator<T, K> & {
  value: () => K
}
export type Propagate<T = Message, K = Message> = (
  value: T,
  propagate: Send<K>
) => Void
export type Merge<T, K> = (current: K, incoming: T, propagate: Send<K>) => Void

export type Port<T = Message, K = T> = {
  send: Send<T>
  recv: Recv<K>
  ctl: Ctl
  close: Close
}

export type Net<T = Message, K = T> = {
  join(size?: number): Port<T, K>
  close: Close
  ctl: Ctl
  send: Send<T>
}

export function port<T = Message, K = T>(size?: number): Port<T, K>
export function net<T = Message, K = T>(): Net<T, K>

export function propagator<T>(): Propagator<T, T>
export function propagator<In = Message, Out = In>(
  fn: PropagateFn<In, Out>
): Propagator<In, Out>

export function cell<In = Message, State = In>(
  fn?: Merge<In, State>,
  init?: State
): Cell<In, State>

export function consume<T = Message>(
  recv: Recv<T>
): { to: Propagator<T>['to']; promise: Promise<void> }
export function consume<T = Message, K = T>(
  recv: Recv<T>,
  callback: PropagateFn<T, K>
): { to: Propagator<T, K>['to']; promise: Promise<void> }

export function message(): Message
export function message(content: undefined): Message
export function message<T extends Message>(content: T): Message<T>
export function message<T>(content: T): Message<{ body: T }>

export function hasCap<K extends symbol>(
  msg: Message,
  name: K
): msg is Message & Cap<K>

export type OfferHandlers = Record<symbol, Send>
export type AcceptHandlers = Record<symbol, PropagateFn>

export function offer(handlers: OfferHandlers): Propagator
export function accept(handlers: AcceptHandlers): Propagator

export function delay(ms: number): Promise<void>

export function fromWebSocket(ws: unknown): Port<Message>
export function fromPort(port: unknown): Port<Message>
export function readFrame(
  recv: () => Promise<unknown>,
  send: (msg: Message) => void
): void
export function format(msg: unknown): string

export type Void = void | Promise<void>
export type Send<T = Message> = (msg: T) => Void
export type Recv<T = Message> = () => Promise<T | typeof EOF>
export type Close = (reason?: string) => Void
export type Revocable<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => R | undefined
  : never
