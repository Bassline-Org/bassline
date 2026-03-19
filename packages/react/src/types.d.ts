import type { ReactNode } from 'react'
import type { Reader, Writer, Net } from '@bassline/core'

export function Net(props: { net: Net; children: ReactNode }): ReactNode
export function useNet(): Net | null
export function useJoin<T = unknown>(net: Net<T>, cb?: (reader: Reader<T>) => Reader<T>): [Reader<T>, Writer<T>]
export function useSink<T>(reader: Reader<T>, cb: ((value: T) => void) | Writer<T>): void
export function useChannel<T = unknown>(chan?: () => [Reader<T>, Writer<T>]): [Reader<T>, Writer<T>]
export function useBridgedWriter<T = unknown>(target: Writer, bridge: (target: Writer) => (msg: T) => void): Writer<T>
