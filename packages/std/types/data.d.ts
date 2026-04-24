export type Collection<T = unknown> = { items: T[] }
type ScalarType = string | number | symbol | null | boolean
export type Scalar = { scalar: ScalarType }
export type Interval = { min: number; max: number }
export type Uri = { href: string }
export type Semver = {major: number, minor: number, patch: number}