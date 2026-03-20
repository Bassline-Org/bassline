export type Predicate<T> = (value: T) => boolean | Promise<boolean>
export type Refinement<T, S extends T> = (value: T) => value is S

export interface Reader<T = unknown> {
  consume(): AsyncIterable<T>
  thru<R>(cb: (reader: Reader<T>) => R): R
  sink(fn: ((value: T) => void | Promise<void>) | Writer<T>): Promise<void>
  map<U>(fn: (value: T) => U | Promise<U>): Reader<U>
  filter<S extends T>(fn: Refinement<T, S>): Reader<S>
  filter(fn: Predicate<T>): Reader<T>
  guard<S extends T>(
    predicate: Refinement<T, S>,
    ifFalse?: (value: Exclude<T, S>, writer: Writer<S>) => void | Promise<void>
  ): Reader<S>
  guard(
    predicate: Predicate<T>,
    ifFalse?: (value: T, writer: Writer<T>) => void | Promise<void>
  ): Reader<T>
  gate<S extends T>(
    predicate: Refinement<T, S>,
    ifTrue?: (value: S) => void | Promise<void>
  ): Reader<Exclude<T, S>>
  gate(
    predicate: Predicate<T>,
    ifTrue?: (value: T) => void | Promise<void>
  ): Reader<T>
  tee(count?: number): Reader<T>[]
  take(n?: number): Reader<T>
  scan<U>(fn: (acc: U, value: T) => U | Promise<U>, seed: U): Reader<U>
  tap(fn: (value: T) => void): Reader<T>
  fork(cb: (reader: Reader<T>) => void): Reader<T>
  merge(readers: Reader<T>[]): Reader<T>
}

export interface Writer<T = unknown> {
  send(...values: T[]): void
  close(): void
  err(e: unknown): void
}

export interface Net<T = unknown> {
  join<R = Reader<T>>(): [R, Writer<T>]
  send(msg: T): void
  close(): void
  err(e: unknown): void
}

export const ERR: unique symbol
export const WAITING: unique symbol
export const CLOSED: unique symbol

export class Channel {
  queue: unknown[]
  waiters: unknown[]
  state: symbol
  consumed: boolean
  error: unknown
  write(value: unknown): void
  close(): void
  err(e: unknown): void
  consume(): AsyncIterable<unknown>
  send(...values: unknown[]): void
  reader(): Reader
  writer(): Writer
}

export class SlidingChannel extends Channel {
  constructor(size?: number)
  size: number
}

export class ClockChannel extends SlidingChannel {
  constructor(ms: number, size?: number)
  interval: ReturnType<typeof setInterval>
  writer(): { close(): void }
}

export class ConsumedChannelError extends Error {}

export function channel<T, U>(): [Reader<T>, Writer<U>]
export function slidingChannel<T = unknown>(size?: number): [Reader<T>, Writer<T>]
export function clock(ms?: number, size?: number): [Reader<number>, { close(): void }]
export function pipe<T = unknown>(cb: (reader: Reader<T>) => void, chan?: () => Channel): Writer<T>
export function nullWriter(): Writer<unknown>

export function sendAll(...writers: Writer[]): (msg: unknown) => void;
export function closeAll(...writers: Writer[]): () => void;
export function errAll(...writers: Writer[]): (e: unknown) => void;

export function net<T = unknown>(chan?: () => [Reader<T>, Writer<T>]): Net<T>

export function sink<T>(reader: Reader<T>, fn: ((value: T) => void | Promise<void>) | Writer<T>): Promise<void>
export function map<T, U>(reader: Reader<T>, fn: (value: T) => U | Promise<U>): Reader<U>

export function filter<T, S extends T>(reader: Reader<T>, fn: Refinement<T, S>): Reader<S>
export function filter<T>(reader: Reader<T>, fn: Predicate<T>): Reader<T>

export function guard<T, S extends T>(
  reader: Reader<T>,
  predicate: Refinement<T, S>,
  ifFalse?: (value: Exclude<T, S>, writer: Writer<S>) => void | Promise<void>
): Reader<S>
export function guard<T>(
  reader: Reader<T>,
  predicate: Predicate<T>,
  ifFalse?: (value: T, writer: Writer<T>) => void | Promise<void>
): Reader<T>

export function gate<T, S extends T>(
  reader: Reader<T>,
  predicate: Refinement<T, S>,
  ifTrue?: (value: S) => void | Promise<void>
): Reader<Exclude<T, S>>
export function gate<T>(
  reader: Reader<T>,
  predicate: Predicate<T>,
  ifTrue?: (value: T) => void | Promise<void>
): Reader<T>
export function tee<T>(reader: Reader<T>, count?: number): Reader<T>[]
export function take<T>(reader: Reader<T>, n?: number): Reader<T>
export function scan<T, U>(reader: Reader<T>, fn: (acc: U, value: T) => U | Promise<U>, seed: U): Reader<U>
export function merge<T>(readers: Reader<T>[]): Reader<T>
export function fork<T>(reader: Reader<T>, cb: (reader: Reader<T>) => void): Reader<T>

export type Bridge<A, B> = (reader: Reader<A>, writer: Writer<B>) => void

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

export function isArray(x: unknown): x is unknown[]
export function isNil(x: unknown): x is null | undefined
export function isPromise(x: unknown): x is Promise<unknown>
export function isNumber(x: unknown): x is number
export function isString(x: unknown): x is string
export function isFunction(x: unknown): x is Function
export function isPlainObject(x: unknown): x is Record<string, unknown>
export function isNull(x: unknown): x is null
export function hasKeys<const K extends readonly string[]>(
  obj: unknown,
  keys: K
): obj is Record<K[number], unknown>
export function castArr<T>(x: T | T[]): T[]

export function fromWebSocket(ws: unknown): [Reader<Message>, Writer]
export function fromPort(port: unknown): [Reader<Message>, Writer]

export function readFrame(reader: Reader<string>): Reader<Message>
export function format(msg: unknown): string