import type { ReactNode } from 'react'
import type { Port, EOF } from '@bassline/core'

export function Net(props: { join: () => Port; children: ReactNode }): ReactNode
export function useNet(): (() => Port) | null
export function useJoin<T = unknown>(join: () => Port<T>): Port<T>
/** `recv` must stay stable for the lifetime of the mounted component. */
export function useConsume<T>(recv: () => Promise<T | typeof EOF>, cb: (value: T) => void | Promise<void>): void
export function usePort<T = unknown>(factory?: () => Port<T>): Port<T>
