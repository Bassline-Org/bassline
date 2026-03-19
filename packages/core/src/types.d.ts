export interface Reader<T = any> {
  consume(): AsyncIterable<T>
  thru<R>(cb: (reader: Reader<T>) => R): R
  sink(fn: ((value: T) => void | Promise<void>) | Writer<T>): Promise<void>
  map<U>(fn: (value: T) => U | Promise<U>): Reader<U>
  filter(fn: (value: T) => boolean | Promise<boolean>): Reader<T>
  guard(predicate: (value: T) => boolean | Promise<boolean>, ifFalse?: (value: T, writer: Writer<T>) => void): Reader<T>
  gate(predicate: (value: T) => boolean | Promise<boolean>, ifTrue?: (value: T) => void): Reader<T>
  tee(count?: number): Reader<T>[]
  take(n?: number): Reader<T>
  scan<U>(fn: (acc: U, value: T) => U | Promise<U>, seed: U): Reader<U>
  tap(fn: (value: T) => void): Reader<T>
  fork(cb: (reader: Reader<T>) => void): Reader<T>
  merge(readers: Reader<T>[]): Reader<T>
}

export interface Writer<T = any> {
  send(...values: T[]): void
  close(): void
  err(e: any): void
}

export interface Net<T = any> {
  join<R = Reader<T>>(cb?: (reader: Reader<T>) => R): [R, Writer<T>]
  send(msg: T): void
  close(): void
  err(e: any): void
}

export const ERR: unique symbol
export const WAITING: unique symbol
export const CLOSED: unique symbol

export class Channel {
  queue: any[]
  waiters: any[]
  state: symbol
  consumed: boolean
  error: any
  write(value: any): void
  close(): void
  err(e: any): void
  consume(): AsyncIterable<any>
  send(...values: any[]): void
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

export function channel<T = any>(): [Reader<T>, Writer<T>]
export function slidingChannel<T = any>(size?: number): [Reader<T>, Writer<T>]
export function clock(ms?: number, size?: number): [Reader<number>, { close(): void }]

export function closeAll(...writers: Writer[]): void
export function errAll(e: any, ...writers: Writer[]): void

export function net<T = any>(chan?: () => [Reader<T>, Writer<T>]): Net<T>

export function sink<T>(reader: Reader<T>, fn: ((value: T) => void | Promise<void>) | Writer<T>): Promise<void>
export function map<T, U>(reader: Reader<T>, fn: (value: T) => U | Promise<U>): Reader<U>
export function filter<T>(reader: Reader<T>, fn: (value: T) => boolean | Promise<boolean>): Reader<T>
export function guard<T>(reader: Reader<T>, predicate: (value: T) => boolean | Promise<boolean>, ifFalse?: (value: T, writer: Writer<T>) => void): Reader<T>
export function gate<T>(reader: Reader<T>, predicate: (value: T) => boolean | Promise<boolean>, ifTrue?: (value: T) => void): Reader<T>
export function tee<T>(reader: Reader<T>, count?: number): Reader<T>[]
export function take<T>(reader: Reader<T>, n?: number): Reader<T>
export function scan<T, U>(reader: Reader<T>, fn: (acc: U, value: T) => U | Promise<U>, seed: U): Reader<U>
export function merge<T>(readers: Reader<T>[]): Reader<T>
export function fork<T>(reader: Reader<T>, cb: (reader: Reader<T>) => void): Reader<T>

export function message(content?: any): Record<string, any>
export function updateWith(msg: Record<string, any>, fn: (msg: Record<string, any>) => Record<string, any>): Record<string, any>
export function update(fn: (msg: Record<string, any>) => Record<string, any>): (msg: Record<string, any>) => Record<string, any>
export function update(msg: Record<string, any>, fn: (msg: Record<string, any>) => Record<string, any>): Record<string, any>
export function isEmpty(msg: Record<string, any>): boolean
export function warning(reason: string): { type: 'warning'; body: string }
export class Fault extends Error {
  condition: string
  context: any
  constructor(condition: string, msg?: string, context?: any)
}
export function fault(condition: string, msg?: string, context?: any): never

export function isArray(x: any): x is any[]
export function isNil(x: any): x is null | undefined
export function isPromise(x: any): x is Promise<any>
export function isNumber(x: any): x is number
export function isString(x: any): x is string
export function isFunction(x: any): x is Function
export function isPlainObject(x: any): x is Record<string, any>
export function hasKeys(obj: any, keys: string[]): boolean
export function castArr<T>(x: T | T[]): T[]

export function fromWebSocket(ws: any): [Reader, Writer]
export function fromPort(port: any): [Reader, Writer]

export function readFrame(reader: Reader<string>): Reader
export function format(msg: any): string
