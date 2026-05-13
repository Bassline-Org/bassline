import { is, cell, failure, msg, AssertionFailure } from '@bassline/core'
/**
@import { Semver, Ordering } from "./types"
@import { Send, Msg } from "@bassline/core"
 */

/**
 * @param {number} [major]
 * @param {number} [minor]
 * @param {number} [patch]
 * @returns {Semver}
 */
export function semver(major = 0, minor = 0, patch = 0) {
  const m = msg({ major, minor, patch })
  assertSemver(m)
  return m
}

/**
@type {(versioned: Semver, field: keyof Semver['data']) => Semver}
 */
export function bump(versioned, field) {
  const { major, minor, patch } = versioned.data
  switch (field) {
    case 'major':
      return versioned.merge({ major: major + 1, minor: 0, patch: 0 })
    case 'minor':
      return versioned.merge({ major, minor: minor + 1, patch: 0 })
    case 'patch':
      return versioned.merge({ major, minor, patch: patch + 1 })
    default:
      console.warn('unknown bump: ', field)
      return versioned
  }
}

/**
@type {(a: Semver, b: Semver) => Semver}
 */
export function maxVersion(a, b) {
  switch (cmpSemver(a, b)) {
    case 'gt':
    case 'eq':
      return a
    case 'lt':
      return b
    case 'nc':
      throw failure(`Cannot compare: ${JSON.stringify({ a, b })}`)
  }
}

/**
@type {(a: Semver, b: Semver) => Semver}
 */
export function minVersion(a, b) {
  switch (cmpSemver(a, b)) {
    case 'gt':
      return b
    case 'lt':
    case 'eq':
      return a
    case 'nc':
      throw failure(`Cannot compare: ${JSON.stringify({ a, b })}`)
  }
}

/**
@type {(a: Semver, b: Semver) => Ordering}
 */
export function cmpSemver(msgA, msgB) {
  const [a, b] = [msgA.data, msgB.data]
  const result = a.major - b.major || a.minor - b.minor || a.patch - b.patch
  if (result > 0) return 'gt'
  if (result === 0) return 'eq'
  if (result < 0) return 'lt'
  return 'nc'
}

// ==== shape predicates ====
/** @param {unknown} n */
export function assertVersionNum(n) {
  if (!is.number(n)) throw failure('version num must be a number')
  if (!Number.isInteger(n)) throw failure('version must be an integer')
  if (n < 0) throw failure('version num must be >= 0')
  return n
}

/** @param {Msg} m */
export function assertSemver(m) {
  const { min, max, major } = m.pick(['min', 'max', 'major'])
  return [min, max, major].every(assertVersionNum)
}

/**
@param {Msg} m
@returns {m is Semver}
 */
export function isSemver(m) {
  try {
    assertSemver(m)
    return true
  } catch (e) {
    if (e instanceof AssertionFailure) return false
    throw e
  }
}

// ==== cell merges ====
/**
@param {Semver} acc
@param {Semver} inc
@param {Send<Semver>} update
 */
export function versionMerge(acc, inc, update) {
  if (!isSemver(inc)) return
  const max = maxVersion(acc, inc)
  if (max === acc) return
  update(inc)
}

/**
 * @param {Semver} init
 */
export function versioned(init) {
  if (!isSemver(init)) {
    init.merge(semver().data)
  }
  return cell(versionMerge, init)
}
