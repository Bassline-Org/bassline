/**
 * The data plane of a message. Plain string-keyed values.
 * Also the wire form when caps are reified.
 */
export type RawMessage<T = unknown> = Record<string, unknown> & T

export type Send<T = Msg> = (arg: T) => void
export type Recv<T = Msg> = () => Promise<T | typeof EOF>
export type Close = (reason?: string) => void

export interface CacheLike {
  storeCap(
    msg: Msg<unknown, unknown>,
    spelling: string,
    send: Send<unknown>
  ): unknown
}

export interface Ctl {
  closed: boolean
  signal: AbortSignal
  onClose(fn: () => void, signal?: AbortSignal): void
  closes(...controllers: Array<{ close: Close }>): void
}
export function createController(): { close: Close; ctl: Ctl }

export type Data = Record<string, unknown>
export type Caps = Record<string, Send<unknown>>
export type CapMap<T> = Map<keyof T, T[keyof T]>

export class Msg<D extends Data = {}, C extends Caps = {}> {
  data: D
  caps: Map<keyof C, C[keyof C]>

  constructor(data?: D, caps?: C)

   // lifecycle
  ctl: Ctl
  close: Close
  get closed(): boolean
  closes(...targets: { close: Close }[]): this
  onClose(fn): this

  //data access
  get<K extends keyof D>(key: K): D[K]
  get<K extends keyof D>(keys: K[]): Array<D[K]>

  delete<K extends string>(key: K): Msg<Omit<D, K>, C>
  delete<K extends string>(keys: K[]): Msg<Omit<D, K>, C>

  has(key: string): boolean
  has(keys: string[]): boolean
  get keys(): Array<keyof D>
  
  merge<T extends Data>(data: T): Msg<D & T, C>
  // cap access
  hasCap(key: string): boolean
  hasCap(keys: readonly string[]): boolean

  revoke<K extends keyof C & string>(spelling: K): Msg<D, Omit<C, K>>
  revoke<K extends keyof C & string>(spelling: K[]): Msg<D, Omit<C, K>>
  
  revoke(spelling: string): this

  grant<K extends string, F extends Send>(
    spelling: K,
    fn: F
  ): Msg<D, C & { [k in K]: F }>
  grantAll<T extends Caps>(obj: T): Msg<D, C & T>
  invoke<K extends keyof C>(spelling: K, arg?: Parameters<C[K]>[0]): this
  invoke(spelling: string, arg?: unknown): this
  send(msg?: unknown): this

  // manipulation
  copy<T extends Data>(data?: T): Msg<D & T, C>
  map<T>(fn: (aMsg: this) => T): T
  do<T>(fn: (aMsg: this) => T): T
  shareWith<MD extends Data, MC extends Caps>(aMsg: Msg<MD, MC>): Msg<D & MD, C & MC>
  eat<MD extends Data, MC extends Caps>(aMsg: Msg<MD, MC>): Msg<D & MD, C & MC>
  // predicates
  conforms(description: unknown): boolean
}

export function msg<D extends Data, C extends Caps>(
  data?: D,
  caps?: C
): Msg<D, C>

export function port<T = unknown>(
  size?: number
): readonly [
  Msg<{ description: string }, { send: Send<T>; close: Close }>,
  Recv<T>,
]

export type PropagateFn<In = Msg, Out = In> =
  | ((value: In, propagate: Send<Out>) => void | Promise<void>)
  | ((value: In) => void | Promise<void>)

export function propagator<T = Msg>(): readonly [
  Msg<{ description: string }, { send: Send<T>; close: Close }>,
  (...dests: Send<T>[]) => () => void,
]

export function propagator<In = unknown, Out = In>(
  fn: PropagateFn<In, Out>
): readonly [
  Msg<{ description: string }, { send: Send<In>; close: Close }>,
  (...dests: Send<Out>[]) => () => void,
]

export type Merge<In, State> = (
  current: State,
  incoming: In,
  propagate: (state: State) => void
) => void

export function cell<In = Msg, State = In>(
  merge: Merge<In, State>,
  init: State
): readonly [
  Msg<{ description: string }, { send: Send<In>; close: Close }>,
  {
    to: (...dests: Send<State>[]) => () => void
    value: () => State
  },
]

export function consume<T = Msg>(
  recv: Recv<T>
): readonly [
  Msg<{ description: string }, { send: Send<T>; close: Close }>,
  {
    to: (...dests: Send<T>[]) => () => void
    promise: Promise<void>
  },
]
export function consume<In = Msg, Out = In>(
  recv: Recv<In>,
  callback: PropagateFn<In, Out>
): readonly [
  Msg<{ description: string }, { send: Send<In>; close: Close }>,
  {
    to: (...dests: Send<Out>[]) => () => void
    promise: Promise<void>
  },
]

export function net<T = Msg>(): readonly [
  Msg<{ description: string }, { send: Send<T>; close: Close }>,
  (
    size?: number
  ) => readonly [
    Msg<{ description: string }, { send: Send<T>; close: Close }>,
    Recv<T>,
  ],
]

export const EOF: unique symbol

type Shaped<T> = (value: unknown) => value is T
type Scalar = string | number | null | symbol | boolean
type Predicate<T = unknown> = (v: T) => boolean

export const is: {
  eof: Shaped<typeof EOF>
  nil: Shaped<null | undefined>
  null: Shaped<null>
  undefined: Shaped<undefined>
  promise: Shaped<Promise<unknown>>
  boolean: Shaped<boolean>
  number: Shaped<number>
  string: Shaped<string>
  fn: Shaped<Function>
  symbol: Shaped<symbol>
  array: Shaped<readonly unknown[]>
  object: Shaped<object>
  msg: Shaped<Msg>
  scalar: Shaped<Scalar>
}

export function delay(ms?: number): Promise<void>

export class AssertionFailure extends Error {}
export function failure(msg: string): AssertionFailure

type ConformDescription = Record<string, Scalar | Predicate>
export function satisfiesAll(preds: Predicate[]): Predicate
export function conforms<T>(
  description: {[K in string]: Predicate}
): Predicate<T>

export function invariants<T = unknown>(
  preds: ReadonlyArray<
    readonly [
      Predicate<T>,
      string | ((v: T) => string)
    ]
  >
): {
  (value: T): T
  test(value: T): boolean
}