/**
 * A set of useful data types reified as messages for Bassline
 * The data types chosen are inspired by rebol, but slightly modified
 *
 * Additionally these data types are structural, and designed to be layered
 * When we build a "scalar", we shouldn't think of it as being only a scalar.
 * Instead we should think of it as having a scalar representation.
 *
 * This allows us to, for example, merge a semver + scalar, expressing to have a versioned scalar.
 * { major: 1, minor: 0, patch: 0, scalar: 100 }
 *
 * Currently we expose the following data types
 * - scalars
 * - collections
 * - intervals
 * - semver
 * - uri
 * - capabilities
 * @todo the uri is technically just an href for now, but this will support both reprs later
 */
import { is } from '@bassline/core'
import {
  AssertionFailure,
  assert,
  tryAssert,
  ensure,
  conforms,
  isScalarType,
} from './shape.js'

// ==== scalar ====
export const isScalar = conforms({ scalar: isScalarType })
export function scalar(value) {
  const fmt = val => ({ scalar: val })

  if (isScalar(value)) return value
  if (isScalarType(value)) return fmt(value)
  throw new AssertionFailure(`Invalid scalar: ${JSON.stringify(value)}`)
}

// ==== collection ====
export const isCollection = conforms({ items: is.array })
export function collection(value) {
  const fmt = items => ({ items })
  if (isCollection(value)) return value

  if (is.array(value)) return fmt(value)
  if (isScalarType(value)) {
    throw new AssertionFailure('expected non scalar type')
  }
  if (conforms({ [Symbol.iterator]: is.fn })(value)) {
    return fmt(Array.from(value))
  }
  throw new AssertionFailure('invalid collection type')
}

// ==== interval ====
export const assertInterval = assert([
  [conforms({ min: is.number, max: is.number }), 'invalid interval shape'],
  [({ min, max }) => min <= max, 'min must be <= max'],
])
export const isInterval = tryAssert(assertInterval)
export function interval(min, max) {
  const m = { min, max }
  assertInterval(m)
  return m
}

// ==== semver ====
export const isVersionNum = n => is.number(n) && Number.isInteger(n) && n >= 0
export const isSemver = conforms({
  major: isVersionNum,
  minor: isVersionNum,
  patch: isVersionNum,
})
export const assertSemver = assert([[isSemver, 'invalid semver']])
export function semver(major, minor, patch) {
  const m = { major, minor, patch }
  assertSemver(m)
  return m
}

// ==== uri ====
export const isUri = conforms({ href: v => URL.canParse(v) })
export const assertUri = assert([[isUri, 'cannot parse href']])
export function uri(href) {
  if (isUri(href)) return href

  const m = { href }
  assertUri(m)
  return m
}

// ==== capability ====
export const isCapable = conforms({
  capabilities: ensure([is.object, v => Object.values(v).every(is.string)]),
})

export const isVia = conforms({ via: is.string })
export const isSourced = conforms({
  source: is.string,
})
export const withSource = source => msg => ({ ...msg, source })
