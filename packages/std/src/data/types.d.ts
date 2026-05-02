import { Msg } from "@bassline/core"
export type Collection<T = unknown> = Msg<{ items: T[] }>
export type ScalarType = string | number | symbol | null | boolean
export type Scalar = Msg<{ scalar: ScalarType }>
export type Interval = Msg<{ min: number; max: number }>
export type Uri = Msg<{ href: string }>
export type Semver = Msg<{ major: number; minor: number; patch: number }>
export type Ordering = 'gt' | 'lt' | 'eq' | 'nc'
export type IsShaped<T> = (v: unknown) => v is T