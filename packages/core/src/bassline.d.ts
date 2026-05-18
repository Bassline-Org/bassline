export const EOF: unique symbol

type Guard<T> = (value: unknown) => value is T
export const is: {
  eof: Guard<typeof EOF>
  null: Guard<null>
  undefined: Guard<undefined>

  number: Guard<number>
  string: Guard<string>
  boolean: Guard<boolean>
  symbol: Guard<symbol>
  fn: Guard<Function>

  nan: Guard<number>
  array: Guard<unknown[]>
  arrayOf: <T>(pred: Guard<T>) => Guard<T[]>
  promise: Guard<unknown>
  msg: Guard<Msg<any, any>>

  nil: Guard<undefined | null>
  scalar: Guard<number | string | null | boolean>
  object: Guard<object>
}

export class AssertionFailure extends Error {}
export function failure(msg: string): AssertionFailure

export class Controller {
  controller: AbortController
  signal: AbortController['signal']
  get closed(): boolean
  close: (reason?: string) => this
  onClose(fn: () => void, aSignal?: AbortSignal): this

  closeGroup(...controllers: Controller[]): this
  closedBy(...controllers: Controller[]): this
  closes(...controllers: Pick<Controller, 'close'>[]): this
}

export type MsgData = Record<string, unknown>
export type MsgCaps = Record<string, AnySend>
export type Caps<K extends PropertyKey> = Record<K, AnySend>
export type WithCaps<C extends MsgCaps> = Msg<MsgData, C>
export type Send<M extends Msg = Msg> = (msg: M) => void
type AnySend = (msg: Msg<any, any>) => void
export type MsgOf<S> = S extends Send<infer M> ? M : Msg

type AnyFn = (...args: any[]) => any
type With<F extends AnyFn, M extends Msg = Msg> =
  Parameters<F> extends [...infer A, infer L]
    ? L extends M
    ? {args: A, last: L, result: ReturnType<F>}
    : never
    : never

export type Impose<T> = T extends (m: Msg, ...args: infer A) => infer R
  ? {args: A, result: R}
  : never

type Elements<T> = T[keyof T]

export class Msg<
  D extends MsgData = MsgData,
  C extends MsgCaps = MsgCaps
> extends Controller {
  data: D
  caps: C

  get keys(): ReadonlyArray<keyof D>
  get capKeys(): ReadonlyArray<keyof C>

  get<K extends keyof D>(key: K): D[K]
  get<const K extends readonly (keyof D)[]>(keys: K):
    { [I in keyof K]: D[K[I] & keyof D] }

  has<K extends string>(key: K): this is Msg<D & Record<K, unknown>, C>
  has<K extends string>(keys: readonly K[]):
    this is Msg<D & Record<K, unknown>, C>

  pick<K extends keyof D>(key: K): { [P in K]: D[P] }
  pick<const K extends readonly (keyof D)[]>(keys: K):
    { [P in K[number]]: D[P] }

  merge<K extends MsgData>(data: K):
    Msg<D & K, C>
  defaults<K extends MsgData>(data: K):
    Msg<D & Omit<K, keyof D>, C>

  delete<K extends keyof D>(key: K): Msg<Omit<D, K>, C>
  delete<const K extends readonly (keyof D)[]>(keys: K):
    Msg<Omit<D, K[number]>, C>

  capableOf<K extends string>(key: K):
    this is Msg<D, C & Record<K, AnySend>>
  capableOf<K extends string>(keys: ReadonlyArray<K>):
    this is Msg<D, C & Record<K, AnySend>>

  revokeCaps<K extends keyof C>(key: K): Msg<D, Omit<C, K>>
  revokeCaps<const K extends readonly (keyof C)[]>(keys: K):
    Msg<D, Omit<C, K[number]>>

  defaultCaps<K extends MsgCaps>(defaults: K):
    Msg<D, C & Omit<K, keyof C>>

  grantCaps<K extends readonly MsgCaps>(caps: K):
    Msg<D, C & K>

  invoke<K extends keyof C>(spelling: K, arg?: Parameters<C[K]>[0]): this
  send(arg: 'send' extends keyof C ? Parameters<C['send']>[0] : never): this

  copy<K extends MsgData>(data?: K):
    Msg<D & K, C>

  do<F>(fn: F, ...args: Impose<F>['args']): Impose<F>['result']
  map<F>(fn: F, ...args: Impose<F>['args']): Impose<F>['result']
  with<F extends AnyFn>(fn: F, ...args: With<F, typeof this>['args']):
    With<F, typeof this>['result']
  child(): Msg
}

export function msg(): Msg<{}, {}>
export function msg<D extends MsgData>(data: D): Msg<D>

export type Recv<M extends Msg = Msg> = () => Promise<M | typeof EOF>
export type PortLike<C extends MsgCaps = {}>
  = Msg<{description: string}, Omit<Caps<'send'|'close'>, keyof C> & C>

export function port(size?: number): [PortLike, Recv]

export function propagator(): [PortLike, Fwd]
export function propagator<I extends Msg, O extends Msg>(
  fn: PropagateFn<I, O>
): [ PortLike<{send: Send<I>}>, Fwd<O> ]

export type Fwd<M extends Msg = Msg> = (...dests: Send<M>[]) => () => void
export type PropagateFn<I extends Msg, O extends Msg> =
  (value: I, send: Send<O>) => void

export function cell<I extends Msg = Msg, State extends Msg = Msg>(
  merge: MergeFn<I, State>,
  init: State
): [
  PortLike<{send: Send<I>}>,
  { value: () => State, to: Fwd<State>}
]
export type MergeFn<I extends Msg, S extends Msg> =
  (current: S, incoming: I, send: Send<S>) => void

export function consume<I extends Msg = Msg>(recv: Recv<I>):
  [ PortLike, { to: Fwd<I>, promise: Promise<void>} ]
export function consume<
  I extends Msg = Msg,
  O extends Msg = Msg>(recv: Recv<I>, callback: PropagateFn<I, O>):
  [ PortLike, { to: Fwd<O>, promise: Promise<void> } ]

export function net(): [
  PortLike,
  (size?: number) => [PortLike, Recv]
]
